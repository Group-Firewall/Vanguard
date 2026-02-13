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
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Hybrid Detection Pipeline</h2>

          {/* Pipeline Visualization */}
          <div className="flex items-center justify-between mb-6">
            {pipelineStages.map((stage, index) => (
              <React.Fragment key={stage.stage}>
                <div className="flex-1 text-center px-1">
                  <div className={`p-4 rounded-xl transition-all border-2 ${stage.status === 'active'
                      ? 'bg-green-50 border-green-200 shadow-sm'
                      : 'bg-gray-50 border-gray-100'
                    }`}>
                    <div className="font-bold text-gray-900">{stage.stage}</div>
                    <div className="text-sm text-gray-600 mt-1">{stage.packets} packets</div>
                    <div className={`text-xs font-semibold mt-1 uppercase tracking-wider ${stage.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                      {stage.status === 'active' ? '● Active' : '○ Inactive'}
                    </div>
                  </div>
                </div>
                {index < pipelineStages.length - 1 && (
                  <div className="text-gray-300 font-bold text-xl px-1">→</div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Conflict Resolution Logic */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-3">Conflict Resolution Logic</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex items-center"><span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold mr-3">1</span> Signature says "malicious" → Alert (High Priority)</div>
              <div className="flex items-center"><span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-xs font-bold mr-3">2</span> ML says "benign" but Signature unknown → ML decision (Medium Priority)</div>
              <div className="flex items-center"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mr-3">3</span> Both agree → Combined threat score (Weighted Average)</div>
              <div className="flex items-center"><span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold mr-3">4</span> Disagreement → Escalate to Hybrid Engine (Critical Review)</div>
            </div>
          </div>
        </div>

        {/* Model Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-blue-100">
            <div className="text-sm text-gray-500 font-medium">Hybrid Engine</div>
            <div className={`text-2xl font-bold mt-1 ${modelStatus.hybrid_loaded ? 'text-green-600' : 'text-red-600'}`}>
              {modelStatus.hybrid_loaded ? 'Loaded' : 'Not Loaded'}
            </div>
          </div>
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-blue-100">
            <div className="text-sm text-gray-500 font-medium">Supervised Models</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{modelStatus.supervised_models}</div>
          </div>
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-blue-100">
            <div className="text-sm text-gray-500 font-medium">Unsupervised Models</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">{modelStatus.unsupervised_models}</div>
          </div>
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-blue-100">
            <div className="text-sm text-gray-500 font-medium">Signature Engine</div>
            <div className={`text-2xl font-bold mt-1 ${modelStatus.signature_engine ? 'text-green-600' : 'text-red-600'}`}>
              {modelStatus.signature_engine ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Signature Engine */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Signature Engine</h2>
              <button
                onClick={() => handleRetrain('signature')}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-2xl font-bold text-gray-900">{signatureStats.totalSignatures}</div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">Total Rules</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="text-2xl font-bold text-green-600">{signatureStats.activeSignatures}</div>
                  <div className="text-xs text-green-600 font-semibold uppercase tracking-wider mt-1">Active</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">{signatureStats.hits}</div>
                  <div className="text-xs text-blue-500 font-semibold uppercase tracking-wider mt-1">Hits (24h)</div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Top Signatures</h3>
                <div className="space-y-2">
                  {['SQL Injection', 'XSS Attack', 'Port Scan', 'DoS Attempt'].map((sig, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 transition-all hover:bg-white hover:border-blue-100">
                      <span className="text-sm font-medium text-gray-700">{sig}</span>
                      <span className="text-sm font-bold text-blue-600">{Math.floor(Math.random() * 50)} hits</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ML Detection Status */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">ML Detection</h2>
              <button
                onClick={() => handleRetrain('all')}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Retrain All
              </button>
            </div>
            <div className="space-y-6">
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                  Supervised Models
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accuracy:</span>
                    <span className="font-bold text-gray-900">{mlStats.supervised.accuracy}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Latency:</span>
                    <span className="font-bold text-gray-900">{mlStats.supervised.latency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Throughput:</span>
                    <span className="font-bold text-gray-900">{mlStats.supervised.throughput} pkt/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Error Rate:</span>
                    <span className="font-bold text-gray-900">{mlStats.supervised.errorRate}%</span>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                  Unsupervised Models
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accuracy:</span>
                    <span className="font-bold text-gray-900">{mlStats.unsupervised.accuracy}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Latency:</span>
                    <span className="font-bold text-gray-900">{mlStats.unsupervised.latency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Throughput:</span>
                    <span className="font-bold text-gray-900">{mlStats.unsupervised.throughput} pkt/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Error Rate:</span>
                    <span className="font-bold text-gray-900">{mlStats.unsupervised.errorRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Model Performance Comparison */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Model Performance Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={modelPerformanceChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend iconType="circle" />
              <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy (%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="latency" fill="#f59e0b" name="Latency (x10 ms)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="throughput" fill="#10b981" name="Throughput (x100 pkt/s)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Current Inference Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-blue-100">
            <div className="text-sm text-gray-500 font-medium">Total Inferences</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">12,450</div>
            <div className="text-xs text-gray-400 mt-1 font-medium italic">Last 24h</div>
          </div>
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-green-100">
            <div className="text-sm text-gray-500 font-medium">Avg Accuracy</div>
            <div className="text-2xl font-bold text-green-600 mt-1">92.8%</div>
            <div className="text-xs text-gray-400 mt-1 font-medium italic">Across all models</div>
          </div>
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-yellow-100">
            <div className="text-sm text-gray-500 font-medium">Avg Latency</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">3.5ms</div>
            <div className="text-xs text-gray-400 mt-1 font-medium italic">Per inference</div>
          </div>
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 transition-all hover:border-red-100">
            <div className="text-sm text-gray-500 font-medium">Error Rate</div>
            <div className="text-2xl font-bold text-red-600 mt-1">0.8%</div>
            <div className="text-xs text-gray-400 mt-1 font-medium italic">False positives</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DetectionEngines




