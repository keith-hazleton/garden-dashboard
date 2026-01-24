import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

function MoistureChart() {
  const [sensors, setSensors] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // First get list of sensors
        const sensorsRes = await fetch('/api/sensors')
        if (!sensorsRes.ok) throw new Error('Failed to fetch sensors')
        const sensorsList = await sensorsRes.json()

        if (sensorsList.length === 0) {
          setLoading(false)
          return
        }

        setSensors(sensorsList)

        // Fetch history for each sensor
        const historyPromises = sensorsList.map(s =>
          fetch(`/api/sensors/history/${s.sensor_id}?hours=24`)
            .then(r => r.ok ? r.json() : [])
        )

        const histories = await Promise.all(historyPromises)

        // Combine data by timestamp
        const timeMap = new Map()

        histories.forEach((history, idx) => {
          const sensorId = sensorsList[idx].sensor_id
          history.forEach(reading => {
            const time = new Date(reading.timestamp).getTime()
            // Round to nearest 15 minutes for cleaner data
            const roundedTime = Math.round(time / (15 * 60 * 1000)) * (15 * 60 * 1000)

            if (!timeMap.has(roundedTime)) {
              timeMap.set(roundedTime, { timestamp: roundedTime })
            }
            timeMap.get(roundedTime)[sensorId] = reading.moisture_percent
          })
        })

        // Convert to array and sort by time
        const data = Array.from(timeMap.values())
          .sort((a, b) => a.timestamp - b.timestamp)

        setChartData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading chart data...
      </div>
    )
  }

  if (error) {
    return <div className="empty-state">Error loading chart: {error}</div>
  }

  if (sensors.length === 0 || chartData.length === 0) {
    return (
      <div className="empty-state">
        <p>No historical data available yet.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Chart will populate as sensor readings are collected.
        </p>
      </div>
    )
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            stroke="#94a3b8"
            fontSize={12}
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#94a3b8"
            fontSize={12}
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '0.5rem'
            }}
            labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
            formatter={(value) => [`${value.toFixed(1)}%`, '']}
          />
          <Legend />

          {/* Reference lines for moisture zones */}
          <CartesianGrid
            y={20}
            stroke="#ef4444"
            strokeDasharray="5 5"
            horizontal={false}
          />
          <CartesianGrid
            y={35}
            stroke="#eab308"
            strokeDasharray="5 5"
            horizontal={false}
          />

          {sensors.map((sensor, idx) => (
            <Line
              key={sensor.sensor_id}
              type="monotone"
              dataKey={sensor.sensor_id}
              name={sensor.sensor_name}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '1.5rem',
        marginTop: '0.5rem',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)'
      }}>
        <span><span style={{ color: 'var(--accent-red)' }}>—</span> Critical (&lt;20%)</span>
        <span><span style={{ color: 'var(--accent-yellow)' }}>—</span> Low (&lt;35%)</span>
        <span><span style={{ color: 'var(--accent-green)' }}>—</span> Good (35-70%)</span>
        <span><span style={{ color: 'var(--accent-blue)' }}>—</span> Saturated (&gt;70%)</span>
      </div>
    </div>
  )
}

export default MoistureChart
