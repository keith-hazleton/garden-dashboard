import { useState, useEffect } from 'react'

function getMoistureStatus(percent) {
  if (percent < 20) return 'critical'
  if (percent < 35) return 'low'
  if (percent > 70) return 'saturated'
  return 'good'
}

function SensorCards() {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchSensors() {
      try {
        const response = await fetch('/api/sensors/latest')
        if (!response.ok) throw new Error('Failed to fetch sensors')
        const data = await response.json()
        setSensors(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSensors()
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading sensors...
      </div>
    )
  }

  if (error) {
    return <div className="empty-state">Error: {error}</div>
  }

  if (sensors.length === 0) {
    return (
      <div className="empty-state">
        <p>No sensor data yet.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Configure your Ecowitt GW2000 to POST to:<br />
          <code>http://[pi-ip]:3000/api/sensors/ecowitt</code>
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
      {sensors.map(sensor => {
        const status = getMoistureStatus(sensor.moisture_percent)
        const batteryLow = sensor.battery_status === '0' || sensor.battery_status === 'low'

        return (
          <div key={sensor.sensor_id} className="sensor-card">
            <div className="sensor-header">
              <span className="sensor-name">{sensor.sensor_name}</span>
              <span className={`battery-indicator ${batteryLow ? 'low' : ''}`}>
                {batteryLow ? 'Low' : 'OK'}
              </span>
            </div>

            <div className={`moisture-value ${status}`}>
              {Math.round(sensor.moisture_percent)}%
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {status === 'critical' && 'Needs water!'}
              {status === 'low' && 'Getting dry'}
              {status === 'good' && 'Good moisture'}
              {status === 'saturated' && 'Very wet'}
            </div>

            <div className="moisture-bar">
              <div
                className={`moisture-bar-fill ${status}`}
                style={{ width: `${Math.min(100, sensor.moisture_percent)}%` }}
              />
            </div>

            <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              {new Date(sensor.timestamp).toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SensorCards
