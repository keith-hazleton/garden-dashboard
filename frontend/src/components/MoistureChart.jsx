import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

function MoistureChart() {
  const [moistureSensors, setMoistureSensors] = useState([])
  const [tempSensors, setTempSensors] = useState([])
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

        // Split into moisture and temperature sensors
        const moistureSensorsList = sensorsList.filter(s => s.sensor_id.includes('moisture'))
        const tempSensorsList = sensorsList.filter(s => s.sensor_id.includes('temp'))

        if (moistureSensorsList.length === 0 && tempSensorsList.length === 0) {
          setLoading(false)
          return
        }

        setMoistureSensors(moistureSensorsList)
        setTempSensors(tempSensorsList)

        // Fetch history for all sensors
        const allSensors = [...moistureSensorsList, ...tempSensorsList]
        const historyPromises = allSensors.map(s =>
          fetch(`/api/sensors/history/${s.sensor_id}?hours=24`)
            .then(r => r.ok ? r.json() : [])
        )

        const histories = await Promise.all(historyPromises)

        // Combine data by timestamp
        const timeMap = new Map()

        histories.forEach((history, idx) => {
          const sensor = allSensors[idx]
          const isMoisture = idx < moistureSensorsList.length

          history.forEach(reading => {
            const time = new Date(reading.timestamp + 'Z').getTime()
            // Round to nearest 15 minutes for cleaner data
            const roundedTime = Math.round(time / (15 * 60 * 1000)) * (15 * 60 * 1000)

            if (!timeMap.has(roundedTime)) {
              timeMap.set(roundedTime, { timestamp: roundedTime })
            }
            timeMap.get(roundedTime)[sensor.sensor_id] = isMoisture
              ? reading.moisture_percent
              : reading.temperature_f
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

  if (moistureSensors.length === 0 && tempSensors.length === 0 || chartData.length === 0) {
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

  const tempSensorIds = new Set(tempSensors.map(s => s.sensor_id))

  return (
    <div className="chart-container">
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 60, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d4a36" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="#8a9e8f"
              fontSize={12}
              tick={{ fill: '#8a9e8f' }}
            />
            <YAxis
              yAxisId="moisture"
              domain={['auto', 'auto']}
              stroke="#8a9e8f"
              fontSize={12}
              tick={{ fill: '#8a9e8f' }}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              domain={['auto', 'auto']}
              stroke="#8a9e8f"
              fontSize={12}
              tick={{ fill: '#8a9e8f' }}
              tickFormatter={(value) => `${value}°F`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#162019',
                border: '1px solid #2d4a36',
                borderRadius: '0.5rem'
              }}
              labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
              formatter={(value, name, props) => {
                const isTempSensor = tempSensorIds.has(props.dataKey)
                return [`${value.toFixed(1)}${isTempSensor ? '°F' : '%'}`, name]
              }}
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

            {moistureSensors.map((sensor, idx) => (
              <Line
                key={sensor.sensor_id}
                yAxisId="moisture"
                type="monotone"
                dataKey={sensor.sensor_id}
                name={sensor.display_name || sensor.sensor_name}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}

            {tempSensors.map((sensor, idx) => (
              <Line
                key={sensor.sensor_id}
                yAxisId="temp"
                type="monotone"
                dataKey={sensor.sensor_id}
                name={sensor.display_name || sensor.sensor_name}
                stroke={COLORS[(moistureSensors.length + idx) % COLORS.length]}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        flexShrink: 0,
        justifyContent: 'center',
        gap: '1rem',
        marginTop: '0.5rem',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)'
      }}>
        <span><span style={{ color: 'var(--accent-red)' }}>—</span> Critical (&lt;20%)</span>
        <span><span style={{ color: 'var(--accent-yellow)' }}>—</span> Low (&lt;35%)</span>
        <span><span style={{ color: 'var(--accent-green)' }}>—</span> Good (35-70%)</span>
        <span><span style={{ color: 'var(--accent-blue)' }}>—</span> Saturated (&gt;70%)</span>
        <span style={{ borderLeft: '1px solid var(--text-secondary)', paddingLeft: '1rem' }}>
          <span style={{ borderBottom: '2px dashed var(--text-secondary)' }}>&nbsp;&nbsp;&nbsp;</span> Soil Temp (°F, right axis)
        </span>
      </div>
    </div>
  )
}

export default MoistureChart
