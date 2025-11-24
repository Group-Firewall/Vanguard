import React, { useState, useEffect } from 'react'
import { alertsAPI } from '../services/api'
import { format } from 'date-fns'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function AlertsIncidents() {
  const [alerts, setAlerts] = useState([])
  const [filteredAlerts, setFilteredAlerts] = useState([])
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [filters, setFilters] = useState({
    severity: 'all',
    protocol: 'all',
    period: '24h',
    engineType: 'all'
  })
  const [incidents, setIncidents] = useState([])
  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    assignedTo: '',
    status: 'open'
  })

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    applyFilters()
  }, [alerts, filters])

  const loadAlerts = async () => {
    try {
      const response = await alertsAPI.getAll({ limit: 1000 })
      setAlerts(response.data || [])
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
  }

  const applyFilters = () => {
    let filtered = [...alerts]

    if (filters.severity !== 'all') {
      filtered = filtered.filter(a => a.severity === filters.severity)
    }

    if (filters.protocol !== 'all') {
      filtered = filtered.filter(a => a.protocol === filters.protocol)
    }

    if (filters.engineType !== 'all') {
      filtered = filtered.filter(a => {
        if (filters.engineType === 'signature') return a.signature_match === true
        if (filters.engineType === 'ml') return a.ml_prediction !== null
        if (filters.engineType === 'hybrid') return a.hybrid_score !== null
        return true
      })
    }

    // Period filter
    if (filters.period !== 'all') {
      const now = new Date()
      const periodMs = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000,
        '30d': 2592000000
      }[filters.period] || 86400000

      filtered = filtered.filter(a => {
        const alertTime = new Date(a.timestamp)
        return (now - alertTime) <= periodMs
      })
    }

    setFilteredAlerts(filtered)
  }

  const handleResolveAlert = async (alertId) => {
    try {
      await alertsAPI.resolve(alertId)
      loadAlerts()
    } catch (error) {
      alert('Error resolving alert: ' + error.message)
    }
  }

  const handleCreateIncident = () => {
    if (!newIncident.title || !newIncident.description) {
      alert('Please fill in title and description')
      return
    }

    const incident = {
      id: Date.now(),
      ...newIncident,
      createdAt: new Date().toISOString(),
      alerts: selectedAlert ? [selectedAlert.id] : []
    }

    setIncidents([...incidents, incident])
    setNewIncident({ title: '', description: '', assignedTo: '', status: 'open' })
    setSelectedAlert(null)
    alert('Incident created successfully!')
  }

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'bg-red-100 border-red-500 text-red-800'
      case 'medium':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800'
      case 'low':
        return 'bg-green-100 border-green-500 text-green-800'
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800'
    }
  }

  // Statistics for charts
  const severityData = filteredAlerts.reduce((acc, alert) => {
    const sev = alert.severity || 'unknown'
    acc[sev] = (acc[sev] || 0) + 1
    return acc
  }, {})

  const engineData = filteredAlerts.reduce((acc, alert) => {
    let engine = 'hybrid'
    if (alert.signature_match) engine = 'signature'
    else if (alert.ml_prediction) engine = 'ml'
    acc[engine] = (acc[engine] || 0) + 1
    return acc
  }, {})

  const chartData = Object.entries(severityData).map(([name, value]) => ({
    name: name.toUpperCase(),
    value
  }))

  const engineChartData = Object.entries(engineData).map(([name, value]) => ({
    name: name.toUpperCase(),
    value
  }))

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Alerts & Incidents</h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="all">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Protocol</label>
              <select
                value={filters.protocol}
                onChange={(e) => setFilters({ ...filters, protocol: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="all">All</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="ICMP">ICMP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
              <select
                value={filters.period}
                onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Engine Type</label>
              <select
                value={filters.engineType}
                onChange={(e) => setFilters({ ...filters, engineType: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="all">All</option>
                <option value="signature">Signature</option>
                <option value="ml">ML</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Alerts Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-xl font-bold">Live Alerts ({filteredAlerts.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dest IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAlerts.slice(0, 50).map((alert) => (
                      <tr
                        key={alert.id}
                        className={`hover:bg-gray-50 cursor-pointer ${selectedAlert?.id === alert.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <td className="px-4 py-3 text-sm">
                          {format(new Date(alert.timestamp), 'MM/dd HH:mm:ss')}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{alert.source_ip}</td>
                        <td className="px-4 py-3 text-sm font-mono">{alert.destination_ip}</td>
                        <td className="px-4 py-3 text-sm">{alert.alert_type || 'Unknown'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            alert.severity === 'high' || alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {alert.severity?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {alert.signature_match ? 'Signature' : alert.ml_prediction ? 'ML' : 'Hybrid'}
                        </td>
                        <td className="px-4 py-3">
                          {!alert.resolved && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleResolveAlert(alert.id)
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold mb-4">Severity Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold mb-4">Detection Engine</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={engineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Alert Details & Incident Response */}
          <div className="space-y-6">
            {/* Alert Details Panel */}
            {selectedAlert && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-bold mb-4">Alert Details</h2>
                <div className="space-y-2 text-sm">
                  <div><span className="font-semibold">ID:</span> {selectedAlert.id}</div>
                  <div><span className="font-semibold">Time:</span> {format(new Date(selectedAlert.timestamp), 'PPpp')}</div>
                  <div><span className="font-semibold">Source:</span> {selectedAlert.source_ip}</div>
                  <div><span className="font-semibold">Destination:</span> {selectedAlert.destination_ip}</div>
                  <div><span className="font-semibold">Protocol:</span> {selectedAlert.protocol}</div>
                  <div><span className="font-semibold">Threat Score:</span> {(selectedAlert.threat_score || 0).toFixed(2)}</div>
                  <div><span className="font-semibold">Description:</span> {selectedAlert.description}</div>
                </div>
              </div>
            )}

            {/* Incident Response */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-bold mb-4">Create Incident</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Incident Title"
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
                <textarea
                  placeholder="Description"
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows="3"
                />
                <input
                  type="text"
                  placeholder="Assign To (Analyst Name)"
                  value={newIncident.assignedTo}
                  onChange={(e) => setNewIncident({ ...newIncident, assignedTo: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
                <select
                  value={newIncident.status}
                  onChange={(e) => setNewIncident({ ...newIncident, status: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button
                  onClick={handleCreateIncident}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Create Incident
                </button>
              </div>
            </div>

            {/* Active Incidents */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-bold mb-4">Active Incidents ({incidents.length})</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {incidents.map((incident) => (
                  <div key={incident.id} className="border rounded p-2">
                    <div className="font-semibold text-sm">{incident.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Status: <span className="font-semibold">{incident.status}</span>
                      {incident.assignedTo && ` | Assigned: ${incident.assignedTo}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertsIncidents

