import React, { useState, useEffect } from 'react'
import { alertsAPI } from '../services/api'
import { format } from 'date-fns'

function AlertCenter() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [filter])

  const loadAlerts = async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? { severity: filter } : {}
      const response = await alertsAPI.getAll({ ...params, limit: 20 })
      setAlerts(response.data)
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (alertId) => {
    try {
      await alertsAPI.resolve(alertId)
      loadAlerts()
    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'bg-red-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getSeverityBadgeColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Alert Notification Center</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1 border rounded"
        >
          <option value="all">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center py-8 text-gray-500">Loading alerts...</p>
      ) : alerts.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No alerts</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityBadgeColor(
                        alert.severity
                      )}`}
                    >
                      {alert.severity?.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {alert.alert_type}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{alert.description}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {alert.source_ip} → {alert.destination_ip} ({alert.protocol})
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>Score: {alert.threat_score?.toFixed(2)}</span>
                    {alert.timestamp && (
                      <span>
                        {format(new Date(alert.timestamp), 'MMM d, HH:mm:ss')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${getSeverityColor(
                      alert.severity
                    )}`}
                  />
                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AlertCenter

