import React, { useState, useEffect } from 'react'
import { alertsAPI, metricsAPI } from '../services/api'
import { format, subDays } from 'date-fns'
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
  FileText,
  Download,
  Calendar,
  PieChart as PieChartIcon,
  BarChart3,
  Shield,
  AlertTriangle,
  Target,
  Clock,
  Filter,
  CheckCircle,
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  Printer,
  FileSpreadsheet
} from 'lucide-react'

function Reports() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [timeRange, setTimeRange] = useState('7D')
  const [reportHistory, setReportHistory] = useState([
    { id: 1, name: 'Weekly System Audit', date: '2026-02-10', range: 'Feb 03 - Feb 10', status: 'Completed', type: 'PDF' },
    { id: 2, name: 'Intrusion Pattern Analysis', date: '2026-02-08', range: 'Feb 01 - Feb 08', status: 'Completed', type: 'CSV' },
    { id: 3, name: 'Daily Traffic Snapshot', date: '2026-02-12', range: 'Feb 12', status: 'Completed', type: 'PDF' }
  ])
  const [metrics, setMetrics] = useState({
    totalIntrusions: 1248,
    topScanType: 'Nmap Stealth',
    targetedPort: '445 (SMB)',
    highSeverity: 56
  })

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(async () => {
      setIsGenerating(false)

      // Simulate fetching alerts for the period
      const response = await alertsAPI.getAll({ limit: 100 })
      const dataToExport = response.data || []

      const headers = ['Timestamp', 'Source IP', 'Destination IP', 'Type', 'Severity', 'Risk Score'];
      const csvData = dataToExport.map(a => [
        format(new Date(a.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        a.source_ip,
        a.destination_ip,
        a.scan_type || 'Unknown',
        'High', // Simulated severity for example
        75 // Simulated risk score for example
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `vanguard-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const newReport = {
        id: Date.now(),
        name: `${timeRange} System Audit`,
        date: new Date().toISOString().split('T')[0],
        range: timeRange === 'Daily' ? 'Last 24 Hours' : timeRange === 'Weekly' ? 'Last 7 Days' : 'Last 30 Days',
        status: 'Completed',
        type: 'CSV'
      }
      setReportHistory([newReport, ...reportHistory])
    }, 2000)
  }

  const chartData = [
    { name: 'Mon', intrusions: 120, baseline: 100 },
    { name: 'Tue', intrusions: 150, baseline: 110 },
    { name: 'Wed', intrusions: 400, baseline: 105 },
    { name: 'Thu', intrusions: 180, baseline: 115 },
    { name: 'Fri', intrusions: 220, baseline: 120 },
    { name: 'Sat', intrusions: 110, baseline: 100 },
    { name: 'Sun', intrusions: 90, baseline: 95 }
  ]

  const protocolData = [
    { name: 'TCP', value: 75 },
    { name: 'UDP', value: 15 },
    { name: 'ICMP', value: 8 },
    { name: 'Other', value: 2 }
  ]

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 font-['Inter']">
      <div className="max-w-7xl mx-auto">

        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Security Reports</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">Generate and export comprehensive security posture summaries</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              {['Daily', 'Weekly', 'Monthly'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeRange === range ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <button
              onClick={() => window.print()}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shadow-sm"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Intrusions', value: metrics.totalIntrusions, icon: <Shield className="w-5 h-5" />, color: 'blue' },
            { label: 'Top Scan Type', value: metrics.topScanType, icon: <Target className="w-5 h-5" />, color: 'emerald' },
            { label: 'Most Targeted Port', value: metrics.targetedPort, icon: <Search className="w-5 h-5" />, color: 'purple' },
            { label: 'High Severity', value: metrics.highSeverity, icon: <AlertTriangle className="w-5 h-5" />, color: 'red' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
              <div className={`w-10 h-10 rounded-2xl bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center mb-4`}>
                {item.icon}
              </div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{item.label}</p>
              <p className="text-2xl font-black text-slate-900 leading-tight">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Visualizations */}
          <div className="lg:col-span-2 space-y-8">

            {/* Intrusions Over Time */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Intrusion Velocity</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Report Period Snapshot</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Current</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-200"></span> Previous</div>
                </div>
              </div>
              <div className="p-8 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorIntrusions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="intrusions" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIntrusions)" />
                    <Area type="monotone" dataKey="baseline" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Protocol Distribution */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Protocol Distribution</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={protocolData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {protocolData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  {protocolData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.name}</span>
                      <span className="text-xs font-bold text-slate-900 ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity Share */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Severity Distribution</h3>
                <div className="space-y-6">
                  {[
                    { label: 'Critical', value: 12, color: 'bg-red-500' },
                    { label: 'High', value: 34, color: 'bg-orange-500' },
                    { label: 'Medium', value: 45, color: 'bg-blue-500' },
                    { label: 'Low', value: 9, color: 'bg-slate-400' }
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        <span>{item.label}</span>
                        <span className="text-slate-900">{item.value}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden text-white">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Report Controls & History */}
          <div className="space-y-8">

            {/* Report Builder */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/20">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" /> Report Builder
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Primary Period</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                      <option>Daily Traffic Snapshot</option>
                      <option>Weekly Enterprise Audit</option>
                      <option>Monthly Compliance Review</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Include Insights</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="w-5 h-5 border-2 border-slate-700 rounded-lg flex items-center justify-center group-hover:border-blue-500 transition-all">
                        <CheckCircle className="w-3 h-3 text-blue-500" />
                      </div>
                      <span className="text-xs font-bold text-slate-300">Intrusion Pattern Analysis</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="w-5 h-5 border-2 border-slate-700 rounded-lg flex items-center justify-center group-hover:border-blue-500 transition-all">
                        <CheckCircle className="w-3 h-3 text-blue-500" />
                      </div>
                      <span className="text-xs font-bold text-slate-300">ML Performance Feedback</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-slate-400">Recurring Schedule</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isGenerating ? 'bg-slate-800 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                      }`}
                  >
                    {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isGenerating ? 'Generating...' : 'Generate New Report'}
                  </button>
                </div>
              </div>
            </div>

            {/* Report History */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" /> Recent Archive
              </h3>
              <div className="space-y-6">
                {reportHistory.map(report => (
                  <div key={report.id} className="group flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className={`p-2.5 rounded-xl ${report.type === 'PDF' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {report.type === 'PDF' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase">{report.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{report.date} • {report.range}</p>
                      </div>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-blue-600 bg-slate-50 rounded-lg transition-all">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button className="w-full mt-8 py-3 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-2xl">Access Full Archive</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Reports




