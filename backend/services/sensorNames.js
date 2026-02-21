const db = require('../models/db');

/**
 * Resolve a sensor_id to a bed-friendly display name.
 * If the sensor is assigned to a bed (via sensor_id or temp_sensor_id),
 * returns "{BedName} Moisture" or "{BedName} Temp".
 * Otherwise falls back to the hardware sensor name.
 */
function getDisplayName(sensorId, fallbackName) {
  const moistureBed = db.prepare(
    'SELECT name FROM beds WHERE sensor_id = ?'
  ).get(sensorId);

  if (moistureBed) {
    return `${moistureBed.name} Moisture`;
  }

  const tempBed = db.prepare(
    'SELECT name FROM beds WHERE temp_sensor_id = ?'
  ).get(sensorId);

  if (tempBed) {
    return `${tempBed.name} Temp`;
  }

  return fallbackName || sensorId;
}

module.exports = { getDisplayName };
