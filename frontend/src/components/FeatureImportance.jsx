import React, { useState, useEffect } from 'react'
import { featureImportanceAPI } from '../services/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function FeatureImportance() {
  const [importance, setImportance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState(null)

  useEffect(() => {
    loadFeatureImportance()
  }, [selectedModel])

  const loadFeatureImportance = async () => {
    try {
      setLoading(true)
      const response = await featureImportanceAPI.get(selectedModel)
      setImportance(response.data)
    } catch (error) {
      console.error('Error loading feature importance:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Feature Importance</h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!importance || !importance.features) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Feature Importance</h2>
        <p className="text-gray-500">No feature importance data available</p>
      </div>
    )
  }

  // Prepare chart data
  const chartData = Object.entries(importance.features).map(([feature, data]) => {
    const importanceValue =
      typeof data === 'object' && data !== null
        ? data.importance_mean || data.importance || 0
        : data || 0
    return {
      feature: feature.length > 20 ? feature.substring(0, 20) + '...' : feature,
      importance: parseFloat(importanceValue),
    }
  })

  // Sort by importance and take top 15
  chartData.sort((a, b) => b.importance - a.importance)
  const topFeatures = chartData.slice(0, 15)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Feature Importance</h2>
        <select
          value={selectedModel || ''}
          onChange={(e) => setSelectedModel(e.target.value || null)}
          className="px-3 py-1 border rounded"
        >
          <option value="">All Models</option>
          <option value="random_forest">Random Forest</option>
          <option value="xgboost">XGBoost</option>
          <option value="lightgbm">LightGBM</option>
          <option value="svm">SVM</option>
        </select>
      </div>

      {topFeatures.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topFeatures} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="feature" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="importance" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default FeatureImportance

