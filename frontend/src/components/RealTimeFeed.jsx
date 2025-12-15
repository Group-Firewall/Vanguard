import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { alertsAPI } from '../services/api'
import {
  LineChart,
  Line,
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

function RealTimeFeed() {
  const [alerts, setAlerts] = useState([])
  const [ws, setWs] = useState(null)
  const [stats, setStats] = useState({ severity: {}, alertType: {} })

  useEffect(() => {
    // Load initial alerts from API
    loadAlerts()
    
    // Try to connect to WebSocket (with error handling)
    let websocket = null
    try {
      websocket = new WebSocket('ws://localhost:8000/ws/alerts')
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'alert') {
            setAlerts((prev) => [data.data, ...prev].slice(0, 50)) // Keep last 50
            updateStats(data.data)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        // Fallback to polling
      }

      websocket.onopen = () => {
        console.log('WebSocket connected')
      }

      websocket.onclose = () => {
        console.log('WebSocket disconnected, using polling fallback')
      }

      setWs(websocket)
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }

    // Polling fallback every 5 seconds (always active)
    const pollInterval = setInterval(loadAlerts, 5000)

    return () => {
      if (websocket) {
        websocket.close()
      }
      clearInterval(pollInterval)
    }
  }, [])

  const loadAlerts = async () => {
    try {
      const response = await alertsAPI.getAll({ limit: 50, resolved: false })
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        setAlerts(response.data.slice(0, 50))
        updateStatsFromAlerts(response.data)
      } else {
        // If no alerts, try to get all alerts (including resolved) for demo
        const allResponse = await alertsAPI.getAll({ limit: 20 })
        if (allResponse.data && Array.isArray(allResponse.data) && allResponse.data.length > 0) {
          setAlerts(allResponse.data.slice(0, 20))
          updateStatsFromAlerts(allResponse.data)
        }
      }
    } catch (error) {
      console.error('Error loading alerts:', error)
      // Keep existing alerts on error
    }
  }

  const updateStats = (alert) => {
    setStats(prev => {
      const newStats = { ...prev }
      const severity = alert.severity || 'unknown'
      const alertType = alert.alert_type || 'unknown'
      
      newStats.severity[severity] = (newStats.severity[severity] || 0) + 1
      newStats.alertType[alertType] = (newStats.alertType[alertType] || 0) + 1
      
      return newStats
    })
  }

  const updateStatsFromAlerts = (alerts) => {
    const severityCount = {}
    const alertTypeCount = {}
    
    alerts.forEach(alert => {
      const severity = alert.severity || 'unknown'
      const alertType = alert.alert_type || 'unknown'
      severityCount[severity] = (severityCount[severity] || 0) + 1
      alertTypeCount[alertType] = (alertTypeCount[alertType] || 0) + 1
    })
    
    setStats({ severity: severityCount, alertType: alertTypeCount })
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

  // Prepare pie chart data
  const severityData = Object.entries(stats.severity).map(([name, value]) => ({
    name: name.toUpperCase(),
    value
  }))

  const alertTypeData = Object.entries(stats.alertType).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value
  }))

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']

  // Time series data for attack trends
  const timeSeriesData = alerts
    .slice(0, 10)
    .reverse()
    .map((alert, index) => ({
      time: alert.timestamp ? format(new Date(alert.timestamp), 'HH:mm') : `T${index}`,
      score: (alert.threat_score || 0) * 100,
      severity: alert.severity || 'low'
    }))

  return (
    <div className="space-y-6">
      {/* Real-Time Alerts Feed */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Real-Time Attack Monitoring</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {alerts.length} active alerts
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500">Live</span>
            </div>
          </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No alerts yet</p>
              <p className="text-xs text-gray-400">Create test data to see real-time monitoring</p>
            </div>
          ) : (
            alerts.slice(0, 10).map((alert, index) => (
              <div
                key={alert.id || index}
                className={`border-l-4 p-3 rounded transition-all hover:shadow-md ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{alert.description || 'Alert'}</p>
                    <p className="text-xs mt-1 text-gray-600">
                      {alert.source_ip} → {alert.destination_ip} ({alert.protocol})
                    </p>
                    <div className="flex items-center space-x-3 mt-2 text-xs">
                      <span className="text-gray-500">
                        Score: <span className="font-semibold">{(alert.threat_score || 0).toFixed(2)}</span>
                      </span>
                      {alert.timestamp && (
                        <span className="text-gray-400">
                          {format(new Date(alert.timestamp), 'HH:mm:ss')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-opacity-20">
                      {alert.severity?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Attack Trends Line Chart */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Attack Score Trends</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Threat Score (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Severity Distribution Pie Chart */}
      {severityData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={severityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
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
        </div>
      )}

      {/* Alert Type Distribution */}
      {alertTypeData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Attack Type Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={alertTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
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
        </div>
      )}
    </div>
  )
}

export default RealTimeFeed

