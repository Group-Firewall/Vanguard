/**
 * RealTimeFeed — intrusion alert stream.
 *
 * Subscribes to /ws/alerts for ML-classified threats only.
 * Falls back to REST polling when the WebSocket is not yet connected.
 *
 * Data shape (from pipeline → /ws/alerts):
 * {
 *   type: "alert",
 *   data: {
 *     id, timestamp, severity, alert_type,
 *     source_ip, destination_ip, protocol,
 *     description, threat_score
 *   }
 * }
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { alertsAPI } from '../services/api'
import useWebSocket from '../hooks/useWebSocket'
import { AlertTriangle, Zap, Shield, Clock, WifiOff } from 'lucide-react'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_ALERTS = 50
const FALLBACK_POLL_INTERVAL_MS = 5_000

// ---------------------------------------------------------------------------
// Severity configuration
// ---------------------------------------------------------------------------

const SEVERITY_STYLES = {
  critical: {
    badge: 'bg-red-600 text-white',
    row: 'border-l-4 border-red-500 bg-red-50/30',
    icon: Zap,
  },
  high: {
    badge: 'bg-orange-500 text-white',
    row: 'border-l-4 border-orange-400 bg-orange-50/20',
    icon: AlertTriangle,
  },
  medium: {
    badge: 'bg-yellow-500 text-white',
    row: 'border-l-4 border-yellow-400 bg-yellow-50/10',
    icon: AlertTriangle,
  },
  low: {
    badge: 'bg-blue-500 text-white',
    row: 'border-l-4 border-blue-300 bg-blue-50/10',
    icon: Shield,
  },
}

function severityStyle(severity = 'low') {
  return SEVERITY_STYLES[severity.toLowerCase()] ?? SEVERITY_STYLES.low
}

// ---------------------------------------------------------------------------
// Fallback REST polling (used when WS is not yet open)
// ---------------------------------------------------------------------------

function useFallbackPolling(enabled, onAlerts) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      clearInterval(timerRef.current)
      return
    }

    const poll = async () => {
      try {
        const res = await alertsAPI.getAll({ limit: MAX_ALERTS })
        onAlerts(res.data ?? [])
      } catch {
        // Silently ignore polling errors
      }
    }

    // Poll immediately, then on interval
    poll()
    timerRef.current = setInterval(poll, FALLBACK_POLL_INTERVAL_MS)

    return () => clearInterval(timerRef.current)
  }, [enabled, onAlerts])
}

// ---------------------------------------------------------------------------
// Alert row component
// ---------------------------------------------------------------------------

function AlertRow({ alert }) {
  const style = severityStyle(alert.severity)
  const Icon = style.icon
  const ts = alert.timestamp ? new Date(alert.timestamp) : null

  return (
    <div className={`${style.row} px-5 py-3.5 hover:bg-gray-50/50 transition-colors group`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 p-1 rounded ${style.badge} opacity-90`}>
            <Icon className="w-3 h-3" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                {alert.severity?.toUpperCase()}
              </span>
              <span className="text-xs font-bold text-gray-900">{alert.alert_type}</span>
              {alert.protocol && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {alert.protocol}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{alert.description}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
              <span className="font-mono font-medium">
                {alert.source_ip} → {alert.destination_ip}
              </span>
              {typeof alert.threat_score === 'number' && (
                <span className="font-bold text-red-500">
                  Score {(alert.threat_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {ts && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" />
              {ts.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function RealTimeFeed({ limit = MAX_ALERTS }) {
  const [alerts, setAlerts] = useState([])
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(false)
  isPausedRef.current = isPaused

  // ── WebSocket /ws/alerts ──

  const handleAlertMessage = useCallback((message) => {
    if (message.type !== 'alert') return
    if (isPausedRef.current) return

    setAlerts((prev) => {
      // Deduplicate by id
      const next = [message.data, ...prev.filter((a) => a.id !== message.data.id)]
      return next.slice(0, limit)
    })
  }, [limit])

  const { readyState } = useWebSocket('/ws/alerts', handleAlertMessage)
  const wsOpen = readyState === WebSocket.OPEN

  // ── Fallback polling (only when WS is not connected) ──

  const handlePolledAlerts = useCallback((fetched) => {
    setAlerts((prev) => {
      const existingIds = new Set(prev.map((a) => a.id))
      const newOnes = fetched.filter((a) => !existingIds.has(a.id))
      return [...newOnes, ...prev].slice(0, limit)
    })
  }, [limit])

  useFallbackPolling(!wsOpen, handlePolledAlerts)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Live Threat Feed</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {wsOpen ? (
                <>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-gray-400 font-medium">
                    WebSocket · /ws/alerts
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] text-gray-400 font-medium">
                    REST Fallback — Reconnecting…
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-gray-400 uppercase">
            {alerts.length} / {limit} alerts
          </span>
          <button
            onClick={() => setIsPaused((p) => !p)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all"
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={() => setAlerts([])}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 transition-all"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {alerts.map((alert, i) => (
          <AlertRow key={alert.id ?? i} alert={alert} />
        ))}

        {alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Shield className="w-12 h-12 text-green-200" />
            <p className="text-sm font-medium text-gray-400">No alerts detected</p>
            <p className="text-xs text-gray-300">
              {wsOpen
                ? 'Monitoring /ws/alerts — ML pipeline active.'
                : 'Waiting for WebSocket connection or REST data…'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RealTimeFeed
