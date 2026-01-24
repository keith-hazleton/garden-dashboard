import { useState, useEffect, useCallback } from 'react'
import BedGrid from './BedGrid'

function BedManager({ watchedKey }) {
  const [beds, setBeds] = useState([])
  const [selectedBed, setSelectedBed] = useState(null)
  const [bedDetail, setBedDetail] = useState(null)
  const [sensors, setSensors] = useState([])
  const [watchedPlants, setWatchedPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBed, setNewBed] = useState({ name: '', rows: 4, cols: 8, sensor_id: '' })
  const [expandedPlant, setExpandedPlant] = useState(null)
  const [companionInfo, setCompanionInfo] = useState(null)

  const fetchBeds = useCallback(async () => {
    try {
      const [bedsRes, sensorsRes] = await Promise.all([
        fetch('/api/beds'),
        fetch('/api/sensors')
      ])
      if (bedsRes.ok) {
        const bedsData = await bedsRes.json()
        setBeds(bedsData)
        if (bedsData.length > 0 && !selectedBed) {
          setSelectedBed(bedsData[0].id)
        }
      }
      if (sensorsRes.ok) {
        setSensors(await sensorsRes.json())
      }
    } catch (err) {
      console.error('Error fetching beds:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBed])

  const fetchBedDetail = useCallback(async () => {
    if (!selectedBed) return
    try {
      const res = await fetch(`/api/beds/${selectedBed}`)
      if (res.ok) {
        setBedDetail(await res.json())
      }
    } catch (err) {
      console.error('Error fetching bed detail:', err)
    }
  }, [selectedBed])

  useEffect(() => {
    fetchBeds()
  }, [])

  // Fetch watched plants when watchedKey changes
  useEffect(() => {
    async function fetchWatchedPlants() {
      try {
        const res = await fetch('/api/plants/watched/list')
        if (res.ok) {
          setWatchedPlants(await res.json())
        }
      } catch (err) {
        console.error('Error fetching watched plants:', err)
      }
    }
    fetchWatchedPlants()
  }, [watchedKey])

  // Fetch companion info when a plant is expanded
  const handlePlantClick = async (plant) => {
    if (expandedPlant === plant.id) {
      setExpandedPlant(null)
      setCompanionInfo(null)
      return
    }

    setExpandedPlant(plant.id)
    try {
      const res = await fetch(`/api/plants/${plant.id}/companions`)
      if (res.ok) {
        setCompanionInfo(await res.json())
      }
    } catch (err) {
      console.error('Error fetching companion info:', err)
    }
  }

  useEffect(() => {
    fetchBedDetail()
  }, [selectedBed, fetchBedDetail])

  const handleCreateBed = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/beds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBed)
      })
      if (res.ok) {
        const bed = await res.json()
        setShowCreateForm(false)
        setNewBed({ name: '', rows: 4, cols: 8, sensor_id: '' })
        fetchBeds()
        setSelectedBed(bed.id)
      }
    } catch (err) {
      console.error('Error creating bed:', err)
    }
  }

  const handleDeleteBed = async (id) => {
    if (!confirm('Delete this bed and all its placements?')) return
    try {
      const res = await fetch(`/api/beds/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchBeds()
        if (selectedBed === id) {
          setSelectedBed(null)
          setBedDetail(null)
        }
      }
    } catch (err) {
      console.error('Error deleting bed:', err)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading beds...
      </div>
    )
  }

  const currentBed = beds.find(b => b.id === selectedBed)

  return (
    <div>
      {/* Bed selector tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {beds.map(bed => (
          <button
            key={bed.id}
            onClick={() => setSelectedBed(bed.id)}
            style={{
              padding: '0.5rem 1rem',
              background: selectedBed === bed.id ? 'var(--accent-blue)' : 'var(--bg-card)',
              border: 'none',
              borderRadius: '0.375rem',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {bed.name}
            <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.75rem' }}>
              {bed.placement_count}/{bed.total_cells}
            </span>
          </button>
        ))}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-secondary"
          style={{ fontSize: '0.875rem' }}
        >
          + New Bed
        </button>
      </div>

      {/* Create bed form */}
      {showCreateForm && (
        <form onSubmit={handleCreateBed} style={{
          background: 'var(--bg-card)',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Name</label>
              <input
                type="text"
                className="input"
                value={newBed.name}
                onChange={e => setNewBed({ ...newBed, name: e.target.value })}
                placeholder="e.g., Raised Bed 1"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rows</label>
              <input
                type="number"
                className="input"
                value={newBed.rows}
                onChange={e => setNewBed({ ...newBed, rows: parseInt(e.target.value) || 4 })}
                min="1"
                max="20"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Columns</label>
              <input
                type="number"
                className="input"
                value={newBed.cols}
                onChange={e => setNewBed({ ...newBed, cols: parseInt(e.target.value) || 8 })}
                min="1"
                max="20"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sensor</label>
              <select
                className="input"
                value={newBed.sensor_id}
                onChange={e => setNewBed({ ...newBed, sensor_id: e.target.value })}
              >
                <option value="">No sensor</option>
                {sensors.map(s => (
                  <option key={s.sensor_id} value={s.sensor_id}>{s.sensor_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Create Bed</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Bed detail view */}
      {currentBed && bedDetail ? (
        <div>
          {/* Bed header with moisture and controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div>
              <span style={{ fontWeight: 600 }}>{currentBed.name}</span>
              <span style={{ marginLeft: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {currentBed.rows} × {currentBed.cols} grid
              </span>
            </div>

            {currentBed.current_moisture !== null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '9999px',
                fontSize: '0.875rem'
              }}>
                <span style={{
                  color: currentBed.current_moisture < 20 ? 'var(--accent-red)' :
                         currentBed.current_moisture < 35 ? 'var(--accent-yellow)' :
                         currentBed.current_moisture > 70 ? 'var(--accent-blue)' :
                         'var(--accent-green)'
                }}>
                  💧 {Math.round(currentBed.current_moisture)}%
                </span>
              </div>
            )}

            <button
              onClick={() => handleDeleteBed(currentBed.id)}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              Delete Bed
            </button>
          </div>

          {/* Analysis warnings */}
          {bedDetail.analysis && (
            <div style={{ marginBottom: '1rem' }}>
              {/* Water conflict warning */}
              {bedDetail.analysis.has_water_conflict && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(234, 179, 8, 0.2)',
                  border: '1px solid var(--accent-yellow)',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  marginBottom: '0.5rem'
                }}>
                  ⚠️ Water conflict: This bed mixes high-water ({bedDetail.analysis.water_needs.high}) and low-water ({bedDetail.analysis.water_needs.low}) plants
                </div>
              )}

              {/* Companion issues */}
              {bedDetail.analysis.companion_issues.length > 0 && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid var(--accent-red)',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem'
                }}>
                  🚫 Companion issues:
                  {bedDetail.analysis.companion_issues.map((issue, i) => (
                    <div key={i} style={{ marginTop: '0.25rem', paddingLeft: '1rem' }}>
                      <strong>{issue.plant1.name}</strong> + <strong>{issue.plant2.name}</strong>: {issue.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Water needs summary */}
          {bedDetail.analysis && bedDetail.analysis.total_plants > 0 && (
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1rem',
              fontSize: '0.75rem'
            }}>
              <span style={{ color: 'var(--accent-blue)' }}>
                High water: {bedDetail.analysis.water_needs.high}
              </span>
              <span style={{ color: 'var(--accent-green)' }}>
                Medium: {bedDetail.analysis.water_needs.medium}
              </span>
              <span style={{ color: 'var(--accent-yellow)' }}>
                Low water: {bedDetail.analysis.water_needs.low}
              </span>
            </div>
          )}

          {/* Grid and Selected Plants side by side */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: '300px' }}>
              <BedGrid
                bed={bedDetail}
                onUpdate={fetchBedDetail}
              />
            </div>

            {/* Selected Plants Panel */}
            {watchedPlants.length > 0 && (
              <div style={{
                width: '200px',
                flexShrink: 0,
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <h4 style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <span style={{ color: '#fbbf24' }}>★</span> Selected Plants
                </h4>
                <div style={{ fontSize: '0.75rem' }}>
                  {watchedPlants.map(plant => (
                    <div key={plant.id} style={{ marginBottom: '0.25rem' }}>
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'new-plant',
                            plant: plant
                          }))
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={() => handlePlantClick(plant)}
                        style={{
                          padding: '0.375rem 0.5rem',
                          borderRadius: expandedPlant === plant.id ? '0.25rem 0.25rem 0 0' : '0.25rem',
                          background: expandedPlant === plant.id ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}
                        title="Click for info, drag to add to bed"
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>{plant.name}</div>
                          {plant.variety && (
                            <div style={{ fontSize: '0.625rem', color: expandedPlant === plant.id ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)' }}>
                              {plant.variety}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.625rem',
                          opacity: 0.7,
                          transform: expandedPlant === plant.id ? 'rotate(180deg)' : 'rotate(0)',
                          transition: 'transform 0.2s'
                        }}>▼</span>
                      </div>

                      {/* Expanded info panel */}
                      {expandedPlant === plant.id && (
                        <div style={{
                          padding: '0.5rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '0 0 0.25rem 0.25rem',
                          borderTop: '1px solid var(--border-color)',
                          fontSize: '0.625rem'
                        }}>
                          {/* Plant details */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.25rem',
                            marginBottom: '0.5rem',
                            color: 'var(--text-secondary)'
                          }}>
                            <div>
                              <span style={{
                                color: plant.water_needs === 'high' ? '#3b82f6' :
                                       plant.water_needs === 'low' ? '#eab308' : '#22c55e'
                              }}>●</span> {plant.water_needs} water
                            </div>
                            <div>☀️ {plant.sun_requirement || 'full'}</div>
                            <div>📏 {plant.spacing_inches || '?'}" spacing</div>
                            <div>📅 {plant.days_to_maturity || '?'}d to harvest</div>
                          </div>

                          {/* Companion info */}
                          {companionInfo && companionInfo.plant_id === plant.id && (
                            <>
                              {companionInfo.good_companions.length > 0 && (
                                <div style={{ marginBottom: '0.375rem' }}>
                                  <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: '0.125rem' }}>
                                    ✓ Good companions:
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    {companionInfo.good_companions.map(c => c.companion_name).join(', ')}
                                  </div>
                                </div>
                              )}
                              {companionInfo.bad_companions.length > 0 && (
                                <div>
                                  <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.125rem' }}>
                                    ✗ Avoid planting near:
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    {companionInfo.bad_companions.map(c => c.companion_name).join(', ')}
                                  </div>
                                </div>
                              )}
                              {companionInfo.good_companions.length === 0 && companionInfo.bad_companions.length === 0 && (
                                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  No companion data available
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '0.625rem',
                  color: 'var(--text-secondary)'
                }}>
                  Click for companions, drag to grid
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          {beds.length === 0 ? (
            <>
              <p>No beds configured yet.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Click "+ New Bed" to create your first raised bed.
              </p>
            </>
          ) : (
            <p>Select a bed to view and edit.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default BedManager
