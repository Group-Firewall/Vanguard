import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'

function RealTimeFeed() {
  const [alerts, setAlerts] = useState([])
  const [ws, setWs] = useState(null)

  useEffect(() => {
    // Connect to WebSocket
    const websocket = new WebSocket('ws://localhost:8000/ws/alerts')
    
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'alert') {
          setAlerts((prev) => [data.data, ...prev].slice(0, 50)) // Keep last 50
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    setWs(websocket)

    return () => {
      websocket.close()
    }
  }, [])

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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Real-Time Attack Monitoring</h2>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {alerts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No alerts yet</p>
        ) : (
          alerts.map((alert, index) => (
            <div
              key={alert.id || index}
              className={`border-l-4 p-3 rounded ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{alert.description || 'Alert'}</p>
                  <p className="text-sm mt-1">
                    {alert.source_ip} → {alert.destination_ip}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold">
                    {alert.severity?.toUpperCase()}
                  </span>
                  <p className="text-xs mt-1">
                    Score: {(alert.threat_score || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              {alert.timestamp && (
                <p className="text-xs mt-2 opacity-75">
                  {format(new Date(alert.timestamp), 'HH:mm:ss')}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default RealTimeFeed

