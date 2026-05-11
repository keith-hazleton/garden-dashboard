import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MOISTURE_COLORS = ['#22c55e', '#16a34a', '#84cc16', '#65a30d']
const TEMP_COLOR = '#f97316'
const EC_COLOR = '#8b5cf6'

const SELECTED_BED_KEY = 'historyChartSelectedBedId'

function MoistureChart() {
  const [beds, setBeds] = useState([])
  const [selectedBedId, setSelectedBedId] = useState(() => {
    const saved = localStorage.getItem(SELECTED_BED_KEY)
    return saved ? parseInt(saved) : null
  })
  const [moistureSensors, setMoistureSensors] = useState([])
  const [tempSensor, setTempSensor] = useState(null)
  const [ecSensor, setEcSensor] = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load beds list once
  useEffect(() => {
    async function fetchBeds() {
      try {
        const res = await fetch('/api/beds')
        if (!res.ok) throw new Error('Failed to fetch beds')
        const bedsList = await res.json()
        setBeds(bedsList)
        // Default selection: saved bed if still exists, else first bed
        if (bedsList.length > 0) {
          const savedExists = selectedBedId && bedsList.some(b => b.id === selectedBedId)
          if (!savedExists) {
            setSelectedBedId(bedsList[0].id)
          }
        } else {
          setLoading(false)
        }
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    fetchBeds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch data for selected bed
  useEffect(() => {
    if (!selectedBedId) return

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const bedRes = await fetch(`/api/beds/${selectedBedId}`)
        if (!bedRes.ok) throw new Error('Failed to fetch bed')
        const bed = await bedRes.json()

        const sensorsRes = await fetch('/api/sensors')
        if (!sensorsRes.ok) throw new Error('Failed to fetch sensors')
        const sensorsList = await sensorsRes.json()
        const sensorById = new Map(sensorsList.map(s => [s.sensor_id, s]))

        const moistureIds = Array.isArray(bed.sensor_ids) ? bed.sensor_ids : []
        const tempId = bed.temp_sensor_id || null
        const ecId = bed.ec_sensor_id || null

        const moistureList = moistureIds
          .map(id => sensorById.get(id) || { sensor_id: id, sensor_name: id, display_name: id })
        const tempObj = tempId
          ? (sensorById.get(tempId) || { sensor_id: tempId, sensor_name: tempId, display_name: tempId })
          : null
        const ecObj = ecId
          ? (sensorById.get(ecId) || { sensor_id: ecId, sensor_name: ecId, display_name: ecId })
          : null

        setMoistureSensors(moistureList)
        setTempSensor(tempObj)
        setEcSensor(ecObj)

        const allIds = [
          ...moistureList.map(s => ({ id: s.sensor_id, kind: 'moisture' })),
          ...(tempObj ? [{ id: tempObj.sensor_id, kind: 'temp' }] : []),
          ...(ecObj ? [{ id: ecObj.sensor_id, kind: 'ec' }] : [])
        ]

        if (allIds.length === 0) {
          setChartData([])
          setLoading(false)
          return
        }

        const histories = await Promise.all(
          allIds.map(({ id }) =>
            fetch(`/api/sensors/history/${id}?hours=24`).then(r => r.ok ? r.json() : [])
          )
        )

        const timeMap = new Map()
        histories.forEach((history, idx) => {
          const { id, kind } = allIds[idx]
          history.forEach(reading => {
            const time = new Date(reading.timestamp + 'Z').getTime()
            const roundedTime = Math.round(time / (15 * 60 * 1000)) * (15 * 60 * 1000)
            if (!timeMap.has(roundedTime)) {
              timeMap.set(roundedTime, { timestamp: roundedTime })
            }
            const value = kind === 'moisture'
              ? reading.moisture_percent
              : kind === 'temp'
                ? reading.temperature_f
                : reading.ec_us_cm
            if (value != null) {
              timeMap.get(roundedTime)[id] = value
            }
          })
        })

        const data = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp)
        setChartData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedBedId])

  const handleBedChange = (e) => {
    const id = parseInt(e.target.value)
    setSelectedBedId(id)
    localStorage.setItem(SELECTED_BED_KEY, String(id))
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const selectedBed = beds.find(b => b.id === selectedBedId)
  const tempSensorId = tempSensor?.sensor_id
  const ecSensorId = ecSensor?.sensor_id

  const formatValue = (value, key) => {
    if (key === tempSensorId) return [`${value.toFixed(1)}°F`, tempSensor.display_name || tempSensor.sensor_name]
    if (key === ecSensorId) return [`${Math.round(value)} µS/cm`, ecSensor.display_name || ecSensor.sensor_name]
    const ms = moistureSensors.find(s => s.sensor_id === key)
    return [`${value.toFixed(1)}%`, ms ? (ms.display_name || ms.sensor_name) : key]
  }

  const bedSelector = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0 0 0.5rem 0',
      flexShrink: 0
    }}>
      <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Bed:</label>
      <select
        value={selectedBedId || ''}
        onChange={handleBedChange}
        style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '0.25rem',
          backgroundColor: 'var(--bg-secondary, #162019)',
          color: 'var(--text-primary, #e5e7eb)',
          border: '1px solid var(--border, #2d4a36)',
          fontSize: '0.875rem'
        }}
      >
        {beds.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  )

  if (loading) {
    return (
      <div className="chart-container">
        {beds.length > 0 && bedSelector}
        <div className="loading">
          <div className="spinner"></div>
          Loading chart data...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="chart-container">
        {beds.length > 0 && bedSelector}
        <div className="empty-state">Error loading chart: {error}</div>
      </div>
    )
  }

  if (beds.length === 0) {
    return (
      <div className="empty-state">
        <p>No beds configured yet.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Add a bed in Bed Manager to see history.
        </p>
      </div>
    )
  }

  const hasAnySensor = moistureSensors.length > 0 || tempSensor || ecSensor

  return (
    <div className="chart-container">
      {bedSelector}

      {!hasAnySensor ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <p>No sensors linked to {selectedBed?.name || 'this bed'}.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Assign sensors in Bed Manager to see history.
          </p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <p>No historical data available yet for {selectedBed?.name || 'this bed'}.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Chart will populate as sensor readings are collected.
          </p>
        </div>
      ) : (
        <>
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
                {/* EC axis is hidden to avoid clutter, but values still appear in tooltip */}
                <YAxis
                  yAxisId="ec"
                  orientation="right"
                  domain={['auto', 'auto']}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#162019',
                    border: '1px solid #2d4a36',
                    borderRadius: '0.5rem'
                  }}
                  labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                  formatter={(value, name, props) => formatValue(value, props.dataKey)}
                />
                <Legend />

                {moistureSensors.map((sensor, idx) => (
                  <Line
                    key={sensor.sensor_id}
                    yAxisId="moisture"
                    type="monotone"
                    dataKey={sensor.sensor_id}
                    name={sensor.display_name || sensor.sensor_name}
                    stroke={MOISTURE_COLORS[idx % MOISTURE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}

                {tempSensor && (
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey={tempSensor.sensor_id}
                    name={tempSensor.display_name || tempSensor.sensor_name}
                    stroke={TEMP_COLOR}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                )}

                {ecSensor && (
                  <Line
                    yAxisId="ec"
                    type="monotone"
                    dataKey={ecSensor.sensor_id}
                    name={ecSensor.display_name || ecSensor.sensor_name}
                    stroke={EC_COLOR}
                    strokeWidth={2}
                    strokeDasharray="2 4"
                    dot={false}
                    connectNulls
                  />
                )}
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
            <span><span style={{ color: 'var(--accent-green)' }}>—</span> Good (35–70%)</span>
            <span><span style={{ color: 'var(--accent-blue)' }}>—</span> Saturated (&gt;70%)</span>
            {tempSensor && (
              <span style={{ borderLeft: '1px solid var(--text-secondary)', paddingLeft: '1rem' }}>
                <span style={{ color: TEMP_COLOR }}>– –</span> Soil Temp (°F, right axis)
              </span>
            )}
            {ecSensor && (
              <span style={{ borderLeft: '1px solid var(--text-secondary)', paddingLeft: '1rem' }}>
                <span style={{ color: EC_COLOR }}>· ·</span> Soil EC (µS/cm, hover for value)
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MoistureChart
