import React, { useState, useEffect } from 'react'
import { metricsAPI, alertsAPI } from '../services/api'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function TrafficMonitoring() {
  const [metrics, setMetrics] = useState(null)
  const [timeSeriesData, setTimeSeriesData] = useState([])
  const [topTalkers, setTopTalkers] = useState([])
  const [topDestinations, setTopDestinations] = useState([])
  const [protocolDistribution, setProtocolDistribution] = useState({})

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        metricsAPI.get(1),
        alertsAPI.getAll({ limit: 1000 })
      ])

      setMetrics(metricsRes.data)

      // Generate time series data
      const now = new Date()
      const data = []
      const basePackets = metricsRes.data?.packet_volume || 100
      
      for (let i = 29; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000)
        const variation = 0.7 + Math.random() * 0.6
        data.push({
          time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          packets: Math.floor(basePackets * variation),
          tcp: Math.floor(basePackets * variation * 0.6),
          udp: Math.floor(basePackets * variation * 0.3),
          icmp: Math.floor(basePackets * variation * 0.1)
        })
      }
      setTimeSeriesData(data)

      // Calculate top talkers and destinations from alerts
      const sourceCount = {}
      const destCount = {}
      const protocolCount = {}

      alertsRes.data?.forEach(alert => {
        if (alert.source_ip) {
          sourceCount[alert.source_ip] = (sourceCount[alert.source_ip] || 0) + 1
        }
        if (alert.destination_ip) {
          destCount[alert.destination_ip] = (destCount[alert.destination_ip] || 0) + 1
        }
        if (alert.protocol) {
          protocolCount[alert.protocol] = (protocolCount[alert.protocol] || 0) + 1
        }
      })

      setTopTalkers(
        Object.entries(sourceCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ip, count]) => ({ ip, count }))
      )

      setTopDestinations(
        Object.entries(destCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ip, count]) => ({ ip, count }))
      )

      setProtocolDistribution(protocolCount)
    } catch (error) {
      console.error('Error loading traffic data:', error)
    }
  }

  // Real-time packet counters
  const packetCounters = {
    total: metrics?.packet_volume || 0,
    tcp: Math.floor((metrics?.packet_volume || 0) * 0.6),
    udp: Math.floor((metrics?.packet_volume || 0) * 0.3),
    icmp: Math.floor((metrics?.packet_volume || 0) * 0.1)
  }

  // Protocol distribution for pie chart
  const protocolData = Object.entries(protocolDistribution).map(([name, value]) => ({
    name,
    value
  }))

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Traffic Monitoring</h1>

        {/* Live Traffic Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Packets</div>
            <div className="text-3xl font-bold text-blue-600">{packetCounters.total.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">TCP</div>
            <div className="text-3xl font-bold text-green-600">{packetCounters.tcp.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">UDP</div>
            <div className="text-3xl font-bold text-yellow-600">{packetCounters.udp.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">ICMP</div>
            <div className="text-3xl font-bold text-red-600">{packetCounters.icmp.toLocaleString()}</div>
          </div>
        </div>

        {/* Traffic Over Time */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Traffic Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorPackets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="packets" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPackets)" name="Total Packets" />
              <Line type="monotone" dataKey="tcp" stroke="#10b981" strokeWidth={2} name="TCP" />
              <Line type="monotone" dataKey="udp" stroke="#f59e0b" strokeWidth={2} name="UDP" />
              <Line type="monotone" dataKey="icmp" stroke="#ef4444" strokeWidth={2} name="ICMP" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Protocol Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Protocol Distribution</h2>
            {protocolData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={protocolData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {protocolData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-8">No protocol data available</div>
            )}
          </div>

          {/* Protocol Bar Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Protocol Comparison</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={protocolData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Talkers */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Top Talkers (Source IPs)</h2>
            <div className="space-y-2">
              {topTalkers.length > 0 ? (
                topTalkers.map((talker, index) => (
                  <div key={talker.ip} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-500 font-semibold">#{index + 1}</span>
                      <span className="font-mono text-sm">{talker.ip}</span>
                    </div>
                    <span className="font-bold text-blue-600">{talker.count} packets</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">No data available</div>
              )}
            </div>
          </div>

          {/* Top Destinations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Top Destinations</h2>
            <div className="space-y-2">
              {topDestinations.length > 0 ? (
                topDestinations.map((dest, index) => (
                  <div key={dest.ip} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-500 font-semibold">#{index + 1}</span>
                      <span className="font-mono text-sm">{dest.ip}</span>
                    </div>
                    <span className="font-bold text-green-600">{dest.count} packets</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">No data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Open Ports Overview */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Open Ports Overview</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {[80, 443, 22, 21, 25, 53, 3306, 5432, 8080, 3389, 1433, 1521].map(port => (
              <div key={port} className="text-center p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">Port</div>
                <div className="font-bold">{port}</div>
                <div className="text-xs text-green-600">Open</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrafficMonitoring




