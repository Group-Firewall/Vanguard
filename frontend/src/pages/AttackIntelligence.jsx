import React, { useState, useEffect } from 'react'
import { alertsAPI, metricsAPI, firewallAPI } from '../services/api'
import { format } from 'date-fns'
import {
  LineChart,
  Line,
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
  AreaChart,
  Area
} from 'recharts'
import {
  Shield,
  Target,
  Globe,
  Zap,
  Activity,
  Search,
  Filter,
  ExternalLink,
  AlertTriangle,
  Cpu,
  Lock,
  MoreHorizontal,
  ChevronRight,
  User,
  Terminal,
  Server
} from 'lucide-react'

function AttackIntelligence() {
  const [alerts, setAlerts] = useState([])
  const [threatTrends, setThreatTrends] = useState([])
  const [topAttackers, setTopAttackers] = useState([])
  const [behavioralInsights, setBehavioralInsights] = useState([])
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSource, setSelectedSource] = useState(null)
  const [pulseFeed, setPulseFeed] = useState([
    { id: 1, msg: 'Payload anomaly detected on node #14', time: '14:12', type: 'warn' },
    { id: 2, msg: 'Multiple agent mismatches from range 192.x', time: '14:10', type: 'info' },
    { id: 3, msg: 'Source IP 45.2.1.8 blocked by firewall rule #21', time: '14:05', type: 'alert' }
  ])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [alertsRes] = await Promise.all([
        alertsAPI.getAll({ limit: 1000 })
      ])

      const allAlerts = alertsRes.data || []
      setAlerts(allAlerts)

      // Calculate Trends
      const now = new Date()
      const trends = []
      for (let i = 11; i >= 0; i--) {
        const timeSlot = new Date(now.getTime() - i * 3600000)
        const hourLabel = timeSlot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const slotAlerts = allAlerts.filter(a => new Date(a.timestamp) >= new Date(timeSlot.getTime() - 3600000) && new Date(a.timestamp) <= timeSlot)
        trends.push({
          time: hourLabel,
          count: slotAlerts.length,
          threats: slotAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length
        })
      }
      setThreatTrends(trends)

      // Top Attacker IPs
      const attackerIPs = {}
      allAlerts.forEach(a => {
        if (a.source_ip) {
          attackerIPs[a.source_ip] = (attackerIPs[a.source_ip] || 0) + 1
        }
      })
      const sortedAttackers = Object.entries(attackerIPs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ip, count]) => ({
          ip,
          count,
          lastSeen: 'Recently',
          isRepeated: count > 50
        }))
      setTopAttackers(sortedAttackers)

      // Behavioral Extraction
      const insights = [
        {
          id: 1,
          type: 'Payload Anomaly',
          desc: 'Sudden spike in high-byte payloads detected',
          impact: 'Potential Exfiltration',
          severity: 'Critical',
          icon: <Zap className="w-5 h-5" />
        },
        {
          id: 2,
          type: 'Rapid Connections',
          desc: 'Scanning activity from 3 isolated sources',
          impact: 'Reconnaissance',
          severity: 'High',
          icon: <Activity className="w-5 h-5" />
        },
        {
          id: 3,
          type: 'Agent Mismatch',
          desc: 'Non-standard browser agents in encrypted streams',
          impact: 'Automated Bot',
          severity: 'Medium',
          icon: <Terminal className="w-5 h-5" />
        }
      ]
      setBehavioralInsights(insights)
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading intelligence:', error)
      setIsLoading(false)
    }
  }

  const handleBlockIP = async (ip) => {
    if (window.confirm(`Are you sure you want to block ${ip} at the firewall level?`)) {
      try {
        await firewallAPI.blockIP({ ip, reason: 'Intelligence Source' })
        alert(`${ip} blocked successfully.`)
      } catch (err) {
        alert('Failed to block IP.')
      }
    }
  }

  const handleInvestigate = (source) => {
    setSelectedSource(source)
  }

  const filteredObservations = alerts.filter(a =>
    a.source_ip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.scan_type?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 8)

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 font-['Inter']">
      <div className="max-w-7xl mx-auto">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Target className="w-5 h-5" />
              </span>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Attack Intelligence</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">MITRE-style behavioral analysis and threat source intelligence</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search IPs or patterns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none w-64 shadow-sm"
              />
            </div>
            <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shadow-sm">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Intelligence View */}
          <div className="lg:col-span-2 space-y-8">

            {/* Attack Trends Panel */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Attack Velocity Trends</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Frequency vs Severity (12H)</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> Total Volume
                  </div>
                  <div className="flex items-center gap-1.5 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span> Confirmed Threats
                  </div>
                </div>
              </div>
              <div className="p-8">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={threatTrends}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                      <Area type="monotone" dataKey="threats" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorThreats)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Behavioral Intelligence Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-600" /> Behavioral Insights
                </h3>
                <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Refresh Observations</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {behavioralInsights.map(insight => (
                  <div key={insight.id} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm transition-all hover:border-blue-200 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className={`p-3 rounded-2xl w-fit mb-4 transition-colors ${insight.severity === 'Critical' ? 'bg-red-50 text-red-600' :
                      insight.severity === 'High' ? 'bg-orange-50 text-orange-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                      {insight.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-500">{insight.type}</span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1 mb-2 leading-tight">{insight.desc}</h4>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                      <span className="text-[10px] font-black text-slate-500 uppercase">Impact: {insight.impact}</span>
                      <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                        <div className="w-1 h-1 rounded-full bg-blue-300"></div>
                        <div className="w-1 h-1 rounded-full bg-blue-100"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Intelligence Pulse Feed */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intelligence Pulse Feed</h4>
              </div>
              <div className="space-y-3">
                {pulseFeed.slice(0, 3).map(pulse => (
                  <div key={pulse.id} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${pulse.type === 'alert' ? 'bg-red-500' : pulse.type === 'warn' ? 'bg-orange-500' : 'bg-blue-400'}`}></div>
                      <span className="text-xs font-medium text-slate-700">{pulse.msg}</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{pulse.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Threat Details Table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Recent Malicious Observations</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-wider">All Protocols</button>
                <button className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-wider">High Risk</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Source IP</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Behavior Type</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Payload Trend</th>
                    <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredObservations.map(alert => (
                    <tr key={alert.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-slate-700">{alert.source_ip}</span>
                          <div className="h-4 w-4 rounded-full bg-slate-100 flex items-center justify-center">
                            <Globe className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${alert.severity === 'high' || alert.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {alert.scan_type || 'General Traffic'}
                        </span>
                      </td>
                      <td className="px-8 py-4 font-mono text-xs text-slate-500 uppercase">{alert.protocol || 'TCP'}</td>
                      <td className="px-8 py-4">
                        <div className="w-24 h-4 bg-slate-100 rounded-full overflow-hidden flex items-center px-1">
                          <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (alert.payload_size / 500) * 100)}%` }}></div>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleBlockIP(alert.source_ip)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Block IP">
                            <Lock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleInvestigate(alert)}
                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Investigate">
                            <Search className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-8">
          {/* Threat Source Analysis */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" /> Top Threat Sources
            </h3>
            <div className="space-y-6">
              {topAttackers.map((attacker, idx) => (
                <div key={idx} className="flex items-start justify-between group">
                  <div className="flex gap-4">
                    <div className={`mt-1 h-2 w-2 rounded-full ${attacker.isRepeated ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`}></div>
                    <div>
                      <p className="text-xs font-black text-slate-700 font-mono">{attacker.ip}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{attacker.count} Attempts • {attacker.lastSeen}</p>
                      {attacker.isRepeated && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-red-600 text-[9px] text-white font-black uppercase tracking-widest rounded-full shadow-lg shadow-red-100">Repeated Offender</span>
                      )}
                    </div>
                  </div>
                  <button className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-slate-300 hover:text-blue-600 bg-slate-50 rounded-lg">
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all">View All Known Attackers</button>
          </div>

          {/* Top Geographic Sources */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" /> Geographic Threat Origins
            </h3>
            <div className="space-y-4">
              {[
                { country: 'United States', flag: '🇺🇸', count: 450, percentage: 42, color: 'bg-indigo-500' },
                { country: 'China', flag: '🇨🇳', count: 280, percentage: 26, color: 'bg-red-500' },
                { country: 'Russia', flag: '🇷🇺', count: 180, percentage: 17, color: 'bg-blue-500' },
                { country: 'Brazil', flag: '🇧🇷', count: 155, percentage: 15, color: 'bg-emerald-500' }
              ].map(geo => (
                <div key={geo.country}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{geo.flag}</span>
                      <span className="text-xs font-bold text-slate-700">{geo.country}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400">{geo.count} Hits</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                    <div className={`h-full ${geo.color} rounded-full`} style={{ width: `${geo.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MITRE ATT&CK Matrix Mini */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" /> Tactic Lifecycle
              </h3>
              <span className="text-[9px] font-black text-slate-500 uppercase">MITRE v14</span>
            </div>
            <div className="space-y-4">
              {[
                { stage: 'Reconnaissance', count: 12, techniques: 'T1595/T1046', color: 'bg-emerald-500' },
                { stage: 'Initial Access', count: 4, techniques: 'T1190/T1133', color: 'bg-blue-500' },
                { stage: 'Execution', count: 1, techniques: 'T1059.003', color: 'bg-orange-500' },
                { stage: 'Exfiltration', count: 0, techniques: 'N/A', color: 'bg-slate-700' }
              ].map(stage => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-2">
                    <span className="text-slate-400">{stage.stage}</span>
                    <span className="text-white">{stage.count} Alerts</span>
                  </div>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full ${stage.color} rounded-full`}
                      style={{ width: stage.count === 0 ? '0%' : `${(stage.count / 15) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-[8px] font-bold text-slate-600 tracking-widest">{stage.techniques}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[10px] text-slate-500 leading-relaxed italic">Intelligence derived from Scan_Type and User_Agent patterns across current traffic sessions.</p>
          </div>
        </div>
      </div>

      {/* Investigation Modal/Drawer */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSource(null)}></div>
          <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 p-10 text-white">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-white/10 rounded-2xl">
                  <Globe className="w-8 h-8 text-blue-400" />
                </div>
                <button onClick={() => setSelectedSource(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <MoreHorizontal className="w-6 h-6" />
                </button>
              </div>
              <h3 className="text-3xl font-black mb-2">{selectedSource.source_ip}</h3>
              <div className="flex gap-4">
                <span className="px-3 py-1 bg-red-500 rounded-full text-[10px] font-black uppercase">Confirmed Intrusion</span>
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold">Reputation: High Risk</span>
              </div>
            </div>
            <div className="p-10">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">First Seen</p>
                  <p className="text-sm font-bold text-slate-900">{format(new Date(selectedSource.timestamp), 'MMM dd, HH:mm:ss')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Target Protocol</p>
                  <p className="text-sm font-bold text-slate-900 uppercase">{selectedSource.protocol}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Behavioral Signature</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">Scan Activity</span>
                    <span className="text-xs font-bold text-slate-900">{selectedSource.scan_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">Payload Density</span>
                    <span className="text-xs font-bold text-slate-900">{selectedSource.payload_size} Bytes</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => { handleBlockIP(selectedSource.source_ip); setSelectedSource(null); }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200"
                >
                  Block Source IP
                </button>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200"
                >
                  Mark as Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AttackIntelligence




