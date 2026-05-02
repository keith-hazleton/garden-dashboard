const db = require('../models/db');

/**
 * Resolve a sensor_id to a bed-friendly display name.
 * If the sensor is assigned to a bed (via sensor_id or temp_sensor_id),
 * returns "{BedName} Moisture" or "{BedName} Temp".
 * Otherwise falls back to the hardware sensor name.
 */
function getDisplayName(sensorId, fallbackName) {
  // Look for any bed whose sensor_ids JSON array contains this sensor.
  // Falls back to the legacy single sensor_id column for beds not yet migrated.
  const moistureBed = db.prepare(`
    SELECT b.name
    FROM beds b, json_each(COALESCE(b.sensor_ids, json_array(b.sensor_id))) je
    WHERE je.value = ?
    LIMIT 1
  `).get(sensorId);

  if (moistureBed) {
    return `${moistureBed.name} Moisture`;
  }

  const tempBed = db.prepare(
    'SELECT name FROM beds WHERE temp_sensor_id = ?'
  ).get(sensorId);

  if (tempBed) {
    return `${tempBed.name} Temp`;
  }

  const ecBed = db.prepare(
    'SELECT name FROM beds WHERE ec_sensor_id = ?'
  ).get(sensorId);

  if (ecBed) {
    return `${ecBed.name} EC`;
  }

  return fallbackName || sensorId;
}

module.exports = { getDisplayName };
