import React, { useState, useEffect } from 'react'
import api from '../services/api'

function ConnectionStatus() {
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const checkConnection = async () => {
    try {
      setChecking(true)
      const response = await api.get('/health')
      setConnected(response.status === 200)
    } catch (error) {
      console.error('Backend connection error:', error)
      setConnected(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`w-2 h-2 rounded-full ${
          connected ? 'bg-green-500' : 'bg-red-500'
        } ${checking ? 'animate-pulse' : ''}`}
      />
      <span className="text-xs text-gray-600">
        {checking ? 'Checking...' : connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}

export default ConnectionStatus

