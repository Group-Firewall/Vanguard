import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
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
    <Router>
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/alerts" element={<AlertsIncidents />} />
            <Route path="/traffic" element={<TrafficMonitoring />} />
            <Route path="/intelligence" element={<AttackIntelligence />} />
            <Route path="/engines" element={<DetectionEngines />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App

