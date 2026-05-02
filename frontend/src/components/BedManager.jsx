import { useState, useEffect, useCallback } from 'react'
import BedGrid from './BedGrid'

const PROFILE_COLORS = {
  cool_season: '#3b82f6',
  warm_season: '#f59e0b',
  seedling: '#22c55e'
}

const PROFILE_LABELS = {
  cool_season: 'Cool Season',
  warm_season: 'Warm Season',
  seedling: 'Seedling'
}

function ecColor(ec) {
  if (ec < 500) return 'var(--accent-yellow)'
  if (ec < 2000) return 'var(--accent-green)'
  if (ec < 4000) return '#f97316'
  return 'var(--accent-red)'
}

function BedManager({ watchedKey }) {
  const [beds, setBeds] = useState([])
  const [selectedBed, setSelectedBed] = useState(null)
  const [bedDetail, setBedDetail] = useState(null)
  const [sensors, setSensors] = useState([])
  const [watchedPlants, setWatchedPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBed, setNewBed] = useState({ name: '', rows: 4, cols: 8, sensor_ids: [], temp_sensor_id: '', ec_sensor_id: '' })
  const [expandedPlant, setExpandedPlant] = useState(null)
  const [companionInfo, setCompanionInfo] = useState(null)
  const [editingBed, setEditingBed] = useState(null)

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
        setNewBed({ name: '', rows: 4, cols: 8, sensor_ids: [], temp_sensor_id: '', ec_sensor_id: '' })
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

  const handleSaveSensors = async () => {
    if (!editingBed) return
    try {
      const res = await fetch(`/api/beds/${selectedBed}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensor_ids: editingBed.sensor_ids || [],
          temp_sensor_id: editingBed.temp_sensor_id || null,
          ec_sensor_id: editingBed.ec_sensor_id || null,
          profile: editingBed.profile || null
        })
      })
      if (res.ok) {
        setEditingBed(null)
        fetchBeds()
        fetchBedDetail()
      }
    } catch (err) {
      console.error('Error updating bed sensors:', err)
    }
  }

  const handleApplyProfile = async (profile) => {
    try {
      const res = await fetch(`/api/beds/${selectedBed}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      })
      if (res.ok) {
        fetchBeds()
        fetchBedDetail()
      }
    } catch (err) {
      console.error('Error updating bed profile:', err)
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
            onClick={() => { setSelectedBed(bed.id); setEditingBed(null) }}
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
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Moisture Sensors (check all in this bed)</label>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem'
              }}>
                {sensors.filter(s => s.sensor_id.includes('moisture')).length === 0 ? (
                  <span style={{ color: 'var(--text-secondary)' }}>No moisture sensors detected</span>
                ) : sensors.filter(s => s.sensor_id.includes('moisture')).map(s => {
                  const checked = newBed.sensor_ids.includes(s.sensor_id)
                  return (
                    <label key={s.sensor_id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...newBed.sensor_ids, s.sensor_id]
                            : newBed.sensor_ids.filter(id => id !== s.sensor_id)
                          setNewBed({ ...newBed, sensor_ids: next })
                        }}
                      />
                      {s.display_name || s.sensor_name}
                    </label>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Temp Sensor</label>
              <select
                className="input"
                value={newBed.temp_sensor_id}
                onChange={e => setNewBed({ ...newBed, temp_sensor_id: e.target.value })}
              >
                <option value="">No sensor</option>
                {sensors.filter(s => s.sensor_id.includes('temp')).map(s => (
                  <option key={s.sensor_id} value={s.sensor_id}>{s.display_name || s.sensor_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>EC Sensor</label>
              <select
                className="input"
                value={newBed.ec_sensor_id}
                onChange={e => setNewBed({ ...newBed, ec_sensor_id: e.target.value })}
              >
                <option value="">No sensor</option>
                {sensors.filter(s => s.sensor_id.startsWith('soil_ec_')).map(s => (
                  <option key={s.sensor_id} value={s.sensor_id}>{s.display_name || s.sensor_name}</option>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>{currentBed.name}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {currentBed.rows} × {currentBed.cols}
              </span>
              {bedDetail?.profile && (
                <span style={{
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  background: `${PROFILE_COLORS[bedDetail.profile] || '#888'}33`,
                  color: PROFILE_COLORS[bedDetail.profile] || '#888',
                  border: `1px solid ${PROFILE_COLORS[bedDetail.profile] || '#888'}55`
                }}>
                  {PROFILE_LABELS[bedDetail.profile] || bedDetail.profile}
                </span>
              )}
            </div>

            {currentBed.current_moisture != null && (
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
                  {currentBed.moisture_breakdown?.length > 1 && (
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '0.25rem' }}>
                      (min of {currentBed.moisture_breakdown.length})
                    </span>
                  )}
                </span>
              </div>
            )}

            {currentBed.current_ec != null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '9999px',
                fontSize: '0.875rem'
              }}>
                <span style={{ color: ecColor(currentBed.current_ec) }}>
                  ⚡ {Math.round(currentBed.current_ec)} μS/cm
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setEditingBed(editingBed ? null : {
                  sensor_ids: Array.isArray(currentBed.sensor_ids) ? currentBed.sensor_ids : [],
                  temp_sensor_id: currentBed.temp_sensor_id || '',
                  ec_sensor_id: currentBed.ec_sensor_id || '',
                  profile: bedDetail?.profile || 'warm_season'
                })}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                {editingBed ? 'Cancel' : 'Edit Sensors'}
              </button>
              <button
                onClick={() => handleDeleteBed(currentBed.id)}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                Delete Bed
              </button>
            </div>
          </div>

          {/* Moisture breakdown when multiple sensors */}
          {currentBed.moisture_breakdown?.length > 1 && (
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              {currentBed.moisture_breakdown.map(b => (
                <span key={b.sensor_id}>
                  {b.display_name}: <strong>{Math.round(b.moisture_percent)}%</strong>
                </span>
              ))}
            </div>
          )}

          {/* Profile suggestion banner */}
          {bedDetail?.suggested_profile && bedDetail.suggested_profile !== bedDetail.profile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              marginBottom: '0.5rem'
            }}>
              <span>
                Suggested: <strong>{PROFILE_LABELS[bedDetail.suggested_profile]}</strong>
                {' '}(current: {PROFILE_LABELS[bedDetail.profile] || bedDetail.profile})
              </span>
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                onClick={() => handleApplyProfile(bedDetail.suggested_profile)}
              >
                Apply
              </button>
            </div>
          )}

          {/* Inline sensor edit */}
          {editingBed && (
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: '1 1 100%' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Moisture Sensors (check all in this bed)</label>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem'
                }}>
                  {sensors.filter(s => s.sensor_id.includes('moisture')).length === 0 ? (
                    <span style={{ color: 'var(--text-secondary)' }}>No moisture sensors detected</span>
                  ) : sensors.filter(s => s.sensor_id.includes('moisture')).map(s => {
                    const checked = editingBed.sensor_ids.includes(s.sensor_id)
                    return (
                      <label key={s.sensor_id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...editingBed.sensor_ids, s.sensor_id]
                              : editingBed.sensor_ids.filter(id => id !== s.sensor_id)
                            setEditingBed({ ...editingBed, sensor_ids: next })
                          }}
                        />
                        {s.display_name || s.sensor_name}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Temp Sensor</label>
                <select
                  className="input"
                  value={editingBed.temp_sensor_id}
                  onChange={e => setEditingBed({ ...editingBed, temp_sensor_id: e.target.value })}
                  style={{ minWidth: '180px' }}
                >
                  <option value="">No sensor</option>
                  {sensors.filter(s => s.sensor_id.includes('temp')).map(s => (
                    <option key={s.sensor_id} value={s.sensor_id}>{s.display_name || s.sensor_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>EC Sensor</label>
                <select
                  className="input"
                  value={editingBed.ec_sensor_id}
                  onChange={e => setEditingBed({ ...editingBed, ec_sensor_id: e.target.value })}
                  style={{ minWidth: '180px' }}
                >
                  <option value="">No sensor</option>
                  {sensors.filter(s => s.sensor_id.startsWith('soil_ec_')).map(s => (
                    <option key={s.sensor_id} value={s.sensor_id}>{s.display_name || s.sensor_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Profile</label>
                <select
                  className="input"
                  value={editingBed.profile}
                  onChange={e => setEditingBed({ ...editingBed, profile: e.target.value })}
                  style={{ minWidth: '140px' }}
                >
                  <option value="cool_season">Cool Season</option>
                  <option value="warm_season">Warm Season</option>
                  <option value="seedling">Seedling</option>
                </select>
              </div>
              <button
                onClick={handleSaveSensors}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
              >
                Save
              </button>
            </div>
          )}

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
