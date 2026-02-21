import { useState, useEffect } from 'react'

function getWeatherIcon(code) {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌧️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 86) return '🌨️'
  return '⛈️'
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
            <span className="weather-icon">
              {getWeatherIcon(current.weather_code)}
            </span>
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
            <span>{getWeatherIcon(day.weather_code)}</span>
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
