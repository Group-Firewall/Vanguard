import React, { useState, useEffect } from 'react'
import {
  User,
  Settings as SettingsIcon,
  Bell,
  Shield,
  Activity,
  Moon,
  Sun,
  RefreshCw,
  Mail,
  Lock,
  Eye,
  Save,
  CheckCircle,
  AlertTriangle,
  Zap,
  Power,
  RotateCcw
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { testDataAPI } from '../services/api'

function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)

  const [profile, setProfile] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    notificationEmail: user?.email || ''
  })

  const [preferences, setPreferences] = useState({
    darkMode: false,
    refreshSpeed: '30s',
    timeRange: '24h',
    soundAlerts: true
  })

  const [alertSettings, setAlertSettings] = useState({
    enableEmail: true,
    severityThreshold: 'Medium',
    autoIncident: true,
    grouping: true
  })

  const [detectionSettings, setDetectionSettings] = useState({
    sensitivity: 'Balanced',
    payloadThreshold: 5000,
    scanDetection: true
  })

  const [systemStatus, setSystemStatus] = useState({
    capture: 'Active',
    ml: 'Running',
    websocket: 'Connected'
  })

  const [lastSaved, setLastSaved] = useState(null)

  const handleSave = () => {
    setIsSaving(true)
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      setSaveStatus('success')
      setLastSaved(new Date().toLocaleTimeString())
      setTimeout(() => setSaveStatus(null), 3000)
    }, 1000)
  }

  const handleRestartServices = () => {
    if (window.confirm('Are you sure you want to restart all monitoring services? This will temporarily interrupt traffic analysis.')) {
      alert('Services restarted successfully.')
    }
  }

  const handleGenerateTestData = async () => {
    try {
      await testDataAPI.create()
      alert('Test data generated successfully! Refresh your dashboard to see the results.')
    } catch (err) {
      alert('Error generating test data.')
    }
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'system', name: 'System Preferences', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'alerts', name: 'Alerts & Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'engine', name: 'Detection Engine', icon: <Shield className="w-4 h-4" /> },
    { id: 'status', name: 'Service Status', icon: <Activity className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-['Inter']">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Settings</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-500 font-medium">Manage your SOC configuration and administrative preferences</p>
              {lastSaved && (
                <>
                  <span className="text-slate-300">•</span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Last saved at {lastSaved}</p>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 ${isSaving ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>

        {saveStatus === 'success' && (
          <div className="mb-6 bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-bold">Configuration updated successfully!</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}
          </div>

          {/* Settings Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="p-8">
                {activeTab === 'profile' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <section>
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" /> Administrative Profile
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                          <input
                            type="text"
                            value={profile.fullName}
                            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="email"
                              value={profile.email}
                              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="pt-8 border-t border-slate-100">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-amber-500" /> Security Credentials
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">New Password</label>
                          <input
                            type="password"
                            placeholder="Enter new password"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2 relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Confirm New Password</label>
                          <input
                            type="password"
                            placeholder="Verify password"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>
                      <div className="mt-6 flex items-center gap-2 p-4 bg-slate-50 rounded-xl">
                        <p className="text-[10px] font-medium text-slate-500">Last login: <span className="font-bold text-slate-700">{new Date().toLocaleString()}</span> from IP: <span className="font-bold text-slate-700">127.0.0.1</span></p>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'system' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <section>
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" /> Visual & Runtime
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Dark Mode Interface</p>
                            <p className="text-[11px] text-slate-500">Switch between dark and light themes</p>
                          </div>
                          <button
                            onClick={() => setPreferences({ ...preferences, darkMode: !preferences.darkMode })}
                            className={`p-2 rounded-xl transition-all ${preferences.darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-white text-slate-400 shadow-sm border border-slate-200'}`}
                          >
                            {preferences.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Live Monitoring Refresh Speed</label>
                            <select
                              value={preferences.refreshSpeed}
                              onChange={(e) => setPreferences({ ...preferences, refreshSpeed: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                            >
                              <option>Real-time (Stream)</option>
                              <option>5s Interval</option>
                              <option>30s Interval</option>
                              <option>1m Interval</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Default Dashboard Range</label>
                            <select
                              value={preferences.timeRange}
                              onChange={(e) => setPreferences({ ...preferences, timeRange: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                            >
                              <option>Last 1 Hour</option>
                              <option>Last 6 Hours</option>
                              <option>Last 24 Hours</option>
                              <option>Last 7 Days</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Sound Notifications</p>
                            <p className="text-[11px] text-slate-500">Play alert sound when severe intrusion is detected</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={preferences.soundAlerts} onChange={(e) => setPreferences({ ...preferences, soundAlerts: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'alerts' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <section>
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-red-600" /> Alert Protocols
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Critical Email Alerts</p>
                            <p className="text-[11px] text-slate-500">Send immediate reports to admin email on High severity</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={alertSettings.enableEmail} onChange={(e) => setAlertSettings({ ...alertSettings, enableEmail: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Severity Threshold</label>
                          <select
                            value={alertSettings.severityThreshold}
                            onChange={(e) => setAlertSettings({ ...alertSettings, severityThreshold: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                          >
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                            <option>Critical Only</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Auto-Create Incidents</p>
                            <p className="text-[11px] text-slate-500">Automatically open investigation ticket when Intrusion = 1</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={alertSettings.autoIncident} onChange={(e) => setAlertSettings({ ...alertSettings, autoIncident: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Alert Grouping</p>
                            <p className="text-[11px] text-slate-500">Collapse similar alerts from same source IP to reduce spam</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={alertSettings.grouping} onChange={(e) => setAlertSettings({ ...alertSettings, grouping: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left- [2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'engine' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <section>
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-600" /> ML Detection Tuning
                      </h3>
                      <div className="space-y-8">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Intrusion Sensitivity Level</label>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${detectionSettings.sensitivity === 'Aggressive' ? 'bg-red-50 text-red-600' :
                                detectionSettings.sensitivity === 'Balanced' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                              }`}>{detectionSettings.sensitivity}</span>
                          </div>
                          <div className="flex gap-2">
                            {['Low', 'Balanced', 'Aggressive'].map(level => (
                              <button
                                key={level}
                                onClick={() => setDetectionSettings({ ...detectionSettings, sensitivity: level })}
                                className={`flex-1 py-4 px-2 rounded-2xl border-2 transition-all font-bold text-xs ${detectionSettings.sensitivity === level
                                    ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm'
                                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                                  }`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 italic">Aggressive mode will flag more anomalies but may increase False Positives.</p>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Payload Size Anomaly Threshold</label>
                            <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-full">{detectionSettings.payloadThreshold} Bytes</span>
                          </div>
                          <input
                            type="range"
                            min="500"
                            max="15000"
                            step="500"
                            value={detectionSettings.payloadThreshold}
                            onChange={(e) => setDetectionSettings({ ...detectionSettings, payloadThreshold: parseInt(e.target.value) })}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-[10px] font-bold text-slate-300 uppercase">
                            <span>Small (MTA)</span>
                            <span>Huge (DDoS)</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Scan Behavior Detection</p>
                            <p className="text-[11px] text-slate-500">Enhanced pattern matching for Port Scanning & OS Fingerprinting</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={detectionSettings.scanDetection} onChange={(e) => setDetectionSettings({ ...detectionSettings, scanDetection: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'status' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <section>
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" /> Pipeline Services
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="bg-green-50 p-2.5 rounded-xl text-green-600">
                              <Zap className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Packet Capture Service</p>
                              <p className="text-[10px] text-slate-400 font-medium">Monitoring eth0 / wlan0</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black bg-green-50 text-green-600 px-3 py-1 rounded-full uppercase tracking-widest border border-green-100">Active</span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                              <Shield className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">ML Prediction Engine</p>
                              <p className="text-[10px] text-slate-400 font-medium">Binary Classification V2.1</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">Running</span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                              <RefreshCw className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">WebSocket Streaming</p>
                              <p className="text-[10px] text-slate-400 font-medium">Socket.io Broadcast Node</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">Connected</span>
                        </div>
                      </div>

                      <div className="mt-12 p-8 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                        <div className="text-center mb-8">
                          <h4 className="text-sm font-bold text-slate-800">Advanced Administrative Controls</h4>
                          <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest">Authorized Access Only</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={handleRestartServices}
                            className="flex items-center justify-center gap-2 bg-white border border-slate-200 p-4 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-red-600 transition-all shadow-sm"
                          >
                            <RotateCcw className="w-4 h-4" /> Restart Services
                          </button>
                          <button
                            onClick={handleGenerateTestData}
                            className="flex items-center justify-center gap-2 bg-blue-600 p-4 rounded-2xl text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-md active:scale-95"
                          >
                            <AlertTriangle className="w-4 h-4" /> Trigger Test Alert
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings;
