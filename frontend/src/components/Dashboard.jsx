import React, { useState, useEffect } from 'react'
import RealTimeFeed from './RealTimeFeed'
import AlertCenter from './AlertCenter'
import Metrics from './Metrics'
import FeatureImportance from './FeatureImportance'
import { captureAPI, metricsAPI } from '../services/api'

function Dashboard() {
  const [captureStatus, setCaptureStatus] = useState({
    is_capturing: false,
    packets_captured: 0,
  })
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    // Load initial status
    loadStatus()
    loadMetrics()

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      loadStatus()
      loadMetrics()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const response = await captureAPI.status()
      setCaptureStatus(response.data)
    } catch (error) {
      console.error('Error loading capture status:', error)
    }
  }

  const loadMetrics = async () => {
    try {
      const response = await metricsAPI.get(1)
      setMetrics(response.data)
    } catch (error) {
      console.error('Error loading metrics:', error)
    }
  }

  const handleStartCapture = async () => {
    try {
      await captureAPI.start()
      loadStatus()
    } catch (error) {
      console.error('Error starting capture:', error)
      alert('Error starting capture: ' + error.message)
    }
  }

  const handleStopCapture = async () => {
    try {
      await captureAPI.stop()
      loadStatus()
    } catch (error) {
      console.error('Error stopping capture:', error)
      alert('Error stopping capture: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Vanguard NIDS</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    captureStatus.is_capturing ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <span className="text-sm text-gray-600">
                  {captureStatus.is_capturing ? 'Capturing' : 'Stopped'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Packets: {captureStatus.packets_captured.toLocaleString()}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <Metrics metrics={metrics} />
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

export default Dashboard

