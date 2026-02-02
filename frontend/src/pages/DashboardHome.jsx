// dashboard imports
import React, { useState, useEffect } from 'react'
import { captureAPI, metricsAPI, alertsAPI } from '../services/api'
import ConnectionStatus from '../components/ConnectionStatus'
import CaptureEmptyState from '../components/CaptureEmptyState'
import EnhancedMetrics from '../components/EnhancedMetrics'
import RealTimeFeed from '../components/RealTimeFeed'
import AlertCenter from '../components/AlertCenter'
import FeatureImportance from '../components/FeatureImportance'
import AttackStatistics from '../components/AttackStatistics'


function DashboardHome() {
  const [captureStatus, setCaptureStatus] = useState({
    is_capturing: false,
    packets_captured: 0,
  })
  const [metrics, setMetrics] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [systemHealth, setSystemHealth] = useState({
    accuracy: 0,
    latency: 0,
    fpr: 0,
    dosAttempts: 0,
    activeConnections: 0
  })

  useEffect(() => {
    loadAllData()
    const interval = setInterval(loadAllData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadAllData = async () => {
    try {
      const [statusRes, metricsRes, alertsRes] = await Promise.all([
        captureAPI.status().catch(() => ({ data: { is_capturing: false, packets_captured: 0 } })),
        metricsAPI.get(1).catch(() => ({ data: null })),
        alertsAPI.getAll({ limit: 10, resolved: false }).catch(() => ({ data: [] }))
      ])

      setCaptureStatus(statusRes.data)
      setMetrics(metricsRes.data)
      setAlerts(alertsRes.data || [])

      // Calculate system health
      if (metricsRes.data) {
        const dosCount = (alertsRes.data || []).filter(a => 
          a.alert_type?.toLowerCase().includes('dos') || 
          a.alert_type?.toLowerCase().includes('ddos')
        ).length

        setSystemHealth({
          accuracy: metricsRes.data.model_confidence ? 
            Object.values(metricsRes.data.model_confidence).reduce((a, b) => a + b, 0) / Object.keys(metricsRes.data.model_confidence).length * 100 || 0 : 0,
          latency: metricsRes.data.latency_ms || 0,
          fpr: metricsRes.data.false_positive_rate || 0,
          dosAttempts: dosCount,
          activeConnections: metricsRes.data.packet_volume || 0
        })
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const handleStartCapture = async () => {
    try {
      await captureAPI.start()
      loadAllData()
    } catch (error) {
      alert('Error starting capture: ' + error.message)
    }
  }

  const handleStopCapture = async () => {
    try {
      await captureAPI.stop()
      loadAllData()
    } catch (error) {
      alert('Error stopping capture: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard - Real-Time Network Status</h1>
            <div className="flex items-center space-x-4">
              <ConnectionStatus />
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${captureStatus.is_capturing ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm text-gray-600">
                  {captureStatus.is_capturing ? 'Capturing' : 'Stopped'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Packets: {(captureStatus.packets_captured || 0).toLocaleString()}
              </div>
              {captureStatus.is_capturing ? (
                <button
                  onClick={handleStopCapture}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Stop Capture
                </button>
              ) : (
                <button
                  onClick={handleStartCapture}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Start Capture
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Accuracy</div>
            <div className="text-2xl font-bold text-green-600">{systemHealth.accuracy.toFixed(1)}%</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Latency</div>
            <div className="text-2xl font-bold text-blue-600">{systemHealth.latency.toFixed(1)}ms</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">False Positive</div>
            <div className="text-2xl font-bold text-yellow-600">{systemHealth.fpr.toFixed(2)}%</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">DoS Attempts</div>
            <div className="text-2xl font-bold text-red-600">{systemHealth.dosAttempts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Active Connections</div>
            <div className="text-2xl font-bold text-purple-600">{systemHealth.activeConnections.toLocaleString()}</div>
          </div>
        </div>

        {/* Current Alerts Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Current Alerts Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-red-50 rounded">
              <div className="text-3xl font-bold text-red-600">
                {alerts.filter(a => a.severity === 'high' || a.severity === 'critical').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">High/Critical</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded">
              <div className="text-3xl font-bold text-yellow-600">
                {alerts.filter(a => a.severity === 'medium').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Medium</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-3xl font-bold text-green-600">
                {alerts.filter(a => a.severity === 'low').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Low</div>
            </div>
          </div>
        </div>

        {/* Network Throughput */}
        {metrics && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">Network Throughput</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Packets/sec</div>
                <div className="text-3xl font-bold text-blue-600">{(metrics.throughput || 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Estimated Mbps</div>
                <div className="text-3xl font-bold text-green-600">
                  {((metrics.throughput || 0) * 0.0015).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state: encourage real data from capture; test data is optional (dev only) */}
        {(!metrics || (metrics.packet_volume === 0 && !captureStatus.is_capturing)) && (
          <CaptureEmptyState />
        )}

        {/* Top Row - Full Width Statistics */}
        <div className="mb-6">
          <AttackStatistics />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <EnhancedMetrics metrics={metrics} />
            <RealTimeFeed />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <AlertCenter />
            <FeatureImportance />
          </div>
        </div>
      </main>
    </div>
  )
}

export default DashboardHome

