import { useState, useEffect } from 'react'

const WATER_COLORS = {
  high: '#3b82f6',    // blue
  medium: '#22c55e',  // green
  low: '#eab308'      // yellow
}

function BedGrid({ bed, onUpdate }) {
  const [plants, setPlants] = useState([])
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPlantPicker, setShowPlantPicker] = useState(false)
  const [targetCell, setTargetCell] = useState(null)
  const [companionInfo, setCompanionInfo] = useState(null)
  const [draggedPlacement, setDraggedPlacement] = useState(null)

  useEffect(() => {
    async function fetchPlants() {
      try {
        const res = await fetch('/api/plants')
        if (res.ok) {
          setPlants(await res.json())
        }
      } catch (err) {
        console.error('Error fetching plants:', err)
      }
    }
    fetchPlants()
  }, [])

  // Create a grid lookup for placements
  const placementGrid = {}
  if (bed?.placements) {
    bed.placements.forEach(p => {
      placementGrid[`${p.row}-${p.col}`] = p
    })
  }

  const handleCellClick = async (row, col) => {
    const key = `${row}-${col}`
    const existing = placementGrid[key]

    if (existing) {
      // Cell has a plant - show options
      if (confirm(`Remove ${existing.plant_name}${existing.plant_variety ? ` (${existing.plant_variety})` : ''}?`)) {
        try {
          const res = await fetch(`/api/beds/${bed.id}/placements/${existing.id}`, {
            method: 'DELETE'
          })
          if (res.ok) {
            onUpdate()
          }
        } catch (err) {
          console.error('Error removing placement:', err)
        }
      }
    } else {
      // Empty cell - show plant picker
      setTargetCell({ row, col })
      setShowPlantPicker(true)
      setCompanionInfo(null)
    }
  }

  const handlePlantSelect = async (plant) => {
    if (!targetCell) return

    // Check companion info before placing
    try {
      const checkRes = await fetch(
        `/api/beds/${bed.id}/companion-check?plant_id=${plant.id}&row=${targetCell.row}&col=${targetCell.col}`
      )
      if (checkRes.ok) {
        const info = await checkRes.json()
        if (info.adjacent_analysis.bad.length > 0) {
          setCompanionInfo(info)
          setSelectedPlant(plant)
          return // Show warning before placing
        }
      }
    } catch (err) {
      console.error('Error checking companions:', err)
    }

    // Place the plant
    await placePlant(plant)
  }

  const placePlant = async (plant) => {
    try {
      const res = await fetch(`/api/beds/${bed.id}/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: plant.id,
          row: targetCell.row,
          col: targetCell.col
        })
      })
      if (res.ok) {
        setShowPlantPicker(false)
        setTargetCell(null)
        setCompanionInfo(null)
        setSelectedPlant(null)
        setSearchTerm('')
        onUpdate()
      }
    } catch (err) {
      console.error('Error placing plant:', err)
    }
  }

  const handleDragStart = (e, placement) => {
    setDraggedPlacement(placement)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, row, col) => {
    e.preventDefault()
    const key = `${row}-${col}`
    if (!placementGrid[key]) {
      // Check if it's a new plant drop or a move
      const hasNewPlant = e.dataTransfer.types.includes('application/json')
      e.dataTransfer.dropEffect = hasNewPlant ? 'copy' : 'move'
    }
  }

  const handleDrop = async (e, row, col) => {
    e.preventDefault()
    const key = `${row}-${col}`
    if (placementGrid[key]) return // Cell occupied

    // Check if this is a new plant from Selected Plants panel
    const jsonData = e.dataTransfer.getData('application/json')
    if (jsonData) {
      try {
        const data = JSON.parse(jsonData)
        if (data.type === 'new-plant' && data.plant) {
          // Place new plant directly
          const res = await fetch(`/api/beds/${bed.id}/placements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plant_id: data.plant.id,
              row,
              col
            })
          })
          if (res.ok) {
            onUpdate()
          }
          return
        }
      } catch (err) {
        console.error('Error parsing drag data:', err)
      }
    }

    // Otherwise, handle as a move within the grid
    if (!draggedPlacement) return

    try {
      const res = await fetch(`/api/beds/${bed.id}/placements/${draggedPlacement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col })
      })
      if (res.ok) {
        onUpdate()
      }
    } catch (err) {
      console.error('Error moving placement:', err)
    }
    setDraggedPlacement(null)
  }

  const filteredPlants = plants.filter(p => {
    const search = searchTerm.toLowerCase()
    return p.name.toLowerCase().includes(search) ||
           (p.variety && p.variety.toLowerCase().includes(search))
  })

  // Group filtered plants by category
  const groupedPlants = filteredPlants.reduce((acc, plant) => {
    const cat = plant.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(plant)
    return acc
  }, {})

  return (
    <div>
      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${bed.cols}, minmax(40px, 60px))`,
        gap: '4px',
        marginBottom: '1rem',
        overflowX: 'auto',
        padding: '0.5rem',
        background: 'var(--bg-card)',
        borderRadius: '0.5rem'
      }}>
        {Array.from({ length: bed.rows * bed.cols }).map((_, idx) => {
          const row = Math.floor(idx / bed.cols)
          const col = idx % bed.cols
          const key = `${row}-${col}`
          const placement = placementGrid[key]
          const waterColor = placement ? WATER_COLORS[placement.water_needs] || WATER_COLORS.medium : null

          // Check if this cell has a companion issue
          const hasIssue = bed.analysis?.companion_issues.some(
            issue => (issue.plant1.row === row && issue.plant1.col === col) ||
                     (issue.plant2.row === row && issue.plant2.col === col)
          )

          return (
            <div
              key={key}
              onClick={() => handleCellClick(row, col)}
              onDragOver={(e) => handleDragOver(e, row, col)}
              onDrop={(e) => handleDrop(e, row, col)}
              draggable={!!placement}
              onDragStart={(e) => placement && handleDragStart(e, placement)}
              style={{
                aspectRatio: '1',
                background: placement ? `${waterColor}33` : 'var(--bg-secondary)',
                border: hasIssue
                  ? '2px solid var(--accent-red)'
                  : placement
                    ? `2px solid ${waterColor}`
                    : '1px dashed var(--border-color)',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                fontSize: '0.5rem',
                textAlign: 'center',
                overflow: 'hidden',
                position: 'relative',
                transition: 'all 0.2s'
              }}
              title={placement
                ? `${placement.plant_name}${placement.plant_variety ? ` (${placement.plant_variety})` : ''}\nWater: ${placement.water_needs}\nClick to remove, drag to move`
                : 'Click to add plant'}
            >
              {placement ? (
                <>
                  <div style={{
                    fontSize: '0.625rem',
                    fontWeight: 500,
                    lineHeight: 1.1,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {placement.plant_name.slice(0, 8)}
                  </div>
                  {placement.plant_variety && (
                    <div style={{
                      fontSize: '0.5rem',
                      opacity: 0.7,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {placement.plant_variety.slice(0, 8)}
                    </div>
                  )}
                  {hasIssue && (
                    <div style={{
                      position: 'absolute',
                      top: '1px',
                      right: '2px',
                      fontSize: '0.625rem'
                    }}>⚠️</div>
                  )}
                </>
              ) : (
                <span style={{ opacity: 0.3 }}>+</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        fontSize: '0.625rem',
        color: 'var(--text-secondary)',
        marginBottom: '1rem'
      }}>
        <span><span style={{ color: WATER_COLORS.high }}>■</span> High water</span>
        <span><span style={{ color: WATER_COLORS.medium }}>■</span> Medium</span>
        <span><span style={{ color: WATER_COLORS.low }}>■</span> Low water</span>
        <span><span style={{ color: 'var(--accent-red)' }}>□</span> Companion issue</span>
      </div>

      {/* Plant picker modal */}
      {showPlantPicker && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPlantPicker(false)
              setCompanionInfo(null)
              setSelectedPlant(null)
            }
          }}
        >
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>
                Add plant to cell ({targetCell?.row + 1}, {targetCell?.col + 1})
              </h3>
              <input
                type="text"
                className="input"
                placeholder="Search plants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            {/* Companion warning */}
            {companionInfo && companionInfo.adjacent_analysis.bad.length > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid var(--accent-red)',
                borderRadius: '0.375rem',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                <strong>⚠️ Companion Warning:</strong>
                {companionInfo.adjacent_analysis.bad.map((b, i) => (
                  <div key={i} style={{ marginTop: '0.25rem' }}>
                    {selectedPlant?.name} + {b.plant}: {b.notes}
                  </div>
                ))}
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => placePlant(selectedPlant)}
                  >
                    Place Anyway
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setCompanionInfo(null)
                      setSelectedPlant(null)
                    }}
                  >
                    Choose Different
                  </button>
                </div>
              </div>
            )}

            {/* Good companions hint */}
            {companionInfo && companionInfo.adjacent_analysis.good.length > 0 && !companionInfo.adjacent_analysis.bad.length && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid var(--accent-green)',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                marginBottom: '1rem',
                fontSize: '0.75rem'
              }}>
                ✓ Good companions nearby: {companionInfo.adjacent_analysis.good.map(g => g.plant).join(', ')}
              </div>
            )}

            {!companionInfo && (
              <div style={{ overflow: 'auto', flex: 1 }}>
                {Object.entries(groupedPlants).map(([category, categoryPlants]) => (
                  <div key={category} style={{ marginBottom: '1rem' }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      marginBottom: '0.5rem'
                    }}>
                      {category}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '0.5rem'
                    }}>
                      {categoryPlants.slice(0, 20).map(plant => (
                        <button
                          key={plant.id}
                          onClick={() => handlePlantSelect(plant)}
                          style={{
                            padding: '0.5rem',
                            background: 'var(--bg-card)',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)'
                          }}
                        >
                          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                            {plant.name}
                          </div>
                          {plant.variety && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {plant.variety}
                            </div>
                          )}
                          <div style={{
                            fontSize: '0.625rem',
                            marginTop: '0.25rem',
                            color: WATER_COLORS[plant.water_needs] || 'var(--text-secondary)'
                          }}>
                            {plant.water_needs} water • {plant.days_to_maturity}d
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPlantPicker(false)
                  setCompanionInfo(null)
                  setSelectedPlant(null)
                  setSearchTerm('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BedGrid
