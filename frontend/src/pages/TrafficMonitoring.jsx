/**
 * TrafficMonitoring — live packet stream viewer.
 *
 * Data flow
 * ---------
 * Backend  →  /ws/packets  →  useWebSocket hook  →  local packet buffer
 *
 * The frontend is a pure VISUALISATION layer:
 *  - Subscribes to /ws/packets for the live raw packet feed.
 *  - Subscribes to /ws/metrics for throughput stats.
 *  - Starts/stops capture via REST (captureAPI).
 *  - Performs no packet capture or ML analysis itself.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react'
import api, { metricsAPI, firewallAPI } from '../services/api'
import useWebSocket from '../hooks/useWebSocket'
import { useCapture } from '../contexts/CaptureContext'
import ConfirmDialog, { Toast } from '../components/ConfirmDialog'
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Shield, Activity, Search, Pause, Play, Download,
  Zap, AlertCircle, Clock, Globe, Database, Terminal, Server,
  ChevronDown, Lock, CheckCircle, Eye, Ban, FileText, ArrowRight,
  X, AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PACKET_BUFFER = 100
const MAX_TRAFFIC_RATE_POINTS = 20
const MAX_WARNINGS = 5

// Protocol colors for charts
const PROTOCOL_COLORS = {
  TCP: '#3b82f6',
  UDP: '#10b981',
  ICMP: '#f59e0b',
  HTTP: '#8b5cf6',
  HTTPS: '#ec4899',
  DNS: '#06b6d4',
  SSH: '#ef4444',
  OTHER: '#6b7280'
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
  info: '#6b7280'
}

// ---------------------------------------------------------------------------
// Protocol badge colours
// ---------------------------------------------------------------------------

function protocolBadgeClass(protocol) {
  if (protocol === 'TCP') return 'bg-green-50 text-green-600'
  if (protocol === 'UDP') return 'bg-blue-50 text-blue-600'
  return 'bg-gray-100 text-gray-600'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'vanguard_last_capture'

function TrafficMonitoring() {
  // Use global capture context for status that persists across pages
  const { 
    captureStatus, 
    isCapturing, 
    startCapture: contextStartCapture, 
    stopCapture: contextStopCapture,
    refreshStatus 
  } = useCapture()

  // Packet buffer displayed in the live table - restore from localStorage
  const [packets, setPackets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.packets || []
      }
    } catch (e) { /* ignore */ }
    return []
  })

  // UI control state
  const [isPaused, setIsPaused] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProtocol, setFilterProtocol] = useState('all')
  const [filterIntrusion, setFilterIntrusion] = useState('all')

  // Derived visualisation data - restore from localStorage
  const [trafficRate, setTrafficRate] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.trafficRate || []
      }
    } catch (e) { /* ignore */ }
    return []
  })
  const [warnings, setWarnings] = useState([])
  const [liveMetrics, setLiveMetrics] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.liveMetrics || null
      }
    } catch (e) { /* ignore */ }
    return null
  })

  // Ref-based pause flag avoids re-subscribing to WebSocket on toggle
  const isPausedRef = useRef(false)
  isPausedRef.current = isPaused

  // Action menu and dialogs state
  const [openActionId, setOpenActionId] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'Confirm',
    onConfirm: () => {},
    isLoading: false,
  })
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' })

  // Capture Report Modal State
  const [captureReport, setCaptureReport] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ isVisible: true, message, type })
  }

  // Save capture data to localStorage when it changes (debounced)
  React.useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (packets.length > 0 || liveMetrics) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            packets: packets.slice(0, 50), // Save last 50 packets to avoid storage limits
            trafficRate: trafficRate.slice(-20),
            liveMetrics,
            savedAt: new Date().toISOString()
          }))
        } catch (e) { /* ignore storage errors */ }
      }
    }, 1000) // Debounce saves
    return () => clearTimeout(saveTimeout)
  }, [packets, trafficRate, liveMetrics])

  // ------------------------------------------------------------------
  // Capture Status from Global Context (persists across pages)
  // ------------------------------------------------------------------

  const handleStartCapture = async () => {
    try {
      await contextStartCapture()
      // Clear previous capture data for fresh start
      setPackets([])
      setTrafficRate([])
      setWarnings([])
      setLiveMetrics(null)
      localStorage.removeItem(STORAGE_KEY)
      showToast('Packet capture started successfully', 'success')
    } catch (err) {
      showToast(`Failed to start capture: ${err.message}`, 'error')
    }
  }

  const handleStopCapture = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Stop Capture',
      message: 'Are you sure you want to stop the packet capture? Current session data will be preserved.',
      type: 'warning',
      confirmText: 'Stop Capture',
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        showToast('Stopping capture...', 'info')
        try {
          await contextStopCapture()
          showToast('Packet capture stopped successfully', 'success')
          
          // Fetch the latest capture report
          try {
            const reportsResponse = await api.get('/reports/captures', { params: { limit: 1 } })
            if (reportsResponse.data.reports && reportsResponse.data.reports.length > 0) {
              const latestReport = reportsResponse.data.reports[0]
              const reportDetails = await api.get(`/reports/captures/${latestReport.id}`)
              setCaptureReport(reportDetails.data)
              setShowReportModal(true)
            }
          } catch (reportErr) {
            console.error('Failed to fetch capture report:', reportErr)
          }
        } catch (err) {
          showToast(`Failed to stop capture: ${err.message}`, 'error')
        }
      },
    })
  }

  // Download capture report file
  const downloadCaptureReport = (reportId, fileType) => {
    const url = `${api.defaults.baseURL}/reports/captures/${reportId}/download/${fileType}`
    const token = localStorage.getItem('token')
    
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `capture_report_${reportId}.${fileType === 'json' ? 'json' : 'csv'}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(downloadUrl)
        showToast(`Downloaded ${fileType} report`, 'success')
      })
      .catch(() => showToast('Download failed', 'error'))
  }

  // Save report locally (all files)
  const saveReportLocally = async () => {
    if (!captureReport) return
    
    // Download all available files
    downloadCaptureReport(captureReport.id, 'json')
    
    // Add small delay between downloads
    await new Promise(r => setTimeout(r, 300))
    if (captureReport.downloads?.packets_csv) {
      downloadCaptureReport(captureReport.id, 'packets')
    }
    
    await new Promise(r => setTimeout(r, 300))
    if (captureReport.downloads?.alerts_csv) {
      downloadCaptureReport(captureReport.id, 'alerts')
    }
  }

  // ------------------------------------------------------------------
  // /ws/packets — raw live packet feed
  // ------------------------------------------------------------------

  const handlePacketMessage = useCallback((message) => {
    if (message.type !== 'packet') return
    if (isPausedRef.current) return

    const packet = message.data

    // Update packet buffer
    setPackets((prev) => [packet, ...prev].slice(0, MAX_PACKET_BUFFER))

    // Update rolling traffic-rate chart
    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    setTrafficRate((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.time === now) {
        const updated = [...prev]
        updated[updated.length - 1] = { ...last, count: last.count + 1 }
        return updated.slice(-MAX_TRAFFIC_RATE_POINTS)
      }
      return [...prev, { time: now, count: 1 }].slice(-MAX_TRAFFIC_RATE_POINTS)
    })

    // Smart indicators: flag large payloads and intrusions
    const newWarnings = []
    if (packet.packet_size > 5_000) {
      newWarnings.push({
        id: `${Date.now()}-size`,
        type: 'size',
        msg: `Payload spike from ${packet.src_ip}: ${packet.packet_size} bytes`,
      })
    }
    if (packet.is_intrusion) {
      newWarnings.push({
        id: `${Date.now()}-threat`,
        type: 'threat',
        msg: `Intrusion detected: ${packet.scan_type} from ${packet.src_ip}`,
      })
    }
    if (newWarnings.length > 0) {
      setWarnings((prev) => [...newWarnings, ...prev].slice(0, MAX_WARNINGS))
    }
  }, [])

  useWebSocket('/ws/packets', handlePacketMessage)

  // ------------------------------------------------------------------
  // /ws/metrics — periodic throughput stats from pipeline
  // ------------------------------------------------------------------

  const handleMetricsMessage = useCallback((message) => {
    if (message.type === 'metrics') {
      setLiveMetrics(message.data)
    }
  }, [])

  useWebSocket('/ws/metrics', handleMetricsMessage)

  // ------------------------------------------------------------------
  // Packet Actions
  // ------------------------------------------------------------------

  const handleBlockIP = (ip) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Block IP Address',
      message: `Are you sure you want to block IP address ${ip}? This will prevent all traffic from this source.`,
      type: 'danger',
      confirmText: 'Block IP',
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false })) // Close immediately
        setOpenActionId(null)
        try {
          await firewallAPI.block(ip)
          showToast(`IP ${ip} has been blocked successfully`, 'success')
        } catch (err) {
          showToast('Failed to block IP. Check the console for details.', 'error')
        }
      },
    })
  }

  const handleWhitelistIP = (ip) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Whitelist IP Address',
      message: `Add ${ip} to the whitelist? Traffic from this IP will not be flagged as suspicious.`,
      type: 'success',
      confirmText: 'Whitelist',
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false })) // Close immediately
        setOpenActionId(null)
        try {
          await firewallAPI.whitelist(ip)
          showToast(`IP ${ip} has been whitelisted`, 'success')
        } catch (err) {
          showToast('Failed to whitelist IP', 'error')
        }
      },
    })
  }

  const handleInspectPacket = (packet) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Packet Details',
      message: `Source: ${packet.src_ip}:${packet.src_port || '-'}\nDestination: ${packet.dst_ip}:${packet.dst_port || '-'}\nProtocol: ${packet.protocol}\nSize: ${packet.packet_size} bytes\nThreat: ${packet.is_intrusion ? packet.scan_type : 'None'}`,
      type: 'info',
      confirmText: 'Close',
      showCancel: false,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        setOpenActionId(null)
      },
    })
  }

  const handleLogPacket = (packet) => {
    // Export single packet to clipboard as JSON
    navigator.clipboard.writeText(JSON.stringify(packet, null, 2))
    showToast('Packet data copied to clipboard', 'info')
    setOpenActionId(null)
  }

  // Close action menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-menu-container')) {
        setOpenActionId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // ------------------------------------------------------------------
  // Derived analytics from the current packet buffer
  // ------------------------------------------------------------------

  const filteredPackets = useMemo(() => {
    return packets.filter((p) => {
      const matchesSearch =
        !searchTerm ||
        p.src_ip?.includes(searchTerm) ||
        p.dst_ip?.includes(searchTerm)
      const matchesProtocol =
        filterProtocol === 'all' ||
        p.protocol?.toLowerCase() === filterProtocol.toLowerCase()
      const matchesIntrusion =
        filterIntrusion === 'all' ||
        (filterIntrusion === 'malicious' ? p.is_intrusion : !p.is_intrusion)
      return matchesSearch && matchesProtocol && matchesIntrusion
    })
  }, [packets, searchTerm, filterProtocol, filterIntrusion])

  const analytics = useMemo(() => {
    const sources = {}
    const ports = {}
    const agents = {}

    packets.forEach((p) => {
      if (p.src_ip) sources[p.src_ip] = (sources[p.src_ip] || 0) + 1
      if (p.dst_port) ports[p.dst_port] = (ports[p.dst_port] || 0) + 1
      if (p.raw_summary?.toLowerCase().includes('agent')) {
        const match = p.raw_summary.match(/User-Agent: ([^\r\n]+)/)
        if (match) agents[match[1]] = (agents[match[1]] || 0) + 1
      }
    })

    return {
      topSources: Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topPorts: Object.entries(ports).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topAgents: Object.entries(agents).sort((a, b) => b[1] - a[1]).slice(0, 5),
    }
  }, [packets])

  const latestPps = liveMetrics?.packets_per_second
    ?? trafficRate[trafficRate.length - 1]?.count
    ?? 0

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 font-['Inter']">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Live Traffic Monitoring
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  Real-Time Data Stream · /ws/packets
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Start/Stop Capture Controls */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mr-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${captureStatus.is_capturing ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
                />
                <span className="text-xs font-bold text-gray-600">
                  {captureStatus.is_capturing ? 'CAPTURING' : 'STOPPED'}
                </span>
              </div>
              
              {captureStatus.is_capturing ? (
                <button
                  onClick={handleStopCapture}
                  className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleStartCapture}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  Start
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Packets/Sec</p>
                <p className="text-lg font-bold text-blue-600">{latestPps.toLocaleString()}</p>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Buffer</p>
                <p className="text-lg font-bold text-gray-700">
                  {packets.length}/{MAX_PACKET_BUFFER}
                </p>
              </div>
              {liveMetrics && (
                <>
                  <div className="h-8 w-px bg-gray-100" />
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Alerts</p>
                    <p className="text-lg font-bold text-red-600">
                      {liveMetrics.alerts_generated}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Pause / resume */}
            <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
              <button
                onClick={() => setIsPaused((p) => !p)}
                className={`p-2 rounded-lg transition-all ${isPaused
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
                title={isPaused ? 'Resume Stream' : 'Pause Stream'}
              >
                {isPaused
                  ? <Play className="w-5 h-5" />
                  : <Pause className="w-5 h-5" />
                }
              </button>
              <button
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                title="Export Snapshot"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Intelligence Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Top Sources */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" /> Top Active Sources
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                live window
              </span>
            </div>
            <div className="space-y-3">
              {analytics.topSources.map(([ip, count], i) => (
                <div key={ip} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-bold w-4">#{i + 1}</span>
                    <span className="text-xs font-mono font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                      {ip}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{count}</span>
                </div>
              ))}
              {analytics.topSources.length === 0 &&
                <p className="text-xs text-gray-400 py-2">Waiting for traffic…</p>
              }
            </div>
          </div>

          {/* Traffic Velocity Chart */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" /> Traffic Velocity
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">Packets/sec</span>
              </div>
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficRate}>
                  <Area
                    type="monotone" dataKey="count"
                    stroke="#3b82f6" fill="#eff6ff"
                    strokeWidth={2} isAnimationActive={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px', border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Smart Indicators */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 overflow-hidden">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500" /> Smart Indicators
            </h3>
            <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1">
              {warnings.map((w) => (
                <div
                  key={w.id}
                  className={`p-2 rounded-lg text-[10px] font-medium ${w.type === 'threat'
                    ? 'bg-red-50 text-red-600 border border-red-100'
                    : 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                    }`}
                >
                  {w.msg}
                </div>
              ))}
              {warnings.length === 0 &&
                <p className="text-xs text-gray-400 py-4 text-center">No anomalies detected</p>
              }
            </div>
          </div>
        </div>

        {/* ── Main Table + Right Column ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Live Traffic Table */}
          <div className="lg:col-span-3 bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            {/* Table header / filters */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-bold text-gray-900">Live Traffic Stream</h2>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Source/Dest…"
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

            {/* Table rows */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    {['Timestamp', 'Source → Destination', 'Proto/Port', 'Size', 'Analysis', 'Actions'].map((h) => (
                      <th key={h} className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPackets.map((p, i) => (
                    <tr
                      key={p.id || `${p.timestamp}-${i}`}
                      className={`hover:bg-blue-50/30 transition-colors group ${p.is_intrusion ? 'bg-red-50/20' : ''}`}
                    >
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[11px] font-medium text-gray-500">
                            {new Date(p.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                            {p.src_ip}
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                          <span className="text-xs font-mono font-bold text-gray-700">{p.dst_ip}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${protocolBadgeClass(p.protocol)}`}>
                          {p.protocol} · {p.dst_port ?? '–'}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-600">{p.packet_size}B</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {p.is_intrusion ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase">
                            <Zap className="w-3 h-3" /> {p.scan_type}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 uppercase">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <div className="relative action-menu-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenActionId(openActionId === (p.id || i) ? null : (p.id || i))
                            }}
                            className="p-1.5 px-3 text-[10px] font-bold bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-1"
                          >
                            Actions <ChevronDown className={`w-3 h-3 transition-transform ${openActionId === (p.id || i) ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {openActionId === (p.id || i) && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                              <button
                                onClick={() => handleInspectPacket(p)}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Details
                              </button>
                              <button
                                onClick={() => handleBlockIP(p.src_ip)}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                              >
                                <Ban className="w-3.5 h-3.5" /> Block Source IP
                              </button>
                              <button
                                onClick={() => handleWhitelistIP(p.src_ip)}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center gap-2"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Whitelist IP
                              </button>
                              <button
                                onClick={() => handleLogPacket(p)}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-2"
                              >
                                <FileText className="w-3.5 h-3.5" /> Copy to Clipboard
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredPackets.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Activity className="w-10 h-10 text-gray-200 animate-pulse" />
                          <p className="text-gray-400 text-sm font-medium">
                            Waiting for live traffic stream…
                          </p>
                          <p className="text-gray-300 text-xs">
                            Start capture via the Dashboard to see packets here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">

            {/* Targeted Ports */}
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
                        style={{ width: `${(count / Math.max(packets.length, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {analytics.topPorts.length === 0 &&
                  <p className="text-xs text-gray-400 py-2">No port data yet</p>
                }
              </div>
            </div>

            {/* User Agents */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-orange-500" /> User Agents
              </h3>
              <div className="space-y-3">
                {analytics.topAgents.map(([agent, count]) => (
                  <div key={agent} className="p-2 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-700 truncate w-40">{agent}</span>
                      <span className="text-[10px] font-bold text-blue-600">{count}</span>
                    </div>
                    {['nmap', 'curl', 'python', 'zgrab'].some(
                      (bot) => agent.toLowerCase().includes(bot)
                    ) && (
                        <span className="text-[9px] font-bold text-orange-600 uppercase">
                          Suspicious Automation
                        </span>
                      )}
                  </div>
                ))}
                {analytics.topAgents.length === 0 &&
                  <p className="text-xs text-gray-400 py-2">No agent data detected</p>
                }
              </div>
            </div>

            {/* Security Status Card */}
            <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-100 relative overflow-hidden">
              <Shield className="absolute -right-4 -bottom-4 w-24 h-24 text-blue-500 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">Security Status</p>
              <h4 className="text-xl font-bold mt-1">NIDS Active</h4>
              <div className="flex items-center gap-2 mt-4">
                <div className="p-1 bg-white/20 rounded">
                  <CheckCircle className="w-3 h-3" />
                </div>
                <span className="text-[10px] font-bold">Hybrid ML · Batch Processing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Capture Report Modal */}
      {showReportModal && captureReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Capture Report Generated</h2>
                  <p className="text-xs text-slate-500">Session completed successfully</p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-2xl">
                  <div className="text-2xl font-black text-blue-600">{captureReport.packet_count?.toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Packets Captured</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl">
                  <div className="text-2xl font-black text-amber-600">{captureReport.alert_count}</div>
                  <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Alerts Generated</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <div className="text-2xl font-black text-emerald-600">{captureReport.window_minutes || 10}</div>
                  <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Minutes Duration</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl">
                  <div className="text-2xl font-black text-purple-600">
                    {captureReport.protocol_distribution ? Object.keys(captureReport.protocol_distribution).length : 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-purple-400 font-bold">Protocols Seen</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Protocol Distribution */}
                {captureReport.protocol_distribution && Object.keys(captureReport.protocol_distribution).length > 0 && (
                  <div className="bg-slate-50 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" />
                      Protocol Distribution
                    </h3>
                    <div className="h-32 mb-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(captureReport.protocol_distribution).map(([name, value]) => ({
                              name,
                              value
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={50}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {Object.entries(captureReport.protocol_distribution).map(([name], idx) => (
                              <Cell key={idx} fill={PROTOCOL_COLORS[name] || PROTOCOL_COLORS.OTHER} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(captureReport.protocol_distribution).map(([name, count]) => (
                        <span
                          key={name}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: `${PROTOCOL_COLORS[name] || PROTOCOL_COLORS.OTHER}20`, color: PROTOCOL_COLORS[name] || PROTOCOL_COLORS.OTHER }}
                        >
                          {name}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Severity Breakdown */}
                <div className="bg-slate-50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Alert Severity
                  </h3>
                  {captureReport.severity_breakdown && Object.keys(captureReport.severity_breakdown).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(captureReport.severity_breakdown).map(([severity, count]) => (
                        <div key={severity} className="flex items-center justify-between">
                          <span
                            className="px-2 py-1 rounded text-xs font-bold uppercase"
                            style={{ background: `${SEVERITY_COLORS[severity] || '#6b7280'}20`, color: SEVERITY_COLORS[severity] || '#6b7280' }}
                          >
                            {severity}
                          </span>
                          <span className="font-bold text-slate-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm py-4 text-center">No alerts in this session</p>
                  )}
                </div>
              </div>

              {/* Packet Stats */}
              {captureReport.stats && (
                <div className="mt-6 bg-slate-50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-500" />
                    Packet Statistics
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Min Size</div>
                      <div className="text-lg font-bold text-slate-900">{captureReport.stats.min_packet_size || 0} B</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Max Size</div>
                      <div className="text-lg font-bold text-slate-900">{captureReport.stats.max_packet_size || 0} B</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Avg Size</div>
                      <div className="text-lg font-bold text-slate-900">{Math.round(captureReport.stats.avg_packet_size || 0)} B</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Sources */}
              {captureReport.top_sources && captureReport.top_sources.length > 0 && (
                <div className="mt-6 bg-slate-50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-500" />
                    Top Sources
                  </h3>
                  <div className="space-y-2">
                    {captureReport.top_sources.slice(0, 5).map((source, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-200 last:border-0">
                        <span className="font-mono text-sm text-slate-600">{source.src_ip}</span>
                        <span className="font-bold text-slate-900">{source.packet_count} packets</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Report stored at: <span className="font-mono">reports/captures/</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => downloadCaptureReport(captureReport.id, 'json')}
                    className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-200 transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    JSON
                  </button>
                  {captureReport.downloads?.packets_csv && (
                    <button
                      onClick={() => downloadCaptureReport(captureReport.id, 'packets')}
                      className="px-4 py-2 bg-emerald-100 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-200 transition flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Packets CSV
                    </button>
                  )}
                  <button
                    onClick={saveReportLocally}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Save All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={confirmDialog.confirmText}
        showCancel={confirmDialog.showCancel}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Notifications */}
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  )
}

export default TrafficMonitoring
