/**
 * Centralised API service for the Vanguard NIDS frontend.
 *
 * REST requests are routed through an Axios instance that automatically
 * attaches the JWT Bearer token from localStorage.
 *
 * WebSocket connections should use the wsURL() helper so the correct
 * protocol (ws: / wss:) and host are always derived from the page origin.
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// ---------------------------------------------------------------------------
// Axios REST client
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token on every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

// Log errors in development for easier debugging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.response?.data?.detail || error.message,
    })
    return Promise.reject(error)
  },
)

// ---------------------------------------------------------------------------
// WebSocket URL helper
// ---------------------------------------------------------------------------

/**
 * Build an absolute WebSocket URL for the backend.
 *
 * @param {string} path  - e.g. '/ws/packets', '/ws/alerts', '/ws/metrics'
 * @returns {string}     - Full ws:// or wss:// URL.
 *
 * Available channels:
 *   /ws/packets   → raw live packet feed (every captured frame)
 *   /ws/alerts    → intrusion alerts only (ML-classified threats)
 *   /ws/metrics   → periodic traffic statistics
 */
export function wsURL(path) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  return `${protocol}//${host}:8000${path}`
}

// ---------------------------------------------------------------------------
// Domain API groups
// ---------------------------------------------------------------------------

export const authAPI = {
  updateMe: (data) => api.put('/auth/me', data),
}

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (settings) => api.post('/settings', { settings }),
}

export const captureAPI = {
  /** Start live packet capture on the backend. */
  start: (interface_name = null, filter = null) =>
    api.post('/capture/start', { interface: interface_name, filter }),
  /** Stop live packet capture and the processing pipeline. */
  stop: () => api.post('/capture/stop'),
  /** Poll current capture status (is_capturing, packet_count, …). */
  status: () => api.get('/capture/status'),
}

export const alertsAPI = {
  getAll: (params = {}) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`),
  escalate: (id) => api.post(`/alerts/${id}/escalate`),
}

export const metricsAPI = {
  /** Fetch aggregated metrics over the last `hours` hours. */
  get: (hours = 1) => api.get('/metrics', { params: { hours } }),
}

export const featureImportanceAPI = {
  get: (modelName = null) =>
    api.get('/feature-importance', { params: { model_name: modelName } }),
}

export const modelAPI = {
  retrain: (modelType = 'all', force = false) =>
    api.post('/model/retrain', { model_type: modelType, force }),
}

export const testDataAPI = {
  create: () => api.post('/test-data/create'),
}

export const firewallAPI = {
  block: (ip) => api.post('/firewall/block', { ip }),
  unblock: (ip) => api.post('/firewall/unblock', { ip }),
  list: () => api.get('/firewall/list'),
}

export default api
