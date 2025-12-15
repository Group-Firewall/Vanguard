import React, { useState } from 'react'
import api from '../services/api'

function TestDataButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const createTestData = async () => {
    try {
      setLoading(true)
      setMessage('Creating test data...')
      
      const response = await api.post('/test-data/create')
      
      setMessage(`✓ ${response.data.message || 'Test data created!'}`)
      
      // Reload after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error('Error creating test data:', error)
      setMessage(`✗ Error: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-yellow-800">No Data Available</h3>
          <p className="text-xs text-yellow-600 mt-1">
            {message || 'Click the button below to create test data for the dashboard'}
          </p>
        </div>
        <button
          onClick={createTestData}
          disabled={loading}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Creating...' : 'Create Test Data'}
        </button>
      </div>
    </div>
  )
}

export default TestDataButton

