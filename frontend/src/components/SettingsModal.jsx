import { useState, useEffect, useCallback } from 'react'

const PROFILE_FIELDS = [
  { key: 'moisture_low', label: 'Moisture Low %' },
  { key: 'moisture_critical', label: 'Moisture Critical %' },
  { key: 'moisture_high', label: 'Moisture High %' },
  { key: 'temp_low', label: 'Temp Low (F)' },
  { key: 'temp_critical_low', label: 'Temp Critical Low (F)' },
  { key: 'temp_high', label: 'Temp High (F)' },
  { key: 'temp_critical_high', label: 'Temp Critical High (F)' },
]

const PROFILE_NAMES = ['cool_season', 'warm_season', 'seedling']

function SettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedProfile, setExpandedProfile] = useState(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setSettings(data)
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
      setExpandedProfile(null)
    }
  }, [isOpen, fetchSettings])

  if (!isOpen) return null

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const getProfile = (name) => {
    try {
      return JSON.parse(settings[`profile_${name}`] || '{}')
    } catch {
      return {}
    }
  }

  const updateProfile = (name, field, value) => {
    const profile = getProfile(name)
    profile[field] = Number(value)
    update(`profile_${name}`, JSON.stringify(profile))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      setSettings(data)
      onClose()
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="settings-overlay" onClick={handleBackdropClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" />Loading settings...</div>
        ) : (
          <div className="settings-body">
            {/* Notifications */}
            <section className="settings-section">
              <h3>Notifications</h3>
              <div className="settings-grid">
                <label>
                  <span>Enabled</span>
                  <select
                    className="input"
                    value={settings.ntfy_enabled || 'false'}
                    onChange={e => update('ntfy_enabled', e.target.value)}
                  >
                    <option value="true">On</option>
                    <option value="false">Off</option>
                  </select>
                </label>
                <label>
                  <span>ntfy Server</span>
                  <input
                    className="input"
                    value={settings.ntfy_server || ''}
                    onChange={e => update('ntfy_server', e.target.value)}
                  />
                </label>
                <label>
                  <span>ntfy Topic</span>
                  <input
                    className="input"
                    value={settings.ntfy_topic || ''}
                    onChange={e => update('ntfy_topic', e.target.value)}
                  />
                </label>
              </div>
            </section>

            {/* Alert Behavior */}
            <section className="settings-section">
              <h3>Alert Behavior</h3>
              <div className="settings-grid">
                <label>
                  <span>Cooldown (minutes)</span>
                  <input
                    className="input"
                    type="number"
                    value={settings.alert_cooldown_minutes || ''}
                    onChange={e => update('alert_cooldown_minutes', e.target.value)}
                  />
                </label>
                <label>
                  <span>Sustained High (minutes)</span>
                  <input
                    className="input"
                    type="number"
                    value={settings.sustained_high_minutes || ''}
                    onChange={e => update('sustained_high_minutes', e.target.value)}
                  />
                </label>
                <label>
                  <span>Default Profile</span>
                  <select
                    className="input"
                    value={settings.default_profile || 'warm_season'}
                    onChange={e => update('default_profile', e.target.value)}
                  >
                    {PROFILE_NAMES.map(p => (
                      <option key={p} value={p}>{p.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {/* Quiet Hours */}
            <section className="settings-section">
              <h3>Quiet Hours</h3>
              <div className="settings-grid">
                <label>
                  <span>Start Hour (0-23)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="23"
                    value={settings.quiet_hours_start || ''}
                    onChange={e => update('quiet_hours_start', e.target.value)}
                  />
                </label>
                <label>
                  <span>End Hour (0-23)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="23"
                    value={settings.quiet_hours_end || ''}
                    onChange={e => update('quiet_hours_end', e.target.value)}
                  />
                </label>
              </div>
            </section>

            {/* Location */}
            <section className="settings-section">
              <h3>Location</h3>
              <div className="settings-grid">
                <label>
                  <span>Latitude</span>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={settings.garden_lat || ''}
                    onChange={e => update('garden_lat', e.target.value)}
                  />
                </label>
                <label>
                  <span>Longitude</span>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={settings.garden_lon || ''}
                    onChange={e => update('garden_lon', e.target.value)}
                  />
                </label>
              </div>
            </section>

            {/* Threshold Profiles */}
            <section className="settings-section">
              <h3>Threshold Profiles</h3>
              {PROFILE_NAMES.map(name => {
                const profile = getProfile(name)
                const isExpanded = expandedProfile === name
                return (
                  <div key={name} className="profile-group">
                    <button
                      className="profile-toggle"
                      onClick={() => setExpandedProfile(isExpanded ? null : name)}
                    >
                      <span>{name.replace('_', ' ')}</span>
                      <span>{isExpanded ? '\u25B2' : '\u25BC'}</span>
                    </button>
                    {isExpanded && (
                      <div className="settings-grid profile-fields">
                        {PROFILE_FIELDS.map(f => (
                          <label key={f.key}>
                            <span>{f.label}</span>
                            <input
                              className="input"
                              type="number"
                              value={profile[f.key] ?? ''}
                              onChange={e => updateProfile(name, f.key, e.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          </div>
        )}

        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
