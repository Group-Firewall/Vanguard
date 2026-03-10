/**
 * CaptureContext - Global capture state management.
 * 
 * This context maintains capture status across all pages so that:
 * 1. Navigating between pages doesn't reset capture state
 * 2. Only one polling interval runs for capture status (not per-page)
 * 3. Capture continues running even when switching pages
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { captureAPI } from '../services/api'

const CaptureContext = createContext()

// Polling interval for capture status (5 seconds is enough - less frequent than before)
const STATUS_POLL_INTERVAL = 5000

export function CaptureProvider({ children }) {
  const [captureStatus, setCaptureStatus] = useState({
    is_capturing: false,
    packets_captured: 0,
    start_time: null,
    interface: null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Track if initial fetch has been done
  const initialFetchDone = useRef(false)
  const pollIntervalRef = useRef(null)

  // Fetch capture status from backend
  const fetchStatus = useCallback(async () => {
    try {
      const res = await captureAPI.status()
      setCaptureStatus(res.data)
      setError(null)
    } catch (err) {
      // Only log once, don't spam console
      if (!error) {
        console.warn('Failed to fetch capture status')
      }
    }
  }, [error])

  // Initial fetch and start polling
  useEffect(() => {
    // Do initial fetch immediately
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
      fetchStatus()
    }

    // Set up polling interval
    pollIntervalRef.current = setInterval(fetchStatus, STATUS_POLL_INTERVAL)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [fetchStatus])

  // Start capture
  const startCapture = useCallback(async (interfaceName = null, filter = null) => {
    setIsLoading(true)
    setError(null)
    try {
      await captureAPI.start(interfaceName, filter)
      // Optimistic update
      setCaptureStatus(prev => ({
        ...prev,
        is_capturing: true,
        packets_captured: 0,
        start_time: new Date().toISOString()
      }))
      // Fetch actual status after a moment
      setTimeout(fetchStatus, 500)
      return { success: true }
    } catch (err) {
      setError(err.message || 'Failed to start capture')
      return { success: false, error: err.message }
    } finally {
      setIsLoading(false)
    }
  }, [fetchStatus])

  // Stop capture
  const stopCapture = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await captureAPI.stop()
      // Optimistic update
      setCaptureStatus(prev => ({
        ...prev,
        is_capturing: false
      }))
      // Fetch actual status
      setTimeout(fetchStatus, 500)
      return { success: true }
    } catch (err) {
      setError(err.message || 'Failed to stop capture')
      // Revert on failure
      setCaptureStatus(prev => ({
        ...prev,
        is_capturing: true
      }))
      return { success: false, error: err.message }
    } finally {
      setIsLoading(false)
    }
  }, [fetchStatus])

  // Refresh status manually (for pages that need immediate updates)
  const refreshStatus = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  const value = {
    captureStatus,
    isCapturing: captureStatus.is_capturing,
    packetsCount: captureStatus.packets_captured,
    startTime: captureStatus.start_time,
    interfaceName: captureStatus.interface,
    isLoading,
    error,
    startCapture,
    stopCapture,
    refreshStatus
  }

  return (
    <CaptureContext.Provider value={value}>
      {children}
    </CaptureContext.Provider>
  )
}

export function useCapture() {
  const context = useContext(CaptureContext)
  if (!context) {
    throw new Error('useCapture must be used within a CaptureProvider')
  }
  return context
}

export default CaptureContext
