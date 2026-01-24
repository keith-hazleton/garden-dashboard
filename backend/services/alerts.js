const db = require('../models/db');

// Get a setting from the database
function getSetting(key) {
  const row = db.prepare('SELECT value FROM alert_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

// Get threshold profile by name
function getProfile(profileName) {
  const value = getSetting(`profile_${profileName}`);
  return value ? JSON.parse(value) : null;
}

// Check if we've sent this alert recently (within cooldown period)
function isInCooldown(sensorId, alertType) {
  const cooldownMinutes = parseInt(getSetting('alert_cooldown_minutes')) || 60;

  const recent = db.prepare(`
    SELECT id FROM alert_history
    WHERE sensor_id = ? AND alert_type = ?
      AND sent_at > datetime('now', '-${cooldownMinutes} minutes')
    LIMIT 1
  `).get(sensorId, alertType);

  return !!recent;
}

// Record that we sent an alert
function recordAlert(sensorId, alertType, message) {
  db.prepare(`
    INSERT INTO alert_history (sensor_id, alert_type, message)
    VALUES (?, ?, ?)
  `).run(sensorId, alertType, message);
}

// Send notification via ntfy
async function sendNtfyNotification(title, message, priority = 'default', tags = []) {
  const enabled = getSetting('ntfy_enabled');
  if (enabled !== 'true') {
    console.log('Alerts disabled, skipping notification');
    return false;
  }

  const server = getSetting('ntfy_server') || 'https://ntfy.sh';
  const topic = getSetting('ntfy_topic');

  if (!topic) {
    console.error('No ntfy topic configured');
    return false;
  }

  try {
    const response = await fetch(`${server}/${topic}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': tags.join(',')
      },
      body: message
    });

    if (response.ok) {
      console.log(`Alert sent: ${title} - ${message}`);
      return true;
    } else {
      console.error(`Failed to send alert: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending ntfy notification:', error);
    return false;
  }
}

// Check moisture reading and send alerts if needed
async function checkMoistureAlert(sensorId, sensorName, moisturePercent) {
  // Find bed associated with this sensor to get profile
  const bed = db.prepare('SELECT profile FROM beds WHERE sensor_id = ?').get(sensorId);
  const profileName = bed?.profile || getSetting('default_profile') || 'warm_season';
  const profile = getProfile(profileName);

  if (!profile) {
    console.error(`Profile ${profileName} not found`);
    return;
  }

  let alertType = null;
  let title = null;
  let message = null;
  let priority = 'default';
  let tags = [];

  if (moisturePercent <= profile.moisture_critical) {
    alertType = 'moisture_critical_low';
    title = `${sensorName}: Critical - Needs Water!`;
    message = `Soil moisture is critically low at ${moisturePercent}% (threshold: ${profile.moisture_critical}%)`;
    priority = 'urgent';
    tags = ['warning', 'droplet'];
  } else if (moisturePercent <= profile.moisture_low) {
    alertType = 'moisture_low';
    title = `${sensorName}: Low Moisture`;
    message = `Soil moisture is low at ${moisturePercent}% (threshold: ${profile.moisture_low}%)`;
    priority = 'high';
    tags = ['droplet'];
  } else if (moisturePercent >= profile.moisture_high) {
    alertType = 'moisture_high';
    title = `${sensorName}: Over-Saturated`;
    message = `Soil moisture is very high at ${moisturePercent}% (threshold: ${profile.moisture_high}%). Risk of root rot.`;
    priority = 'high';
    tags = ['warning', 'sweat_drops'];
  }

  if (alertType && !isInCooldown(sensorId, alertType)) {
    const sent = await sendNtfyNotification(title, message, priority, tags);
    if (sent) {
      recordAlert(sensorId, alertType, message);
    }
  }
}

// Check temperature reading and send alerts if needed
async function checkTemperatureAlert(sensorId, sensorName, tempF) {
  // Find bed associated with this sensor to get profile
  const bed = db.prepare('SELECT profile FROM beds WHERE temp_sensor_id = ?').get(sensorId);
  const profileName = bed?.profile || getSetting('default_profile') || 'warm_season';
  const profile = getProfile(profileName);

  if (!profile) {
    console.error(`Profile ${profileName} not found`);
    return;
  }

  let alertType = null;
  let title = null;
  let message = null;
  let priority = 'default';
  let tags = [];

  if (tempF <= profile.temp_critical_low) {
    alertType = 'temp_critical_low';
    title = `${sensorName}: Freezing Risk!`;
    message = `Soil temperature is ${tempF}F - risk of frost damage! (threshold: ${profile.temp_critical_low}F)`;
    priority = 'urgent';
    tags = ['warning', 'cold_face'];
  } else if (tempF <= profile.temp_low) {
    alertType = 'temp_low';
    title = `${sensorName}: Cold Soil`;
    message = `Soil temperature is low at ${tempF}F (threshold: ${profile.temp_low}F)`;
    priority = 'high';
    tags = ['snowflake'];
  } else if (tempF >= profile.temp_critical_high) {
    alertType = 'temp_critical_high';
    title = `${sensorName}: Extreme Heat!`;
    message = `Soil temperature is dangerously high at ${tempF}F! (threshold: ${profile.temp_critical_high}F)`;
    priority = 'urgent';
    tags = ['warning', 'fire'];
  } else if (tempF >= profile.temp_high) {
    alertType = 'temp_high';
    title = `${sensorName}: Hot Soil`;
    message = `Soil temperature is high at ${tempF}F (threshold: ${profile.temp_high}F)`;
    priority = 'high';
    tags = ['thermometer'];
  }

  if (alertType && !isInCooldown(sensorId, alertType)) {
    const sent = await sendNtfyNotification(title, message, priority, tags);
    if (sent) {
      recordAlert(sensorId, alertType, message);
    }
  }
}

module.exports = {
  checkMoistureAlert,
  checkTemperatureAlert,
  sendNtfyNotification,
  getSetting
};
