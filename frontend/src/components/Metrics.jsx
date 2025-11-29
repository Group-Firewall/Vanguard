import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function Metrics({ metrics }) {
  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">System Metrics</h2>
        <p className="text-gray-500">Loading metrics...</p>
      </div>
    )
  }

  const chartData = [
    {
      name: 'Current',
      'Packet Volume': metrics.packet_volume || 0,
      'Attack Rate': (metrics.attack_rate || 0).toFixed(2),
    },
  ]

  const modelConfidenceData = Object.entries(metrics.model_confidence || {}).map(
    ([model, confidence]) => ({
      model,
      confidence: (confidence * 100).toFixed(2),
    })
  )

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Packet Volume</h3>
          <p className="text-2xl font-bold mt-2">
            {metrics.packet_volume?.toLocaleString() || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Attack Rate</h3>
          <p className="text-2xl font-bold mt-2">
            {(metrics.attack_rate || 0).toFixed(2)}%
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">False Positive Rate</h3>
          <p className="text-2xl font-bold mt-2">
            {(metrics.false_positive_rate || 0).toFixed(2)}%
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Latency</h3>
          <p className="text-2xl font-bold mt-2">
            {(metrics.latency_ms || 0).toFixed(2)} ms
          </p>
        </div>
      </div>

      {/* Model Confidence Chart */}
      {modelConfidenceData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Model Confidence</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modelConfidenceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="model" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="confidence" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Throughput */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Throughput</h3>
        <p className="text-3xl font-bold text-blue-600">
          {(metrics.throughput || 0).toFixed(2)} packets/sec
        </p>
      </div>
    </div>
  )
}

export default Metrics

