import React, { useState, useEffect } from 'react'
import { alertsAPI, metricsAPI } from '../services/api'
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
} from 'recharts'

function Reports() {
  const [reportType, setReportType] = useState('daily')
  const [reports, setReports] = useState([])
  const [summaryData, setSummaryData] = useState(null)

  useEffect(() => {
    loadReports()
  }, [reportType])

  const loadReports = async () => {
    try {
      const [alertsRes, metricsRes] = await Promise.all([
        alertsAPI.getAll({ limit: 1000 }),
        metricsAPI.get(24)
      ])

      const alerts = alertsRes.data || []
      const metrics = metricsRes.data

      // Generate report summary
      const summary = {
        totalAlerts: alerts.length,
        highSeverity: alerts.filter(a => a.severity === 'high' || a.severity === 'critical').length,
        attackTypes: {},
        topSources: {},
        timeDistribution: []
      }

      alerts.forEach(alert => {
        const type = alert.alert_type || 'unknown'
        summary.attackTypes[type] = (summary.attackTypes[type] || 0) + 1
        
        if (alert.source_ip) {
          summary.topSources[alert.source_ip] = (summary.topSources[alert.source_ip] || 0) + 1
        }
      })

      // Time distribution
      const now = new Date()
      for (let i = 23; i >= 0; i--) {
        const hourStart = new Date(now.getTime() - i * 3600000)
        const hourAlerts = alerts.filter(a => {
          const alertTime = new Date(a.timestamp)
          return alertTime >= hourStart && alertTime < new Date(now.getTime() - (i - 1) * 3600000)
        })
        summary.timeDistribution.push({
          hour: hourStart.toLocaleTimeString('en-US', { hour: '2-digit' }),
          count: hourAlerts.length
        })
      }

      setSummaryData(summary)
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }

  const handleExportReport = (format) => {
    alert(`Exporting report as ${format}...`)
   
  }

  const attackTypeData = summaryData ? Object.entries(summaryData.attackTypes)
    .map(([name, value]) => ({ name: name.replace('_', ' ').toUpperCase(), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10) : []

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <div className="flex space-x-2">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="daily">Daily Report</option>
              <option value="weekly">Weekly Report</option>
              <option value="monthly">Monthly Report</option>
              <option value="custom">Custom Period</option>
            </select>
            <button
              onClick={() => handleExportReport('PDF')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Export PDF
            </button>
            <button
              onClick={() => handleExportReport('CSV')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>
        </div>

        {summaryData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Total Alerts</div>
                <div className="text-3xl font-bold text-blue-600">{summaryData.totalAlerts}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">High Severity</div>
                <div className="text-3xl font-bold text-red-600">{summaryData.highSeverity}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Attack Types</div>
                <div className="text-3xl font-bold text-purple-600">{Object.keys(summaryData.attackTypes).length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Unique Sources</div>
                <div className="text-3xl font-bold text-green-600">{Object.keys(summaryData.topSources).length}</div>
              </div>
            </div>

            {/* Time Distribution Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Alert Distribution Over Time (Last 24 Hours)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={summaryData.timeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} name="Alerts" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Attack Types Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Attack Types Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={attackTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name.substring(0, 12)} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {attackTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Attack Types Bar Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Top Attack Types</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attackTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Sources Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Top Source IPs</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert Count</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threat Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(summaryData.topSources)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 20)
                      .map(([ip, count], index) => (
                        <tr key={ip} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-semibold">#{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-mono">{ip}</td>
                          <td className="px-4 py-3 text-sm">{count}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              count > 50 ? 'bg-red-100 text-red-800' :
                              count > 20 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {count > 50 ? 'High' : count > 20 ? 'Medium' : 'Low'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Reports



