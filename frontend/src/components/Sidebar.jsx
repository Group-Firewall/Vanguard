import React, { useState, createContext, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Cpu,
  FileText,
  Settings
} from "lucide-react"

const SidebarContext = createContext()

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    return { isOpen: true, setIsOpen: () => { } }
  }
  return context
}

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(true)

  // Expose sidebar state to parent
  React.useEffect(() => {
    const event = new CustomEvent('sidebar-toggle', { detail: { isOpen } })
    window.dispatchEvent(event)
  }, [isOpen])

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      description: 'Real-Time Network Status Overview'
    },
    {
      id: 'alerts',
      label: 'Alerts & Incidents',
      icon: AlertTriangle,
      path: '/alerts',
      description: 'Live Alerts & Incident Response'
    },
    {
      id: 'traffic',
      label: 'Traffic Monitoring',
      icon: BarChart3,
      path: '/traffic',
      description: 'Live Traffic & Analytics'
    },
    {
      id: 'intelligence',
      label: 'Attack Intelligence',
      icon: ShieldAlert,
      path: '/intelligence',
      description: 'Threat Trends & Zero-Day Analysis'
    },
    {
      id: 'engines',
      label: 'Detection Engines',
      icon: Cpu,
      path: '/engines',
      description: 'Hybrid Detection & ML Status'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      path: '/reports',
      description: 'Reports & Capture Sessions'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      description: 'System Configuration'
    }
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className={`bg-gray-900 text-white transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'} min-h-screen fixed left-0 top-0 z-40 overflow-y-auto`}>
      {/* Toggle Button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {isOpen && (
          <h2 className="text-xl font-bold text-white">Vanguard NIDS</h2>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded hover:bg-gray-800 transition-colors"
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          <span className="text-xl">{isOpen ? '←' : '→'}</span>
        </button>
      </div>

      {/* Menu Items */}
      <nav className="mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`group w-full flex items-center px-4 py-3 transition-all duration-200 ${isActive(item.path)
                  ? 'bg-blue-600 border-l-4 border-blue-400'
                  : 'hover:bg-gray-800 border-l-4 border-transparent'
                }`}
              title={!isOpen ? item.label : ''}
            >
              <Icon
                size={22}
                className={`mr-3 transition-transform duration-200 ${isActive(item.path)
                    ? "text-white scale-110"
                    : "text-gray-400 group-hover:scale-110"
                  }`}
              />

              {isOpen && (
                <div className="flex-1 text-left">
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {item.description}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      {isOpen && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 bg-gray-800">
          <div className="text-xs text-gray-400">
            <div>Version 2.0.0</div>
            <div className="mt-1">© 2026 Vanguard</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar

