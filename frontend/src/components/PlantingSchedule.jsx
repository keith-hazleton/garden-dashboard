import { useState, useEffect, useCallback } from 'react'

function PlantingSchedule({ onWatchChange }) {
  const [plants, setPlants] = useState([])
  const [allPlants, setAllPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  const fetchPlants = useCallback(async () => {
    try {
      const [nowRes, allRes] = await Promise.all([
        fetch('/api/plants/plant-now'),
        fetch('/api/plants')
      ])
      if (!nowRes.ok || !allRes.ok) throw new Error('Failed to fetch plants')
      const nowData = await nowRes.json()
      const allData = await allRes.json()
      setPlants(nowData)
      setAllPlants(allData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlants()
  }, [fetchPlants])

  const toggleWatch = async (plantId, e) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/plants/${plantId}/watch`, { method: 'POST' })
      if (!response.ok) throw new Error('Failed to update')
      fetchPlants()
      if (onWatchChange) onWatchChange()
    } catch (err) {
      console.error('Failed to toggle watch:', err)
    }
  }

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const expandAll = () => setCollapsed({})
  const collapseAll = (keys) => {
    const allCollapsed = {}
    keys.forEach(k => allCollapsed[k] = true)
    setCollapsed(allCollapsed)
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading planting schedule...
      </div>
    )
  }

  if (error) {
    return <div className="empty-state">Could not load planting schedule</div>
  }

  const displayPlants = showAll ? allPlants : plants

  if (displayPlants.length === 0) {
    return (
      <div className="empty-state">
        {showAll ? 'No plants in database.' : 'No plants to sow/transplant this month for zone 10b.'}
        <button
          className="btn btn-secondary"
          onClick={() => setShowAll(!showAll)}
          style={{ marginTop: '0.5rem' }}
        >
          {showAll ? 'Show current month' : 'Show all plants'}
        </button>
      </div>
    )
  }

  // Group by window type (for current month view) or category (for all plants view)
  const grouped = displayPlants.reduce((acc, plant) => {
    const key = showAll ? plant.category : plant.window_type
    if (!acc[key]) acc[key] = []
    // Avoid duplicates in the same group
    if (!acc[key].find(p => p.id === plant.id)) {
      acc[key].push(plant)
    }
    return acc
  }, {})

  const windowLabels = {
    indoor_start: 'Start Indoors',
    transplant: 'Transplant',
    direct_sow: 'Direct Sow'
  }

  const categoryLabels = {
    vegetable: 'Vegetables',
    herb: 'Herbs',
    fruit: 'Fruits',
    flower: 'Flowers',
    cover_crop: 'Cover Crops'
  }

  const labels = showAll ? categoryLabels : windowLabels

  // Define sort order
  const sortOrder = showAll
    ? ['vegetable', 'herb', 'fruit', 'flower', 'cover_crop']
    : ['indoor_start', 'transplant', 'direct_sow']

  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    return sortOrder.indexOf(a[0]) - sortOrder.indexOf(b[0])
  })

  const groupKeys = sortedGroups.map(([key]) => key)
  const allCollapsed = groupKeys.every(k => collapsed[k])

  return (
    <div className="plant-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <button
            className={`tab ${!showAll ? 'active' : ''}`}
            onClick={() => { setShowAll(false); setCollapsed({}) }}
          >
            Plant Now
          </button>
          <button
            className={`tab ${showAll ? 'active' : ''}`}
            onClick={() => { setShowAll(true); setCollapsed({}) }}
          >
            All Plants
          </button>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => allCollapsed ? expandAll() : collapseAll(groupKeys)}
          style={{ fontSize: '0.625rem', padding: '0.25rem 0.5rem' }}
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sortedGroups.map(([groupKey, plantList]) => {
          const isCollapsed = collapsed[groupKey]

          return (
            <div key={groupKey} style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => toggleCollapse(groupKey)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-card)',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  color: 'var(--text-primary)'
                }}
              >
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em'
                }}>
                  {labels[groupKey] || groupKey}
                  <span style={{
                    marginLeft: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 400
                  }}>
                    ({plantList.length})
                  </span>
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  transition: 'transform 0.2s',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                }}>
                  ▼
                </span>
              </button>

              {!isCollapsed && (
                <div style={{ paddingTop: '0.25rem' }}>
                  {plantList.map(plant => (
                    <div key={plant.id} className="plant-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={(e) => toggleWatch(plant.id, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: 0,
                            opacity: plant.watched ? 1 : 0.4,
                            color: plant.watched ? '#fbbf24' : 'var(--text-secondary)'
                          }}
                          title={plant.watched ? 'Remove from calendar' : 'Add to calendar'}
                        >
                          {plant.watched ? '★' : '☆'}
                        </button>
                        <div>
                          <div className="plant-name">{plant.name}</div>
                          {plant.variety && (
                            <div className="plant-variety">{plant.variety}</div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!showAll && plant.window_type && (
                          <span className={`window-badge ${plant.window_type}`}>
                            {plant.days_to_maturity && `${plant.days_to_maturity}d`}
                          </span>
                        )}
                        {showAll && plant.days_to_maturity && (
                          <span className="window-badge">
                            {plant.days_to_maturity}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)'
      }}>
        Click ★ to add plants to your calendar. Based on Zone 10b.
      </div>
    </div>
  )
}

export default PlantingSchedule
