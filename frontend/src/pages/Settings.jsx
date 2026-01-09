import React, { useState } from 'react'

function Settings() {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      sms: false,
      push: true
    },
    autoTrigger: {
      repeatedThreats: true,
      highSeverity: true,
      modelFailure: true,
      threshold: 3
    },
    system: {
      captureInterface: 'eth0',
      maxAlerts: 10000,
      retentionDays: 30,
      autoRetrain: false,
      retrainInterval: 24
    }
  })

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  const handleSave = () => {
    alert('Settings saved successfully!')
    // In a real implementation, this would send settings to the backend
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

        {/* Notifications */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Email Notifications</div>
                <div className="text-sm text-gray-500">Receive alerts via email</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) => handleSettingChange('notifications', 'email', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">SMS Notifications</div>
                <div className="text-sm text-gray-500">Receive alerts via SMS</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.sms}
                  onChange={(e) => handleSettingChange('notifications', 'sms', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Push Notifications</div>
                <div className="text-sm text-gray-500">Receive browser push notifications</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) => handleSettingChange('notifications', 'push', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Auto-Trigger Rules */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Auto-Trigger Rules</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Repeated Threats</div>
                <div className="text-sm text-gray-500">Alert on repeated threats from same source</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoTrigger.repeatedThreats}
                  onChange={(e) => handleSettingChange('autoTrigger', 'repeatedThreats', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">High Severity Alerts</div>
                <div className="text-sm text-gray-500">Auto-trigger on high/critical severity</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoTrigger.highSeverity}
                  onChange={(e) => handleSettingChange('autoTrigger', 'highSeverity', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Model Failure Alerts</div>
                <div className="text-sm text-gray-500">Alert when ML models fail</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoTrigger.modelFailure}
                  onChange={(e) => handleSettingChange('autoTrigger', 'modelFailure', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threat Threshold (count)
              </label>
              <input
                type="number"
                value={settings.autoTrigger.threshold}
                onChange={(e) => handleSettingChange('autoTrigger', 'threshold', parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
                min="1"
                max="10"
              />
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">System Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capture Interface
              </label>
              <input
                type="text"
                value={settings.system.captureInterface}
                onChange={(e) => handleSettingChange('system', 'captureInterface', e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="eth0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Alerts
              </label>
              <input
                type="number"
                value={settings.system.maxAlerts}
                onChange={(e) => handleSettingChange('system', 'maxAlerts', parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
                min="1000"
                max="100000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Retention (days)
              </label>
              <input
                type="number"
                value={settings.system.retentionDays}
                onChange={(e) => handleSettingChange('system', 'retentionDays', parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
                min="7"
                max="365"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Auto Retrain Models</div>
                <div className="text-sm text-gray-500">Automatically retrain models periodically</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.system.autoRetrain}
                  onChange={(e) => handleSettingChange('system', 'autoRetrain', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {settings.system.autoRetrain && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retrain Interval (hours)
                </label>
                <input
                  type="number"
                  value={settings.system.retrainInterval}
                  onChange={(e) => handleSettingChange('system', 'retrainInterval', parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                  max="168"
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings



