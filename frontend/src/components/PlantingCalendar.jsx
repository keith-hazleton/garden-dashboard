import { useState, useEffect } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Colors for different window types - text colors are theme-aware via CSS variables
const WINDOW_COLORS = {
  indoor_start: { bg: 'rgba(139, 92, 246, 0.3)', border: '#a78bfa', textVar: '--calendar-text-purple' },
  transplant: { bg: 'rgba(34, 197, 94, 0.3)', border: '#86efac', textVar: '--calendar-text-green' },
  direct_sow: { bg: 'rgba(59, 130, 246, 0.3)', border: '#93c5fd', textVar: '--calendar-text-blue' }
}

function PlantingCalendar() {
  const [calendarData, setCalendarData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [view, setView] = useState('agenda') // 'agenda' or 'timeline'

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const response = await fetch('/api/plants/calendar/year')
        if (!response.ok) throw new Error('Failed to fetch calendar')
        const data = await response.json()
        setCalendarData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCalendar()
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading calendar...
      </div>
    )
  }

  if (error) {
    return <div className="empty-state">Could not load calendar</div>
  }

  if (!calendarData || calendarData.watched_count === 0) {
    return (
      <div className="empty-state">
        <p>No plants on your calendar yet.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
          Star plants in "Plant Now" to add them to your calendar.
        </p>
      </div>
    )
  }

  const windowLabels = {
    indoor_start: 'Start Indoors',
    transplant: 'Transplant',
    direct_sow: 'Direct Sow'
  }

  // Check if a month is within a window (handling year wrap)
  const isMonthInWindow = (month, startMonth, endMonth) => {
    if (startMonth <= endMonth) {
      return month >= startMonth && month <= endMonth
    }
    return month >= startMonth || month <= endMonth
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button
            className={`tab ${view === 'agenda' ? 'active' : ''}`}
            onClick={() => setView('agenda')}
          >
            Agenda
          </button>
          <button
            className={`tab ${view === 'timeline' ? 'active' : ''}`}
            onClick={() => setView('timeline')}
          >
            Timeline
          </button>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {calendarData.watched_count} plant{calendarData.watched_count !== 1 ? 's' : ''} tracked
        </span>
      </div>

      {view === 'agenda' && (
        <div>
          {/* Month selector */}
          <div style={{
            display: 'flex',
            gap: '0.25rem',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}>
            {MONTHS.map((month, idx) => {
              const monthNum = idx + 1
              const hasEvents = calendarData.agenda[monthNum]?.events.length > 0
              const isCurrent = monthNum === new Date().getMonth() + 1

              return (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(monthNum)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    border: selectedMonth === monthNum ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    borderRadius: '0.25rem',
                    background: selectedMonth === monthNum ? 'var(--accent-blue)' : 'var(--bg-card)',
                    color: selectedMonth === monthNum ? 'white' : hasEvents ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: isCurrent ? 600 : 400,
                    opacity: hasEvents ? 1 : 0.5
                  }}
                >
                  {month}
                </button>
              )
            })}
          </div>

          {/* Events for selected month */}
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {calendarData.agenda[selectedMonth]?.events.length > 0 ? (
              calendarData.agenda[selectedMonth].events.map((event, idx) => {
                const colors = WINDOW_COLORS[event.window_type] || WINDOW_COLORS.direct_sow
                return (
                  <div
                    key={`${event.plant_id}-${event.window_type}-${idx}`}
                    style={{
                      padding: '0.5rem 0.75rem',
                      marginBottom: '0.5rem',
                      background: colors.bg,
                      borderLeft: `3px solid ${colors.border}`,
                      borderRadius: '0 0.25rem 0.25rem 0'
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {event.plant_name}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: `var(${colors.textVar})`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '0.25rem'
                    }}>
                      <span>{windowLabels[event.window_type]}</span>
                      <span>
                        {MONTHS[event.start_month - 1]} {event.start_day} - {MONTHS[event.end_month - 1]} {event.end_day}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                No planting activities for {MONTHS[selectedMonth - 1]}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'timeline' && (
        <div style={{ overflowX: 'auto' }}>
          {/* Month headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 1fr) repeat(12, 40px)',
            gap: '2px',
            fontSize: '0.625rem',
            marginBottom: '0.5rem'
          }}>
            <div></div>
            {MONTHS.map((month, idx) => (
              <div
                key={month}
                style={{
                  textAlign: 'center',
                  fontWeight: idx === new Date().getMonth() ? 600 : 400,
                  color: idx === new Date().getMonth() ? 'var(--accent-blue)' : 'var(--text-secondary)'
                }}
              >
                {month}
              </div>
            ))}
          </div>

          {/* Plant rows */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {/* Group events by plant */}
            {Object.entries(
              calendarData.events.reduce((acc, event) => {
                const key = `${event.plant_id}-${event.plant_name}`
                if (!acc[key]) acc[key] = { name: event.plant_name, windows: [] }
                acc[key].windows.push(event)
                return acc
              }, {})
            ).map(([key, plant]) => (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) repeat(12, 40px)',
                  gap: '2px',
                  marginBottom: '4px',
                  alignItems: 'center'
                }}
              >
                <div style={{
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingRight: '0.5rem'
                }}>
                  {plant.name}
                </div>
                {MONTHS.map((_, monthIdx) => {
                  const monthNum = monthIdx + 1
                  // Find windows that include this month
                  const activeWindows = plant.windows.filter(w =>
                    isMonthInWindow(monthNum, w.start_month, w.end_month)
                  )

                  if (activeWindows.length === 0) {
                    return (
                      <div
                        key={monthIdx}
                        style={{
                          height: '20px',
                          background: 'var(--bg-card)',
                          borderRadius: '2px'
                        }}
                      />
                    )
                  }

                  // Show the first window type (could stack if multiple)
                  const window = activeWindows[0]
                  const colors = WINDOW_COLORS[window.window_type] || WINDOW_COLORS.direct_sow

                  return (
                    <div
                      key={monthIdx}
                      title={`${windowLabels[window.window_type]}`}
                      style={{
                        height: '20px',
                        background: colors.bg,
                        borderRadius: '2px',
                        border: `1px solid ${colors.border}`
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '1rem',
            fontSize: '0.625rem',
            color: 'var(--text-secondary)'
          }}>
            {Object.entries(WINDOW_COLORS).map(([type, colors]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '2px'
                }} />
                <span>{windowLabels[type]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlantingCalendar
