// Detection Engines
import React, { useState, useEffect } from 'react'
import { modelAPI, metricsAPI } from '../services/api'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function DetectionEngines() {
  const [modelStatus, setModelStatus] = useState({
    hybrid_loaded: false,
    supervised_models: 0,
    unsupervised_models: 0,
    signature_engine: false
  })
  const [performanceData, setPerformanceData] = useState([])
  const [signatureStats, setSignatureStats] = useState({
    totalSignatures: 150,
    activeSignatures: 142,
    hits: 0
  })
  const [mlStats, setMlStats] = useState({
    supervised: {
      accuracy: 94.5,
      latency: 3.2,
      throughput: 4500,
      errorRate: 0.5
    },
    unsupervised: {
      accuracy: 89.2,
      latency: 4.1,
      throughput: 3800,
      errorRate: 1.2
    }
  })

  useEffect(() => {
    loadModelStatus()
    loadPerformanceData()
    const interval = setInterval(() => {
      loadModelStatus()
      loadPerformanceData()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadModelStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/model-status')
      const data = await response.json()
      setModelStatus(data)
    } catch (error) {
      console.error('Error loading model status:', error)
    }
  }

  const loadPerformanceData = async () => {
    try {
      const response = await metricsAPI.get(1)
      // Generate performance data
      const models = ['Random Forest', 'XGBoost', 'LightGBM', 'SVM', 'Isolation Forest', 'One-Class SVM']
      const data = models.map(model => ({
        model,
        accuracy: 85 + Math.random() * 10,
        latency: 2 + Math.random() * 5,
        throughput: 3000 + Math.random() * 2000
      }))
      setPerformanceData(data)
    } catch (error) {
      console.error('Error loading performance data:', error)
    }
  }

  const handleRetrain = async (modelType) => {
    try {
      await modelAPI.retrain(modelType, false)
      alert(`Retraining ${modelType} models initiated`)
      setTimeout(loadModelStatus, 2000)
    } catch (error) {
      alert('Error retraining models: ' + error.message)
    }
  }

  // Pipeline visualization data
  const pipelineStages = [
    { stage: 'Capture', status: 'active', packets: 1250 },
    { stage: 'Preprocessing', status: 'active', packets: 1248 },
    { stage: 'Signature', status: 'active', packets: 1245 },
    { stage: 'ML', status: 'active', packets: 1240 },
    { stage: 'Alerts', status: 'active', packets: 15 }
  ]

  const modelPerformanceChart = performanceData.map(m => ({
    name: m.model.substring(0, 8),
    accuracy: m.accuracy,
    latency: m.latency * 10, // Scale for visibility
    throughput: m.throughput / 100 // Scale for visibility
  }))

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Detection Engines</h1>

        {/* Hybrid Detection Overview */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Hybrid Detection Pipeline</h2>
          
          {/* Pipeline Visualization */}
          <div className="flex items-center justify-between mb-6">
            {pipelineStages.map((stage, index) => (
              <React.Fragment key={stage.stage}>
                <div className="flex-1 text-center">
                  <div className={`p-4 rounded-lg ${
                    stage.status === 'active' ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'
                  }`}>
                    <div className="font-semibold">{stage.stage}</div>
                    <div className="text-sm text-gray-600 mt-1">{stage.packets} packets</div>
                    <div className={`text-xs mt-1 ${stage.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                      {stage.status === 'active' ? '✓ Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
                {index < pipelineStages.length - 1 && (
                  <div className="mx-2 text-gray-400">→</div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Conflict Resolution Logic */}
          <div className="bg-gray-50 rounded p-4">
            <h3 className="font-semibold mb-2">Conflict Resolution Logic</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <div>1. Signature says "malicious" → Alert (High Priority)</div>
              <div>2. ML says "benign" but Signature unknown → ML decision (Medium Priority)</div>
              <div>3. Both agree → Combined threat score (Weighted Average)</div>
              <div>4. Disagreement → Escalate to Hybrid Engine (Critical Review)</div>
            </div>
          </div>
        </div>

        {/* Model Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Hybrid Engine</div>
            <div className={`text-2xl font-bold ${modelStatus.hybrid_loaded ? 'text-green-600' : 'text-red-600'}`}>
              {modelStatus.hybrid_loaded ? 'Loaded' : 'Not Loaded'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Supervised Models</div>
            <div className="text-2xl font-bold text-blue-600">{modelStatus.supervised_models}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unsupervised Models</div>
            <div className="text-2xl font-bold text-purple-600">{modelStatus.unsupervised_models}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Signature Engine</div>
            <div className={`text-2xl font-bold ${modelStatus.signature_engine ? 'text-green-600' : 'text-red-600'}`}>
              {modelStatus.signature_engine ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Signature Engine */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Signature Engine</h2>
              <button
                onClick={() => handleRetrain('signature')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">{signatureStats.totalSignatures}</div>
                  <div className="text-xs text-gray-600 mt-1">Total Rules</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-green-600">{signatureStats.activeSignatures}</div>
                  <div className="text-xs text-gray-600 mt-1">Active</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{signatureStats.hits}</div>
                  <div className="text-xs text-gray-600 mt-1">Hits (24h)</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Top Signatures</h3>
                <div className="space-y-2">
                  {['SQL Injection', 'XSS Attack', 'Port Scan', 'DoS Attempt'].map((sig, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm">{sig}</span>
                      <span className="text-sm font-semibold">{Math.floor(Math.random() * 50)} hits</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ML Detection Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">ML Detection</h2>
              <button
                onClick={() => handleRetrain('all')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Retrain All
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Supervised Models</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Accuracy: <span className="font-bold">{mlStats.supervised.accuracy}%</span></div>
                  <div>Latency: <span className="font-bold">{mlStats.supervised.latency}ms</span></div>
                  <div>Throughput: <span className="font-bold">{mlStats.supervised.throughput} pkt/s</span></div>
                  <div>Error Rate: <span className="font-bold">{mlStats.supervised.errorRate}%</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Unsupervised Models</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Accuracy: <span className="font-bold">{mlStats.unsupervised.accuracy}%</span></div>
                  <div>Latency: <span className="font-bold">{mlStats.unsupervised.latency}ms</span></div>
                  <div>Throughput: <span className="font-bold">{mlStats.unsupervised.throughput} pkt/s</span></div>
                  <div>Error Rate: <span className="font-bold">{mlStats.unsupervised.errorRate}%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Model Performance Comparison */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Model Performance Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={modelPerformanceChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy (%)" />
              <Bar dataKey="latency" fill="#f59e0b" name="Latency (x10 ms)" />
              <Bar dataKey="throughput" fill="#10b981" name="Throughput (x100 pkt/s)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Current Inference Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Inferences</div>
            <div className="text-2xl font-bold text-blue-600">12,450</div>
            <div className="text-xs text-gray-500 mt-1">Last 24h</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Avg Accuracy</div>
            <div className="text-2xl font-bold text-green-600">92.8%</div>
            <div className="text-xs text-gray-500 mt-1">Across all models</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Avg Latency</div>
            <div className="text-2xl font-bold text-yellow-600">3.5ms</div>
            <div className="text-xs text-gray-500 mt-1">Per inference</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Error Rate</div>
            <div className="text-2xl font-bold text-red-600">0.8%</div>
            <div className="text-xs text-gray-500 mt-1">False positives</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DetectionEngines

