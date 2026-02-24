import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  captureAPI,
  metricsAPI,
  alertsAPI,
  firewallAPI
} from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Shield,
  User,
  Power,
  Settings as SettingsIcon,
  Activity,
  AlertTriangle,
  Zap,
  CheckCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Database,
  Globe,
  Layout,
  ChevronDown,
  LogOut,
  Bell,
  Search,
  ArrowRight
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts'
import ConnectionStatus from '../components/ConnectionStatus'

function DashboardHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [recentAlerts, setRecentAlerts] = useState([])
  const [liveTraffic, setLiveTraffic] = useState([])
  const [systemHealth, setSystemHealth] = useState({
    capture: 'Active',
    ml: 'Running',
    websocket: 'Connected',
    load: 'Low'
  })
  const [trafficHistory, setTrafficHistory] = useState([])
  const ws = useRef(null)

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 30000)

    // WebSocket for live traffic mini-feed
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/alerts`
    ws.current = new WebSocket(wsUrl)

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'packet') {
        const newPacket = message.data
        setLiveTraffic(prev => [newPacket, ...prev].slice(0, 5))
        updateTrafficHistory(newPacket)
      }
    }

    return () => {
      clearInterval(interval)
      if (ws.current) ws.current.close()
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        metricsAPI.get(24),
        alertsAPI.getAll({ limit: 5 })
      ])
      setMetrics(metricsRes.data)
      setRecentAlerts(alertsRes.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    }
  }

  const updateTrafficHistory = (packet) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setTrafficHistory(prev => {
      // If history is empty, initialize with some baseline zeros to avoid a blank chart
      const base = prev.length === 0 ?
        Array.from({ length: 10 }, (_, i) => ({
          time: new Date(Date.now() - (10 - i) * 5000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          value: 0,
          threats: 0
        })) : prev;

      const last = base[base.length - 1]
      if (last && last.time === time) {
        const updated = [...base]
        updated[updated.length - 1].value += 1
        if (packet.is_intrusion) updated[updated.length - 1].threats += 1
        return updated.slice(-20)
      }
      return [...base, { time, value: 1, threats: packet.is_intrusion ? 1 : 0 }].slice(-20)
    })
  }

  const severityData = useMemo(() => {
    if (!recentAlerts.length) return [
      { name: 'High', value: 0, color: '#ef4444' },
      { name: 'Medium', value: 0, color: '#f59e0b' },
      { name: 'Low', value: 0, color: '#10b981' }
    ]
    const counts = { High: 0, Medium: 0, Low: 0 }
    recentAlerts.forEach(a => {
      const sev = a.severity || 'Low'
      counts[sev] = (counts[sev] || 0) + 1
    })
    return [
      { name: 'High', value: counts.High, color: '#ef4444' },
      { name: 'Medium', value: counts.Medium, color: '#f59e0b' },
      { name: 'Low', value: counts.Low, color: '#10b981' }
    ]
  }, [recentAlerts])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Inter']">
      {/* Professional Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold tracking-tight">Vanguard</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Enterprise Security</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <ConnectionStatus />
            <div className="h-8 w-px bg-slate-200" />
            <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* Professional Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-3 hover:bg-slate-50 p-1 rounded-xl transition-all border border-transparent hover:border-slate-100"
              >
                <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-bold leading-tight">{user?.full_name || user?.username || 'Admin User'}</p>
                  <p className="text-[9px] text-green-600 font-bold uppercase tracking-tighter">System Administrator</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  <div className="px-4 py-3 border-b border-slate-50">
                    <p className="text-xs font-bold text-slate-900">{user?.email || 'admin@vanguard.io'}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-3 font-medium"
                    >
                      <User className="w-4 h-4" /> Profile Settings
                    </button>
                    <button
                      onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-3 font-medium"
                    >
                      <SettingsIcon className="w-4 h-4" /> System Preferences
                    </button>
                  </div>
                  <div className="border-t border-slate-50 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <OverviewCard
            title="Total Traffic"
            value={(metrics?.packet_volume || 0).toLocaleString()}
            sub="Packets monitored today"
            icon={<Globe className="w-5 h-5" />}
            trend="+12% vs last 24h"
            color="blue"
          />
          <OverviewCard
            title="Active Threats"
            value={recentAlerts.filter(a => !a.resolved).length}
            sub="Currently requiring action"
            icon={<AlertTriangle className="w-5 h-5" />}
            trend="Unresolved anomalies"
            color="red"
          />
          <OverviewCard
            title="High Severity"
            value={recentAlerts.filter(a => a.severity === 'High').length}
            sub="Critical infrastructure risks"
            icon={<Zap className="w-5 h-5" />}
            trend="Needs immediate attention"
            color="amber"
          />
          <SystemHealthCard
            status={systemHealth}
          />
        </div>

        {/* Real-Time Volume Graph */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold">Network Traffic Velocity</h3>
                <p className="text-xs text-slate-400 font-medium tracking-tight">Real-time packet flow with intrusion markers</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Traffic</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Intrusions</span>
                </div>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficHistory}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} isAnimationActive={false} />
                  <Area type="monotone" dataKey="threats" stroke="#ef4444" fill="transparent" strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-full flex flex-col">
              <h3 className="text-lg font-bold mb-6">Quick Navigation</h3>
              <div className="grid grid-cols-1 gap-3 flex-grow">
                <QuickAction
                  title="Live Traffic"
                  desc="Detailed stream monitoring"
                  icon={<Activity className="w-5 h-5" />}
                  onClick={() => navigate('/traffic')}
                  color="blue"
                />
                <QuickAction
                  title="Alerts Center"
                  desc="Manage security incidents"
                  icon={<Shield className="w-5 h-5" />}
                  onClick={() => navigate('/alerts')}
                  color="red"
                />
                <QuickAction
                  title="Threat Intel"
                  desc="Analyze zero-day patterns"
                  icon={<Database className="w-5 h-5" />}
                  onClick={() => navigate('/intelligence')}
                  color="indigo"
                />
                <QuickAction
                  title="Reports"
                  desc="Generate compliance PDFs"
                  icon={<Layout className="w-5 h-5" />}
                  onClick={() => navigate('/reports')}
                  color="slate"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lower Row: Distribution & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Attack Severity Chart */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-1">Threat Severity</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-6">Hybrid Data Adaptation</p>
            <div className="h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-black text-slate-900">{recentAlerts.length}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Analysis</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {severityData.map(s => (
                <div key={s.name} className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                    <span className="text-slate-600">{s.name}</span>
                  </div>
                  <span>{((s.value / (recentAlerts.length || 1)) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* New Chart: Geographic Threat Source */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-1">Top Attack Origins</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-6">Global Threat Distribution</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { country: 'US', hits: 450 },
                  { country: 'CN', hits: 380 },
                  { country: 'RU', hits: 290 },
                  { country: 'BR', hits: 120 },
                  { country: 'DE', hits: 80 }
                ]}>
                  <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="hits" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-between text-[10px] font-bold text-slate-400 uppercase">
              <span>Primary: North America</span>
              <span className="text-blue-600">Scale: Logarithmic</span>
            </div>
          </div>

          {/* New Chart: Engine Inference Velocity */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-1">Engine Inference</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-6">Performance Activity</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { time: '10:00', load: 45 },
                  { time: '10:10', load: 52 },
                  { time: '10:20', load: 48 },
                  { time: '10:30', load: 70 },
                  { time: '10:40', load: 61 },
                  { time: '10:50', load: 55 }
                ]}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Area type="monotone" dataKey="load" stroke="#10b981" fillOpacity={1} fill="url(#colorLoad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-[10px] font-bold text-green-600 uppercase">Pipeline: Stable</span>
              <span className="text-[10px] font-black text-slate-900">AVG: 52ms</span>
            </div>
          </div>

          {/* Alerts Summary */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold">Latest Security Events</h3>
              <button
                onClick={() => navigate('/alerts')}
                className="text-[10px] font-bold text-blue-600 uppercase hover:underline flex items-center gap-1"
              >
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1">
              {recentAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl border ${alert.severity === 'High' ? 'bg-red-50 border-red-100 text-red-600' :
                      alert.severity === 'Medium' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-green-50 border-green-100 text-green-600'
                      }`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate w-32 sm:w-48">{alert.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded-lg bg-slate-100 text-[9px] font-mono font-bold text-slate-500">{alert.source_ip}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 scale-90 sm:scale-100">
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {recentAlerts.length === 0 && <p className="text-sm text-slate-400 text-center py-12">No recent anomalies detected</p>}
            </div>
          </div>
        </div>

        {/* Mini Live Preview Feed row */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden">
            <h3 className="text-base font-bold mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" /> Live Stream Feed
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {liveTraffic.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl animate-in slide-in-from-right-2 duration-300">
                  <div className={`w-2 h-2 rounded-full ${p.is_intrusion ? 'bg-red-500 animate-pulse' : 'bg-blue-400'}`}></div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="text-[10px] font-mono font-bold text-slate-700 truncate">{p.src_ip}</p>
                      <span className="text-[9px] font-bold text-slate-400">{p.protocol}</span>
                    </div>
                    {p.is_intrusion && (
                      <span className="text-[8px] font-black text-red-600 uppercase tracking-tighter">Mitigating...</span>
                    )}
                  </div>
                </div>
              ))}
              {liveTraffic.length === 0 && <p className="col-span-5 text-center py-8 text-xs text-slate-400 animate-pulse">Waiting for traffic stream...</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function OverviewCard({ title, value, sub, icon, trend, color }) {
  const colors = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    red: "text-red-600 bg-red-50 border-red-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100"
  }
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl border ${colors[color] || colors.blue}`}>
          {icon}
        </div>
        <div className="flex items-center gap-1 text-green-500">
          <TrendingUp className="w-3 h-3" />
          <span className="text-[10px] font-bold">{trend}</span>
        </div>
      </div>
      <div>
        <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-tighter">{title}</p>
        <p className="text-[10px] text-slate-400 mt-2 font-medium">{sub}</p>
      </div>
    </div>
  )
}

function SystemHealthCard({ status }) {
  const indicator = (val) => (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${val === 'Active' || val === 'Running' || val === 'Connected' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
      <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{val}</span>
    </div>
  )
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Activity className="w-20 h-20" />
      </div>
      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">System Health</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Detection Engine</span>
          {indicator(status.ml)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Capture Service</span>
          {indicator(status.capture)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase">WebSocket Stream</span>
          {indicator(status.websocket)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Pipeline Load</span>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">{status.load}</span>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ title, desc, icon, onClick, color }) {
  const colors = {
    blue: "text-blue-600 bg-blue-50 border-blue-100 group-hover:bg-blue-600 group-hover:text-white",
    red: "text-red-600 bg-red-50 border-red-100 group-hover:bg-red-600 group-hover:text-white",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white",
    slate: "text-slate-600 bg-slate-50 border-slate-100 group-hover:bg-slate-600 group-hover:text-white",
  }
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-transparent hover:bg-slate-50 transition-all text-left w-full hover:shadow-sm"
    >
      <div className={`p-3 rounded-xl border transition-all duration-300 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{title}</p>
        <p className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors font-medium">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 ml-auto opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
    </button>
  )
}

export default DashboardHome
