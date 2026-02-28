const cron = require('node-cron');
const { getWateringAdvice } = require('./wateringAdvice');
const { sendNtfyNotification } = require('./alerts');
const { computeSuggestedProfile } = require('./bedProfiles');
const db = require('../models/db');

// Format watering advice into a notification message
function formatWateringMessage(advice) {
  const lines = [];

  // Overall recommendation
  lines.push(advice.overall_advice);
  lines.push('');

  // Per-sensor status
  for (const sensor of advice.sensors) {
    const icon = sensor.status === 'critical' ? '🔴'
      : sensor.status === 'low' ? '🟡'
      : sensor.status === 'saturated' ? '🔵'
      : '🟢';
    lines.push(`${icon} ${sensor.display_name}: ${sensor.moisture_percent}% — ${sensor.advice}`);
  }

  // Forecast summary
  const { total_expected_rain, max_rain_probability, max_temperature } = advice.forecast_summary;
  lines.push('');
  lines.push(`3-day forecast: ${total_expected_rain.toFixed(2)}" rain (${max_rain_probability}% chance), high ${max_temperature}°F`);

  return lines.join('\n');
}

function getPriority(advice) {
  const hasCritical = advice.sensors.some(s => s.status === 'critical');
  if (hasCritical) return 'high';
  const hasLow = advice.sensors.some(s => s.status === 'low');
  if (hasLow) return 'default';
  return 'low';
}

async function sendMorningWateringReport() {
  try {
    const advice = await getWateringAdvice();

    if (advice.sensors.length === 0) {
      console.log('No moisture sensors found, skipping morning report');
      return;
    }

    const message = formatWateringMessage(advice);
    const priority = getPriority(advice);
    const tags = ['seedling', 'droplet'];

    // sendNtfyNotification respects ntfy_enabled setting but bypasses quiet hours check,
    // so we call fetch directly to ensure the 7 AM report always sends
    const { getSetting } = require('./alerts');
    const enabled = getSetting('ntfy_enabled');
    if (enabled !== 'true') {
      console.log('ntfy disabled, skipping morning watering report');
      return;
    }

    const server = getSetting('ntfy_server') || 'https://ntfy.sh';
    const topic = getSetting('ntfy_topic');
    if (!topic) {
      console.error('No ntfy topic configured, skipping morning report');
      return;
    }

    const response = await fetch(`${server}/${topic}`, {
      method: 'POST',
      headers: {
        'Title': 'Morning Watering Report',
        'Priority': priority,
        'Tags': tags.join(',')
      },
      body: message
    });

    if (response.ok) {
      console.log('Morning watering report sent successfully');
    } else {
      console.error(`Failed to send morning report: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending morning watering report:', error);
  }
}

async function checkSeedlingGraduation() {
  try {
    const seedlingBeds = db.prepare(
      `SELECT id, name FROM beds WHERE profile = 'seedling'`
    ).all();

    if (seedlingBeds.length === 0) return;

    const graduated = [];
    for (const bed of seedlingBeds) {
      const suggested = computeSuggestedProfile(bed.id);
      if (suggested && suggested !== 'seedling') {
        db.prepare('UPDATE beds SET profile = ? WHERE id = ?').run(suggested, bed.id);
        graduated.push({ name: bed.name, newProfile: suggested });
      }
    }

    if (graduated.length === 0) return;

    // Send notification about graduated beds
    const { getSetting } = require('./alerts');
    const enabled = getSetting('ntfy_enabled');
    if (enabled !== 'true') return;

    const server = getSetting('ntfy_server') || 'https://ntfy.sh';
    const topic = getSetting('ntfy_topic');
    if (!topic) return;

    const lines = graduated.map(
      g => `${g.name}: seedling → ${g.newProfile.replace('_', ' ')}`
    );
    const message = `Seedling graduation:\n${lines.join('\n')}`;

    const response = await fetch(`${server}/${topic}`, {
      method: 'POST',
      headers: {
        'Title': 'Bed Profile Updated',
        'Priority': 'low',
        'Tags': 'seedling,tada'
      },
      body: message
    });

    if (response.ok) {
      console.log(`Seedling graduation: ${graduated.length} bed(s) updated`);
    }
  } catch (error) {
    console.error('Error checking seedling graduation:', error);
  }
}

function startScheduledNotifications() {
  // Every day at 7:00 AM
  cron.schedule('0 7 * * *', () => {
    console.log('Running morning watering report...');
    sendMorningWateringReport();
  });

  // Every day at 7:05 AM — check if seedling beds should graduate
  cron.schedule('5 7 * * *', () => {
    console.log('Checking seedling graduation...');
    checkSeedlingGraduation();
  });

  console.log('Scheduled notifications: morning watering report at 7:00 AM, seedling graduation at 7:05 AM');
}

module.exports = { startScheduledNotifications };
