import React, { useState, useEffect } from 'react'

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'


import Dashboard from './components/Dashboard'
import './styles/index.css'

import Sidebar from './components/Sidebar'
import DashboardHome from './pages/DashboardHome'
import AlertsIncidents from './pages/AlertsIncidents'
import TrafficMonitoring from './pages/TrafficMonitoring'
import AttackIntelligence from './pages/AttackIntelligence'
import DetectionEngines from './pages/DetectionEngines'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import './styles/index.css'


function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const handleSidebarToggle = (event) => {
      setSidebarOpen(event.detail.isOpen)
    }
    window.addEventListener('sidebar-toggle', handleSidebarToggle)
    return () => window.removeEventListener('sidebar-toggle', handleSidebarToggle)
  }, [])


  // Routes
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Default Route */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="*"
              element={
                <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
                  <Sidebar />
                  <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
                    <Routes>
                      {/* Default to dashboard for authenticated users */}
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />

                      <Route path="/dashboard" element={<DashboardHome />} />
                      <Route path="/alerts" element={<AlertsIncidents />} />
                      <Route path="/traffic" element={<TrafficMonitoring />} />
                      <Route path="/intelligence" element={<AttackIntelligence />} />
                      <Route path="/engines" element={<DetectionEngines />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />

                      {/* Fallback for authenticated users */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </div>
                </div>
              }
            />
          </Route>

          {/* Universal Redirect: Unauthenticated users hitting anything else will be caught by ProtectedRoute and sent to /login */}
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

