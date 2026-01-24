import { useState, useEffect } from 'react'

function WateringAdvice() {
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAdvice() {
      try {
        const response = await fetch('/api/weather/watering-advice')
        if (!response.ok) throw new Error('Failed to fetch advice')
        const data = await response.json()
        setAdvice(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAdvice()
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Analyzing conditions...
      </div>
    )
  }

  if (error) {
    return <div className="empty-state">Could not generate watering advice</div>
  }

  if (!advice) {
    return <div className="empty-state">No data available</div>
  }

  const { sensors, forecast_summary, overall_advice } = advice

  // Determine banner type
  let bannerType = 'normal'
  if (forecast_summary.total_expected_rain > 0.25 || forecast_summary.max_rain_probability > 50) {
    bannerType = 'rain'
  } else if (forecast_summary.max_temperature > 90) {
    bannerType = 'hot'
  }

  return (
    <div>
      <div className={`advice-banner ${bannerType}`}>
        {overall_advice}
      </div>

      {forecast_summary && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          <strong>3-Day Forecast:</strong>{' '}
          {forecast_summary.total_expected_rain.toFixed(2)}" rain expected
          {forecast_summary.max_rain_probability > 0 && ` (${forecast_summary.max_rain_probability}% chance)`}
          {' · '}High of {forecast_summary.max_temperature}°F
        </div>
      )}

      {sensors && sensors.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sensors.map(sensor => (
            <div
              key={sensor.sensor_id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--bg-card)',
                borderRadius: '0.375rem'
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{sensor.sensor_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {sensor.advice}
                </div>
              </div>
              <div style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 500,
                background: sensor.status === 'critical' ? 'var(--accent-red)' :
                           sensor.status === 'low' ? 'var(--accent-yellow)' :
                           sensor.status === 'saturated' ? 'var(--accent-blue)' :
                           'var(--accent-green)',
                color: sensor.status === 'low' ? '#000' : '#fff'
              }}>
                {sensor.moisture_percent}%
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Connect soil sensors to get personalized watering recommendations.
        </div>
      )}
    </div>
  )
}

export default WateringAdvice
