import React, { useState, useEffect, useMemo, useRef } from 'react'
import { metricsAPI, alertsAPI, firewallAPI } from '../services/api'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
  Activity,
  Search,
  Filter,
  Pause,
  Play,
  Download,
  Zap,
  AlertCircle,
  Clock,
  Globe,
  Database,
  Terminal,
  User as UserIcon,
  Server
} from 'lucide-react'

function TrafficMonitoring() {
  const [packets, setPackets] = useState([])
  const [isPaused, setIsPaused] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProtocol, setFilterProtocol] = useState('all')
  const [filterIntrusion, setFilterIntrusion] = useState('all')
  const [metrics, setMetrics] = useState(null)
  const ws = useRef(null)

  // Real-time metrics and analysis
  const [topSources, setTopSources] = useState([])
  const [portActivity, setPortActivity] = useState([])
  const [userAgents, setUserAgents] = useState([])
  const [trafficRate, setTrafficRate] = useState([])
  const [warnings, setWarnings] = useState([])

  useEffect(() => {
    // Initial data load
    loadInitialData()

    // Connect to WebSocket
    const token = localStorage.getItem('token')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/alerts` // Using the alerts WS for now as it uses manager.broadcast

    ws.current = new WebSocket(wsUrl)

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'packet' && !isPaused) {
        const newPacket = message.data
        setPackets(prev => [newPacket, ...prev].slice(0, 100))
        analyzePacket(newPacket)
      }
    }

    return () => {
      if (ws.current) ws.current.close()
    }
  }, [isPaused])

  const loadInitialData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        metricsAPI.get(1),
        alertsAPI.getAll({ limit: 100 })
      ])
      setMetrics(metricsRes.data)
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const analyzePacket = (packet) => {
    // Update Traffic Rate (packets per second simulation)
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setTrafficRate(prev => {
      const last = prev[prev.length - 1]
      if (last && last.time === now) {
        const updated = [...prev]
        updated[updated.length - 1].count += 1
        return updated.slice(-20)
      }
      return [...prev, { time: now, count: 1 }].slice(-20)
    })

    // Smart Warnings logic
    const newWarnings = []
    if (packet.packet_size > 5000) {
      newWarnings.push({ id: Date.now() + Math.random(), type: 'size', msg: `Payload spike from ${packet.src_ip}: ${packet.packet_size} bytes` })
    }
    if (packet.is_intrusion) {
      newWarnings.push({ id: Date.now() + Math.random(), type: 'threat', msg: `Intrusion detected: ${packet.scan_type} from ${packet.src_ip}` })
    }

    if (newWarnings.length > 0) {
      setWarnings(prev => [...newWarnings, ...prev].slice(0, 5))
    }
  }

  const handleBlockIP = async (ip) => {
    try {
      await firewallAPI.block(ip)
      alert(`IP address ${ip} has been blocked at the firewall level.`)
    } catch (error) {
      console.error('Error blocking IP:', error)
      alert('Failed to block IP. Please check console for details.')
    }
  }

  const filteredPackets = useMemo(() => {
    return packets.filter(p => {
      const matchesSearch = p.src_ip?.includes(searchTerm) || p.dst_ip?.includes(searchTerm)
      const matchesProtocol = filterProtocol === 'all' || p.protocol?.toLowerCase() === filterProtocol.toLowerCase()
      const matchesIntrusion = filterIntrusion === 'all' || (filterIntrusion === 'malicious' ? p.is_intrusion : !p.is_intrusion)
      return matchesSearch && matchesProtocol && matchesIntrusion
    })
  }, [packets, searchTerm, filterProtocol, filterIntrusion])

  // Derived Analytics from current packet buffer
  const analytics = useMemo(() => {
    const sources = {}
    const ports = {}
    const agents = {}

    packets.forEach(p => {
      sources[p.src_ip] = (sources[p.src_ip] || 0) + 1
      ports[p.dst_port] = (ports[p.dst_port] || 0) + 1
      // Summary often contains user agent if HTTP
      if (p.raw_summary?.toLowerCase().includes('agent')) {
        const match = p.raw_summary.match(/User-Agent: ([^\r\n]+)/)
        if (match) agents[match[1]] = (agents[match[1]] || 0) + 1
      }
    })

    return {
      topSources: Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topPorts: Object.entries(ports).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topAgents: Object.entries(agents).sort((a, b) => b[1] - a[1]).slice(0, 5)
    }
  }, [packets])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 font-['Inter']">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header - Live Monitoring Console Style */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Live Traffic Monitoring</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Real-Time Data Stream</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Packets/Sec</p>
                <p className="text-lg font-bold text-blue-600">{(trafficRate[trafficRate.length - 1]?.count || 0).toLocaleString()}</p>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Buffer</p>
                <p className="text-lg font-bold text-gray-700">{packets.length}/100</p>
              </div>
            </div>

            <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`p-2 rounded-lg transition-all ${isPaused ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title={isPaused ? "Resume Stream" : "Pause Stream"}
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" title="Export Snapshot">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Top Intelligence Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Top Sources */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" /> Top Active Sources
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">30s window</span>
            </div>
            <div className="space-y-3">
              {analytics.topSources.map(([ip, count], i) => (
                <div key={ip} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-bold w-4">#{i + 1}</span>
                    <span className="text-xs font-mono font-medium text-gray-700 group-hover:text-blue-600 transition-colors uppercase cursor-pointer">{ip}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{count}v</span>
                </div>
              ))}
              {analytics.topSources.length === 0 && <p className="text-xs text-gray-400 py-2">Waiting for traffic...</p>}
            </div>
          </div>

          {/* Traffic Rate Mini Graph */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" /> Traffic Velocity
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Incoming</span>
                </div>
              </div>
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficRate}>
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} isAnimationActive={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Threat Indicators/Warnings */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 overflow-hidden">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500" /> Smart Indicators
            </h3>
            <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1">
              {warnings.map(w => (
                <div key={w.id} className={`p-2 rounded-lg text-[10px] font-medium animate-in slide-in-from-right-2 duration-300 ${w.type === 'threat' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-yellow-50 text-yellow-600 border border-yellow-100'}`}>
                  {w.msg}
                </div>
              ))}
              {warnings.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No anomalies detected</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Streaming Table */}
          <div className="lg:col-span-3 bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-bold text-gray-900">Live Traffic Stream</h2>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Source/Dest..."
                    className="bg-transparent text-xs outline-none border-none p-0 w-48 placeholder:text-gray-400 font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="bg-gray-50 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 outline-none"
                  value={filterProtocol}
                  onChange={(e) => setFilterProtocol(e.target.value)}
                >
                  <option value="all">ANY PROTOCOL</option>
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                  <option value="ICMP">ICMP</option>
                </select>
                <select
                  className="bg-gray-50 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 outline-none"
                  value={filterIntrusion}
                  onChange={(e) => setFilterIntrusion(e.target.value)}
                >
                  <option value="all">ALL TRAFFIC</option>
                  <option value="malicious">MALICIOUS ONLY</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source → Destination</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Proto/Port</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Analysis</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPackets.map((p, i) => (
                    <tr
                      key={p.id || i}
                      className={`hover:bg-blue-50/30 transition-colors group ${p.is_intrusion ? 'bg-red-50/20' : ''}`}
                    >
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[11px] font-medium text-gray-500">{new Date(p.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{p.src_ip}</span>
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                          <span className="text-xs font-mono font-bold text-gray-700">{p.dst_ip}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.protocol === 'TCP' ? 'bg-green-50 text-green-600' :
                          p.protocol === 'UDP' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {p.protocol} · {p.dst_port}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-600">{p.packet_size}B</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {p.is_intrusion ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase">
                              <Zap className="w-3 h-3" /> {p.scan_type}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 uppercase">
                              Normal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleBlockIP(p.src_ip)}
                            className="p-1 px-2 text-[9px] font-bold bg-white border border-gray-200 rounded text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all uppercase"
                          >
                            Block
                          </button>
                          <button className="p-1 px-2 text-[9px] font-bold bg-white border border-gray-200 rounded text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all uppercase tracking-tight">Investigate</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPackets.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Activity className="w-10 h-10 text-gray-200 animate-pulse" />
                          <p className="text-gray-400 text-sm font-medium">Waiting for live traffic stream...</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column Analysis */}
          <div className="space-y-6">
            {/* Port Activity */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Database className="w-4 h-4 text-purple-500" /> Targeted Ports
              </h3>
              <div className="space-y-4">
                {analytics.topPorts.map(([port, count]) => (
                  <div key={port}>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span className="text-gray-600">Port {port}</span>
                      <span className="text-gray-400">{count} hits</span>
                    </div>
                    <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(count / packets.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {analytics.topPorts.length === 0 && <p className="text-xs text-gray-400 py-2">No port data yet</p>}
              </div>
            </div>

            {/* Suspicious Agents */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-orange-500" /> User Agents
              </h3>
              <div className="space-y-3">
                {analytics.topAgents.map(([agent, count]) => (
                  <div key={agent} className="p-2 bg-gray-50 rounded-lg group">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-700 truncate w-40">{agent}</span>
                      <span className="text-[10px] font-bold text-blue-600">{count}</span>
                    </div>
                    {['nmap', 'curl', 'python', 'zgrab'].some(bot => agent.toLowerCase().includes(bot)) && (
                      <span className="text-[9px] font-bold text-orange-600 uppercase">Suspicious Automation</span>
                    )}
                  </div>
                ))}
                {analytics.topAgents.length === 0 && <p className="text-xs text-gray-400 py-2">No agent data detected</p>}
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-100 relative overflow-hidden">
                <Shield className="absolute -right-4 -bottom-4 w-24 h-24 text-blue-500 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Security Status</p>
                <h4 className="text-xl font-bold mt-1">NIDS Active</h4>
                <div className="flex items-center gap-2 mt-4">
                  <div className="p-1 bg-white/20 rounded">
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] font-bold">Hybrid ML Processing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ArrowRight(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function CheckCircle(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export default TrafficMonitoring
