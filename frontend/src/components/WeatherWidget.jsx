import { useState, useEffect } from 'react'

function WeatherIcon({ code, size = 64 }) {
  const s = size
  const isSmall = size <= 24

  // Cloud shape helper
  const Cloud = ({ x = 0, y = 0, scale = 1, className = '' }) => (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} className={className}>
      <circle cx="20" cy="18" r="10" fill="currentColor" opacity="0.9" />
      <circle cx="32" cy="14" r="12" fill="currentColor" opacity="0.9" />
      <circle cx="44" cy="18" r="10" fill="currentColor" opacity="0.9" />
      <rect x="16" y="18" width="32" height="10" rx="2" fill="currentColor" opacity="0.9" />
    </g>
  )

  // Clear / Sun (code 0)
  if (code === 0) {
    return (
      <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="12" fill="#facc15" />
        <g className="sun-rays" style={{ transformOrigin: '32px 32px' }} stroke="#facc15" strokeWidth="2.5" strokeLinecap="round">
          <line x1="32" y1="6" x2="32" y2="14" />
          <line x1="32" y1="50" x2="32" y2="58" />
          <line x1="6" y1="32" x2="14" y2="32" />
          <line x1="50" y1="32" x2="58" y2="32" />
          <line x1="13.6" y1="13.6" x2="19.3" y2="19.3" />
          <line x1="44.7" y1="44.7" x2="50.4" y2="50.4" />
          <line x1="13.6" y1="50.4" x2="19.3" y2="44.7" />
          <line x1="44.7" y1="19.3" x2="50.4" y2="13.6" />
        </g>
      </svg>
    )
  }

  // Partly cloudy (codes 1-3)
  if (code >= 1 && code <= 3) {
    return (
      <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
        <circle cx="24" cy="22" r="10" fill="#facc15" />
        <g stroke="#facc15" strokeWidth="2" strokeLinecap="round">
          <line x1="24" y1="6" x2="24" y2="10" />
          <line x1="10" y1="22" x2="6" y2="22" />
          <line x1="12" y1="10" x2="14.8" y2="12.8" />
          <line x1="36" y1="10" x2="33.2" y2="12.8" />
          <line x1="12" y1="34" x2="14.8" y2="31.2" />
        </g>
        <g className="cloud-drift" color="#cbd5e1">
          <Cloud x={4} y={20} scale={0.85} />
        </g>
      </svg>
    )
  }

  // Fog (codes 45-48)
  if (code >= 45 && code <= 48) {
    return (
      <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
        <g stroke="#94a3b8" strokeWidth="3" strokeLinecap="round">
          <line className="fog-line" x1="10" y1="22" x2="54" y2="22" />
          <line className="fog-line" x1="14" y1="32" x2="50" y2="32" />
          <line className="fog-line" x1="10" y1="42" x2="54" y2="42" />
        </g>
      </svg>
    )
  }

  // Drizzle (codes 51-57)
  if (code >= 51 && code <= 57) {
    return (
      <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
        <g color="#94a3b8">
          <Cloud x={2} y={4} scale={0.9} />
        </g>
        <g stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
          <line className="rain-drop" x1="20" y1="40" x2="18" y2="48" />
          <line className="rain-drop" x1="32" y1="42" x2="30" y2="50" />
          <line className="rain-drop" x1="44" y1="40" x2="42" y2="48" />
        </g>
      </svg>
    )
  }

  // Rain (codes 61-67)
  if (code >= 61 && code <= 67) {
    return (
      <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
        <g color="#94a3b8">
          <Cloud x={2} y={2} scale={0.9} />
        </g>
        <g stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round">
          <line className="rain-drop" x1="18" y1="38" x2="15" y2="48" />
          <line className="rain-drop" x1="28" y1="40" x2="25" y2="50" />
          <line className="rain-drop" x1="38" y1="38" x2="35" y2="48" />
          <line className="rain-drop" x1="48" y1="40" x2="45" y2="50" />
        </g>
      </svg>
    )
  }

  // Snow (codes 71-77)
  if (code >= 71 && code <= 77) {
    return (
      <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
        <g color="#94a3b8">
          <Cloud x={2} y={2} scale={0.9} />
        </g>
        <g fill="#e2e8f0">
          <circle className="snow-flake" cx="20" cy="42" r="3" />
          <circle className="snow-flake" cx="34" cy="46" r="2.5" />
          <circle className="snow-flake" cx="46" cy="42" r="3" />
        </g>
      </svg>
    )
  }

  // Mixed precipitation (codes 80-86)
  if (code >= 80 && code <= 86) {
    return (
      <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
        <g color="#94a3b8">
          <Cloud x={2} y={2} scale={0.9} />
        </g>
        <g stroke="#3b82f6" strokeWidth="2" strokeLinecap="round">
          <line className="rain-drop" x1="18" y1="38" x2="16" y2="46" />
          <line className="rain-drop" x1="38" y1="38" x2="36" y2="46" />
        </g>
        <g fill="#e2e8f0">
          <circle className="snow-flake" cx="28" cy="44" r="2.5" />
          <circle className="snow-flake" cx="48" cy="44" r="2.5" />
        </g>
      </svg>
    )
  }

  // Thunderstorm (codes 95+)
  return (
    <svg className="weather-svg-icon" width={s} height={s} viewBox="0 0 64 64" fill="none">
      <g color="#64748b">
        <Cloud x={2} y={2} scale={0.9} />
      </g>
      <polygon
        className="lightning-bolt"
        points="30,30 35,30 32,40 38,40 28,56 31,44 26,44"
        fill="#facc15"
      />
      <g stroke="#3b82f6" strokeWidth="2" strokeLinecap="round">
        <line className="rain-drop" x1="16" y1="38" x2="14" y2="46" />
        <line className="rain-drop" x1="48" y1="38" x2="46" y2="46" />
      </g>
    </svg>
  )
}

function formatDay(dateStr) {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function WeatherWidget() {
  const [current, setCurrent] = useState(null)
  const [forecast, setForecast] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchWeather() {
      try {
        const [currentRes, forecastRes] = await Promise.all([
          fetch('/api/weather/current'),
          fetch('/api/weather/forecast')
        ])

        if (!currentRes.ok || !forecastRes.ok) {
          throw new Error('Failed to fetch weather')
        }

        const currentData = await currentRes.json()
        const forecastData = await forecastRes.json()

        setCurrent(currentData)
        setForecast(forecastData.forecast || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading weather...
      </div>
    )
  }

  if (error) {
    return <div className="empty-state">Could not load weather data</div>
  }

  return (
    <div>
      {current && (
        <>
          <div className="current-weather">
            <WeatherIcon code={current.weather_code} size={64} />
            <div>
              <div className="weather-temp">{Math.round(current.temperature)}°F</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {current.weather_description}
              </div>
            </div>
          </div>

          <div className="weather-details">
            <div>Feels like: {Math.round(current.feels_like)}°F</div>
            <div>Humidity: {current.humidity}%</div>
            <div>Wind: {Math.round(current.wind_speed)} mph</div>
            <div>Precip: {current.precipitation}"</div>
          </div>
        </>
      )}

      <div style={{ marginTop: '1rem' }}>
        {forecast.map(day => (
          <div key={day.date} className="forecast-row">
            <span className="forecast-day">{formatDay(day.date)}</span>
            <WeatherIcon code={day.weather_code} size={24} />
            <span className="forecast-temps">
              <span>{Math.round(day.temp_high)}°</span>
              <span style={{ marginLeft: '0.25rem' }}>{Math.round(day.temp_low)}°</span>
            </span>
            <span style={{
              fontSize: '0.75rem',
              color: day.precipitation_probability > 0 ? 'var(--accent-cyan)' : 'transparent',
              minWidth: '2rem',
              textAlign: 'right'
            }}>
              {day.precipitation_probability > 0 ? `${day.precipitation_probability}%` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WeatherWidget
