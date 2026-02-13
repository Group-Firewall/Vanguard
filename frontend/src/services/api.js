import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

export const captureAPI = {
  start: (interface_name = null, filter = null) =>
    api.post('/capture/start', { interface: interface_name, filter }),
  stop: () => api.post('/capture/stop'),
  status: () => api.get('/capture/status'),
}

export const alertsAPI = {
  getAll: (params = {}) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`),
}

export const metricsAPI = {
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

// Add error interceptor for better debugging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.response?.data?.detail || error.message
    })
    return Promise.reject(error)
  }
)

export default api

