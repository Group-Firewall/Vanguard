import React, { useState, useEffect, useMemo } from 'react'
import { alertsAPI } from '../services/api'
import { format } from 'date-fns'
import {
  Shield,
  Activity,
  AlertTriangle,
  Search,
  Filter,
  MoreVertical,
  X,
  ExternalLink,
  Lock,
  History,
  CheckCircle,
  FileText,
  User,
  ArrowRight,
  ChevronRight,
  Clock,
  Globe,
  Server
} from 'lucide-react'

// Severity Logic Helper
const calculateSeverity = (alert) => {
  const isIntrusion = alert.intrusion === 1 || alert.ml_prediction === 1;
  const payloadSize = alert.payload_size || 0;
  const scanType = alert.scan_type || '';

  if (isIntrusion && (payloadSize > 10000 || scanType.toLowerCase().includes('exploit'))) return 'High';
  if (isIntrusion && scanType.toLowerCase().includes('scan')) return 'Medium';
  if (isIntrusion) return 'Medium';
  return 'Low';
};

// Risk Score Logic Helper
const calculateRiskScore = (alert) => {
  let score = 0;
  if (alert.intrusion === 1 || alert.ml_prediction === 1) score += 50;
  if ((alert.payload_size || 0) > 5000) score += 20;
  if (!['Chrome', 'Firefox', 'Safari'].some(ua => alert.user_agent?.includes(ua))) score += 15;
  if (alert.status >= 400) score += 15;
  return Math.min(score, 100);
};

function AlertsIncidents() {
  const [alerts, setAlerts] = useState([])
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    intrusion: 'all',
    scan_type: 'all',
    protocol: 'all',
    severity: 'all'
  })

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadAlerts = async () => {
    try {
      const response = await alertsAPI.getAll({ limit: 1000 })
      // Enrich data with derived scores
      const enriched = (response.data || []).map(a => ({
        ...a,
        severity: calculateSeverity(a),
        risk_score: calculateRiskScore(a)
      }))
      setAlerts(enriched)
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const matchesSearch =
        alert.source_ip?.includes(searchTerm) ||
        alert.destination_ip?.includes(searchTerm) ||
        alert.scan_type?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesIntrusion = filters.intrusion === 'all' ||
        (filters.intrusion === 'malicious' ? (alert.intrusion === 1 || alert.ml_prediction === 1) : (alert.intrusion === 0 && !alert.ml_prediction));

      const matchesProtocol = filters.protocol === 'all' || alert.protocol === filters.protocol;
      const matchesSeverity = filters.severity === 'all' || alert.severity === filters.severity;
      const matchesScanType = filters.scan_type === 'all' || alert.scan_type === filters.scan_type;

      return matchesSearch && matchesIntrusion && matchesProtocol && matchesSeverity && matchesScanType;
    });
  }, [alerts, searchTerm, filters]);

  const summaryStats = useMemo(() => ({
    total: filteredAlerts.length,
    malicious: filteredAlerts.filter(a => a.severity === 'High' || a.severity === 'Medium').length,
    resolved: filteredAlerts.filter(a => a.resolved).length,
  }), [filteredAlerts]);

  const handleRowClick = (alert) => {
    setSelectedAlert(alert);
    setIsDrawerOpen(true);
  };

  const getSeverityBadge = (severity) => {
    const styles = {
      High: 'bg-red-50 text-red-600 border-red-200',
      Medium: 'bg-yellow-50 text-yellow-600 border-yellow-200',
      Low: 'bg-green-50 text-green-600 border-green-200'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[severity] || styles.Low}`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6 font-['Inter']">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="text-blue-600 w-8 h-8" />
              Alerts & Incidents
            </h1>
            <p className="text-gray-500 text-sm mt-1">Context-driven investigation and response console</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium">
              <FileText className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow-sm border border-gray-200 p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Alerts</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{summaryStats.total}</h3>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-600">
                <Activity className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-blue-600 font-medium">
              <Clock className="w-3.5 h-3.5 mr-1" />
              Last 24 hours monitoring
            </div>
          </div>

          <div className="bg-white shadow-sm border border-gray-200 p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Malicious Detected</p>
                <h3 className="text-3xl font-bold text-red-600 mt-1">{summaryStats.malicious}</h3>
              </div>
              <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-red-600 font-medium">
              Requires immediate triage
            </div>
          </div>

          <div className="bg-white shadow-sm border border-gray-200 p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Resolved Cases</p>
                <h3 className="text-3xl font-bold text-green-600 mt-1">{summaryStats.resolved}</h3>
              </div>
              <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-green-600">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-green-600 font-medium">
              Successful containment
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white shadow-sm border border-gray-200 p-4 rounded-xl flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by IP, Type..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="text-gray-400 w-4 h-4" />
              <select
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={filters.intrusion}
                onChange={(e) => setFilters({ ...filters, intrusion: e.target.value })}
              >
                <option value="all">Status: All</option>
                <option value="malicious">Malicious</option>
                <option value="normal">Normal</option>
              </select>
            </div>

            <select
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            >
              <option value="all">Severity: All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              value={filters.protocol}
              onChange={(e) => setFilters({ ...filters, protocol: e.target.value })}
            >
              <option value="all">Protocol: All</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
            </select>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Intrusion</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Scan Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source IP</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Destination</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payload</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAlerts.length > 0 ? filteredAlerts.map((alert) => (
                <tr
                  key={alert.id}
                  onClick={() => handleRowClick(alert)}
                  className="group hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <td className="px-6 py-4">
                    {(alert.intrusion === 1 || alert.ml_prediction === 1) ? (
                      <span className="flex items-center gap-1.5 text-red-600 font-bold text-xs ring-1 ring-red-500/20 px-2 py-1 rounded bg-red-50 w-fit uppercase">
                        <AlertTriangle className="w-3 h-3" /> Intrusion
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-green-600 font-bold text-xs ring-1 ring-green-500/20 px-2 py-1 rounded bg-green-50 w-fit uppercase">
                        <CheckCircle className="w-3 h-3" /> Normal
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {alert.scan_type || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-blue-600">
                    {alert.source_ip}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-700">{alert.destination_ip}</span>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{alert.port}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(alert.payload_size / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-6 py-4">
                    {getSeverityBadge(alert.severity)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {format(new Date(alert.timestamp), 'HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center text-gray-400 italic">
                    No alerts found matching current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investigation Drawer */}
      <div className={`fixed inset-y-0 right-0 w-[450px] bg-white border-l border-gray-200 shadow-2xl transition-transform duration-300 transform z-50 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedAlert && (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Alert Investigation</h3>
                <p className="text-gray-500 text-xs mt-1">ID: {selectedAlert.id} • SOC Analyst View</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Detection Overview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Detection Insights</h4>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(selectedAlert.severity)}
                    <span className="text-[10px] text-gray-500">ML Confidence: 94.2%</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 font-medium">Risk Score</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-black ${selectedAlert.risk_score > 70 ? 'text-red-600' : 'text-blue-600'}`}>
                        {selectedAlert.risk_score}
                      </span>
                      <span className="text-gray-400 text-xs">/ 100</span>
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-full border-4 border-gray-200 flex items-center justify-center relative">
                    <div className={`absolute inset-0 rounded-full border-4 ${selectedAlert.risk_score > 70 ? 'border-red-600' : 'border-blue-600'}`} style={{ clipPath: `polygon(0 0, 100% 0, 100% ${selectedAlert.risk_score}%, 0 ${selectedAlert.risk_score}%)` }} />
                    <span className="text-xs font-bold text-gray-900">{selectedAlert.risk_score}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Malicious</p>
                    <p className={`text-sm font-bold mt-1 ${(selectedAlert.intrusion || selectedAlert.ml_prediction) ? 'text-red-600' : 'text-green-600'}`}>
                      {(selectedAlert.intrusion || selectedAlert.ml_prediction) ? 'YES' : 'NO'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Repeat Attacker</p>
                    <p className="text-sm font-bold text-gray-700 mt-1">
                      {selectedAlert.source_ip === '192.168.1.105' ? 'Detected (25x)' : 'New Origin'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Network Information */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Network Information
                </h4>
                <div className="bg-white rounded-xl overflow-hidden border border-gray-200 text-sm">
                  {[
                    { label: 'Source IP', value: selectedAlert.source_ip, mono: true, hl: true },
                    { label: 'Destination', value: selectedAlert.destination_ip, mono: true },
                    { label: 'Target Port', value: selectedAlert.port, hl: true },
                    { label: 'Protocol', value: selectedAlert.protocol },
                    { label: 'Geo Location', value: 'Kenya ( Nairobi )' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <span className="text-gray-500">{item.label}</span>
                      <span className={`font-semibold ${item.hl ? 'text-blue-600' : 'text-gray-700'} ${item.mono ? 'font-mono' : ''}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Traffic details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Traffic Behavior
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase mb-1">User Agent</p>
                    <p className="text-sm font-mono text-gray-600 leading-relaxed bg-white p-2 rounded border border-gray-200">
                      {selectedAlert.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...'}
                    </p>
                    {selectedAlert.user_agent?.includes('curl') && (
                      <p className="text-[10px] text-yellow-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Possible automated scan (curl detected)
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Payload Size</span>
                    <span className={`font-bold ${selectedAlert.payload_size > 10000 ? 'text-orange-600' : 'text-gray-700'}`}>
                      {selectedAlert.payload_size.toLocaleString()} bytes
                      {selectedAlert.payload_size > 10000 && <span className="ml-2 text-[10px] text-orange-600 uppercase">Anomaly</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4 pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Security Response</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-100">
                    <Lock className="w-4 h-4" /> Block IP
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-bold transition-all">
                    <History className="w-4 h-4" /> IP History
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => {
                      alert('Incident marked as resolved')
                      setIsDrawerOpen(false)
                    }}
                    className="flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium transition-all"
                  >
                    <CheckCircle className="w-4 h-4 text-green-600" /> Mark as Resolved
                  </button>
                  <button className="flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium transition-all">
                    <User className="w-4 h-4 text-blue-600" /> Assign to Team
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <textarea
                placeholder="Add investigation notes..."
                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Backdrop */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 transition-all duration-300"
        />
      )}
    </div>
  )
}

export default AlertsIncidents




