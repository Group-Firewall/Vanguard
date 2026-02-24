import React, { useState, useEffect } from 'react'
import RealTimeFeed from './RealTimeFeed'
import AlertCenter from './AlertCenter'
import EnhancedMetrics from './EnhancedMetrics'
import FeatureImportance from './FeatureImportance'
import AttackStatistics from './AttackStatistics'
import ConnectionStatus from './ConnectionStatus'
import CaptureEmptyState from './CaptureEmptyState'
import { metricsAPI } from '../services/api'

function Dashboard() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    // Load initial status
    loadMetrics()

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      loadMetrics()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const loadMetrics = async () => {
    try {
      const response = await metricsAPI.get(1)
      setMetrics(response.data)
    } catch (error) {
      console.error('Error loading metrics:', error)
      // Set default values on error
      setMetrics({
        timestamp: new Date().toISOString(),
        packet_volume: 0,
        attack_rate: 0.0,
        false_positive_rate: 0.0,
        model_confidence: {},
        throughput: 0.0,
        latency_ms: 0.0
      })
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
              <ConnectionStatus />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Empty state: use real data from capture; test data optional (dev only) */}
        {(!metrics || metrics.packet_volume === 0) && (
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

export default Dashboard

