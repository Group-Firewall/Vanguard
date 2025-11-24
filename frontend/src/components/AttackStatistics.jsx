import React, { useState, useEffect } from 'react'
import { alertsAPI, metricsAPI } from '../services/api'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function AttackStatistics() {
  const [stats, setStats] = useState({
    totalAlerts: 0,
    severityCount: {},
    alertTypeCount: {},
    protocolCount: {},
    topSources: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatistics()
    const interval = setInterval(loadStatistics, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const loadStatistics = async () => {
    try {
      const [alertsResponse, metricsResponse] = await Promise.all([
        alertsAPI.getAll({ limit: 100 }),
        metricsAPI.get(1)
      ])

      const alerts = alertsResponse.data || []
      
      // Calculate statistics
      const severityCount = {}
      const alertTypeCount = {}
      const protocolCount = {}
      const sourceCount = {}

      alerts.forEach(alert => {
        // Severity
        const severity = alert.severity || 'unknown'
        severityCount[severity] = (severityCount[severity] || 0) + 1

        // Alert type
        const alertType = alert.alert_type || 'unknown'
        alertTypeCount[alertType] = (alertTypeCount[alertType] || 0) + 1

        // Protocol
        const protocol = alert.protocol || 'unknown'
        protocolCount[protocol] = (protocolCount[protocol] || 0) + 1

        // Source IPs
        const sourceIp = alert.source_ip || 'unknown'
        sourceCount[sourceIp] = (sourceCount[sourceIp] || 0) + 1
      })

      // Get top 5 source IPs
      const topSources = Object.entries(sourceCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ip, count]) => ({ ip, count }))

      setStats({
        totalAlerts: alerts.length,
        severityCount,
        alertTypeCount,
        protocolCount,
        topSources
      })
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading statistics...</p>
      </div>
    )
  }

  // Prepare chart data
  const severityData = Object.entries(stats.severityCount).map(([name, value]) => ({
    name: name.toUpperCase(),
    value
  }))

  const alertTypeData = Object.entries(stats.alertTypeCount).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value
  }))

  const protocolData = Object.entries(stats.protocolCount).map(([name, value]) => ({
    name,
    value
  }))

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-6">Attack Statistics Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Alerts Card */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-4 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Alerts</h3>
          <p className="text-4xl font-bold mt-2">{stats.totalAlerts}</p>
        </div>

        {/* Severity Distribution Pie Chart */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Severity Distribution</h3>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No data available</p>
          )}
        </div>

        {/* Top Source IPs */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Top Source IPs</h3>
          {stats.topSources.length > 0 ? (
            <div className="space-y-2">
              {stats.topSources.map((source, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 truncate">{source.ip}</span>
                  <span className="font-semibold text-gray-900">{source.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No data available</p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Alert Type Distribution */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Attack Type Distribution</h3>
          {alertTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={alertTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name.substring(0, 10)} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {alertTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No data available</p>
          )}
        </div>

        {/* Protocol Distribution */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Protocol Distribution</h3>
          {protocolData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={protocolData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No data available</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default AttackStatistics
