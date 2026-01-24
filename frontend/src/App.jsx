import { useState, useEffect } from 'react'
import SensorCards from './components/SensorCards'
import WeatherWidget from './components/WeatherWidget'
import WateringAdvice from './components/WateringAdvice'
import PlantingSchedule from './components/PlantingSchedule'
import PlantingCalendar from './components/PlantingCalendar'
import BedManager from './components/BedManager'
import TaskManager from './components/TaskManager'
import MoistureChart from './components/MoistureChart'

function App() {
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [watchedKey, setWatchedKey] = useState(0)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    setLastUpdated(new Date())

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1)
      setLastUpdated(new Date())
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
    setLastUpdated(new Date())
  }

  // Called when a plant is starred/unstarred
  const handleWatchChange = () => {
    setWatchedKey(k => k + 1)
  }

  return (
    <div className="app">
      <header>
        <h1>
          <span role="img" aria-label="plant">🌱</span>
          Garden Dashboard
        </h1>
        <div className="last-updated">
          {lastUpdated && (
            <>
              Updated: {lastUpdated.toLocaleTimeString()}
              <button
                className="btn btn-secondary"
                onClick={handleRefresh}
                style={{ marginLeft: '1rem' }}
              >
                Refresh
              </button>
              <button
                className="btn btn-secondary"
                onClick={toggleTheme}
                style={{ marginLeft: '0.5rem' }}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="dashboard">
        <div className="card sensors-grid">
          <div className="card-header">
            <h2 className="card-title">Soil Sensors</h2>
          </div>
          <SensorCards key={`sensors-${refreshKey}`} />
        </div>

        <div className="card weather-widget">
          <div className="card-header">
            <h2 className="card-title">Weather</h2>
          </div>
          <WeatherWidget key={`weather-${refreshKey}`} />
        </div>

        <div className="card watering-advice">
          <div className="card-header">
            <h2 className="card-title">Watering Recommendations</h2>
          </div>
          <WateringAdvice key={`watering-${refreshKey}`} />
        </div>

        <div className="card planting-schedule">
          <div className="card-header">
            <h2 className="card-title">Plants (Zone 10a)</h2>
          </div>
          <PlantingSchedule
            key={`planting-${refreshKey}`}
            onWatchChange={handleWatchChange}
          />
        </div>

        <div className="card planting-calendar">
          <div className="card-header">
            <h2 className="card-title">Planting Calendar</h2>
          </div>
          <PlantingCalendar key={`calendar-${refreshKey}-${watchedKey}`} />
        </div>

        <div className="card bed-manager">
          <div className="card-header">
            <h2 className="card-title">Bed Map & Companion Planting</h2>
          </div>
          <BedManager key={`beds-${refreshKey}`} watchedKey={watchedKey} />
        </div>

        <div className="card chart-section">
          <div className="card-header">
            <h2 className="card-title">Moisture History (24h)</h2>
          </div>
          <MoistureChart key={`chart-${refreshKey}`} />
        </div>

        <div className="card tasks-panel">
          <div className="card-header">
            <h2 className="card-title">Tasks</h2>
          </div>
          <TaskManager key={`tasks-${refreshKey}`} />
        </div>
      </div>
    </div>
  )
}

export default App
