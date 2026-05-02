const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { checkMoistureAlert, checkTemperatureAlert } = require('../services/alerts');
const { getDisplayName } = require('../services/sensorNames');

// Ecowitt gateway webhook endpoint
// The gateway POSTs form-encoded data to this endpoint
router.post('/ecowitt', (req, res) => {
  try {
    const data = req.body;

    // Log raw data for debugging (remove in production)
    console.log('Ecowitt data received:', JSON.stringify(data, null, 2));

    // Ecowitt field families per channel N (1..16):
    // - WH51 (moisture-only):     soilmoisture{N}            battery: soilbatt{N}
    // - WN34 (temp-only):         tf_ch{N} or soiltemp{N}f   battery: tf_batt{N} / soiltempbatt{N}
    // - WH52 (moisture+temp+EC):  soil_ec_hum{N}, soil_ec_temp{N}, soil_ec{N}
    //                             battery: soil_ec_batt{N} (voltage, e.g. "1.76")
    const insertMoisture = db.prepare(`
      INSERT INTO sensor_readings (sensor_id, sensor_name, sensor_type, moisture_percent, battery_status)
      VALUES (?, ?, 'moisture', ?, ?)
    `);

    const insertTemperature = db.prepare(`
      INSERT INTO sensor_readings (sensor_id, sensor_name, sensor_type, temperature_f, battery_status)
      VALUES (?, ?, 'temperature', ?, ?)
    `);

    const insertEc = db.prepare(`
      INSERT INTO sensor_readings (sensor_id, sensor_name, sensor_type, ec_us_cm, battery_status)
      VALUES (?, ?, 'ec', ?, ?)
    `);

    // Resolve a moisture reading + battery for channel i across WH51 and WH52
    function resolveMoisture(i) {
      if (data[`soilmoisture${i}`] !== undefined) {
        return { value: parseFloat(data[`soilmoisture${i}`]), battery: data[`soilbatt${i}`] };
      }
      if (data[`soil_ec_hum${i}`] !== undefined) {
        return { value: parseFloat(data[`soil_ec_hum${i}`]), battery: data[`soil_ec_batt${i}`] };
      }
      return null;
    }

    // Resolve a temperature reading + battery for channel i across WN34 and WH52
    function resolveTemperature(i) {
      if (data[`tf_ch${i}`] !== undefined) {
        return { value: parseFloat(data[`tf_ch${i}`]), battery: data[`tf_batt${i}`] };
      }
      if (data[`soiltemp${i}f`] !== undefined) {
        return { value: parseFloat(data[`soiltemp${i}f`]), battery: data[`soiltempbatt${i}`] };
      }
      if (data[`soil_ec_temp${i}`] !== undefined) {
        return { value: parseFloat(data[`soil_ec_temp${i}`]), battery: data[`soil_ec_batt${i}`] };
      }
      return null;
    }

    const insertMany = db.transaction(() => {
      for (let i = 1; i <= 16; i++) {
        const m = resolveMoisture(i);
        if (m !== null) {
          insertMoisture.run(`soil_moisture_${i}`, `Soil Moisture ${i}`, m.value, m.battery || 'unknown');
        }

        const t = resolveTemperature(i);
        if (t !== null) {
          insertTemperature.run(`soil_temp_${i}`, `Soil Temp ${i}`, t.value, t.battery || 'unknown');
        }

        if (data[`soil_ec${i}`] !== undefined) {
          insertEc.run(
            `soil_ec_${i}`,
            `Soil EC ${i}`,
            parseFloat(data[`soil_ec${i}`]),
            data[`soil_ec_batt${i}`] || 'unknown'
          );
        }
      }
    });

    insertMany();

    // Check alerts for each sensor (async, don't block response)
    for (let i = 1; i <= 16; i++) {
      const m = resolveMoisture(i);
      if (m !== null) {
        checkMoistureAlert(`soil_moisture_${i}`, `Soil Moisture ${i}`, m.value)
          .catch(err => console.error('Moisture alert error:', err));
      }

      const t = resolveTemperature(i);
      if (t !== null) {
        checkTemperatureAlert(`soil_temp_${i}`, `Soil Temp ${i}`, t.value)
          .catch(err => console.error('Temperature alert error:', err));
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Ecowitt data:', error);
    res.status(500).json({ error: 'Failed to process sensor data' });
  }
});

// Get latest readings for all sensors
router.get('/latest', (req, res) => {
  try {
    const readings = db.prepare(`
      SELECT
        sensor_id,
        sensor_name,
        sensor_type,
        moisture_percent,
        temperature_f,
        ec_us_cm,
        battery_status,
        timestamp
      FROM sensor_readings
      WHERE id IN (
        SELECT MAX(id) FROM sensor_readings GROUP BY sensor_id
      )
      ORDER BY sensor_type, sensor_id
    `).all();

    const result = readings.map(r => ({
      ...r,
      display_name: getDisplayName(r.sensor_id, r.sensor_name)
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching latest readings:', error);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

// Get historical readings for a sensor
router.get('/history/:sensorId', (req, res) => {
  try {
    const { sensorId } = req.params;
    const hours = parseInt(req.query.hours) || 24;

    const readings = db.prepare(`
      SELECT
        sensor_type,
        moisture_percent,
        temperature_f,
        ec_us_cm,
        timestamp
      FROM sensor_readings
      WHERE sensor_id = ?
        AND timestamp > datetime('now', '-${hours} hours')
      ORDER BY timestamp ASC
    `).all(sensorId);

    res.json(readings);
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get all unique sensors
router.get('/', (req, res) => {
  try {
    const sensors = db.prepare(`
      SELECT DISTINCT
        sensor_id,
        sensor_name,
        MAX(timestamp) as last_seen
      FROM sensor_readings
      GROUP BY sensor_id
      ORDER BY sensor_id
    `).all();

    const result = sensors.map(s => ({
      ...s,
      display_name: getDisplayName(s.sensor_id, s.sensor_name)
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

module.exports = router;
