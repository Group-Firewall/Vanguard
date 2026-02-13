import React, { useState, useEffect } from 'react'
import { modelAPI, metricsAPI } from '../services/api'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  Cpu,
  Activity,
  Shield,
  Zap,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings,
  BarChart3,
  Wind,
  Layers,
  Power,
  RotateCcw,
  Sliders
} from 'lucide-react'

function DetectionEngines() {
  const [modelStatus, setModelStatus] = useState({
    ml: 'Active',
    capture: 'Active',
    stream: 'Connected'
  })
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalPredictions: 45280,
    intrusionsDetected: 124,
    detectionRate: 98.4,
    falsePositives: 12
  })
  const [sensitivity, setSensitivity] = useState('Balanced')
  const [activityData, setActivityData] = useState([])
  const [isRestarting, setIsRestarting] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = () => {
    // Generate dummy activity data
    const data = []
    const now = new Date()
    for (let i = 20; i >= 0; i--) {
      data.push({
        time: new Date(now.getTime() - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        predictions: 80 + Math.floor(Math.random() * 40),
        threats: Math.floor(Math.random() * 5)
      })
    }
    setActivityData(data)
  }

  const handleRestart = () => {
    setIsRestarting(true)
    setTimeout(() => {
      setIsRestarting(false)
      alert('Detection engine components restarted successfully.')
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 font-['Inter']">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Cpu className="w-5 h-5" />
              </span>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Detection Engines</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">Core NIDS brain: ML status, sensitivity tuning, and engine performance</p>
          </div>

          <button
            onClick={handleRestart}
            disabled={isRestarting}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 ${isRestarting ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            <RotateCcw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
            {isRestarting ? 'Restarting...' : 'Restart Engine'}
          </button>
        </div>

        {/* Engine Status & Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'ML Model Engine', status: modelStatus.ml, icon: <Shield className="w-5 h-5" />, color: 'blue' },
            { label: 'Packet Capture', status: modelStatus.capture, icon: <Activity className="w-5 h-5" />, color: 'emerald' },
            { label: 'Streaming Node', status: modelStatus.stream, icon: <Wind className="w-5 h-5" />, color: 'purple' },
            { label: 'Pipeline Health', status: 'Optimal', icon: <CheckCircle className="w-5 h-5" />, color: 'indigo' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-2xl bg-${item.color}-50 text-${item.color}-600`}>
                  {item.icon}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${item.status === 'Active' || item.status === 'Connected' || item.status === 'Optimal'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-red-50 text-red-600 border border-red-100'
                  }`}>
                  {item.status}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">{item.label}</p>
                <p className="text-sm font-bold text-slate-900">Uptime: 14d 2h</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Performance Metrics */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" /> Detection Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-2xl font-black text-slate-900">{performanceMetrics.totalPredictions.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Predictions</p>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-center">
                  <p className="text-2xl font-black text-red-600">{performanceMetrics.intrusionsDetected}</p>
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Intrusions</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Model Precision</span>
                    <span className="text-emerald-500">{performanceMetrics.detectionRate}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '98.4%' }}></div>
                  </div>
                </div>
                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-orange-700">False Positive Feedback</span>
                  </div>
                  <p className="text-xs text-orange-600/80 font-medium">{performanceMetrics.falsePositives} incidents marked as False Positives this week.</p>
                </div>
              </div>
            </div>

            {/* Sensitivity Controls */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" /> Sensitivity Tuning
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-3">Intrusion Sensitivity</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Low', 'Balanced', 'High'].map(level => (
                      <button
                        key={level}
                        onClick={() => setSensitivity(level)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${sensitivity === level
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                          }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Behavioral Anomaly Detection</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Scan Behavior Analysis</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Graphs */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Engine Inference Activity</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Predictions per Minute vs Spikes</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Inferences
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Spikes
                  </div>
                </div>
              </div>
              <div className="p-8 flex-1">
                <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="colorPredictions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="predictions" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPredictions)" />
                    <Line type="monotone" dataKey="threats" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Detection Logs */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Recent Detection Logs</h3>
            <button className="text-blue-600 text-xs font-bold hover:underline">Download full log cycle</button>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Service</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Event</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence</th>
                    <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {[
                    { time: '14:02:15', service: 'ML_ENGINE', event: 'Anomaly detected in payload buffer #82', confidence: '94.2%', status: 'Flagged' },
                    { time: '14:01:48', service: 'PCAP_SRV', event: 'Filter applied: tcp port 80 or 443', confidence: '-', status: 'Success' },
                    { time: '14:00:52', service: 'ML_ENGINE', event: 'Scan pattern matched: TCP Port Sweep', confidence: '99.8%', status: 'Blocked' },
                    { time: '13:58:33', service: 'STREAM_NODE', event: 'WebSocket handshake established', confidence: '-', status: 'Connected' }
                  ].map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 text-slate-500">{log.time}</td>
                      <td className="px-8 py-4 font-bold text-slate-700">{log.service}</td>
                      <td className="px-8 py-4 text-slate-600">{log.event}</td>
                      <td className="px-8 py-4 text-blue-600 font-bold">{log.confidence}</td>
                      <td className="px-8 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.status === 'Blocked' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                          }`}>{log.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DetectionEngines




