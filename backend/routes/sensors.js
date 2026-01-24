const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { checkMoistureAlert, checkTemperatureAlert } = require('../services/alerts');

// Ecowitt gateway webhook endpoint
// The gateway POSTs form-encoded data to this endpoint
router.post('/ecowitt', (req, res) => {
  try {
    const data = req.body;

    // Log raw data for debugging (remove in production)
    console.log('Ecowitt data received:', JSON.stringify(data, null, 2));

    // Ecowitt sends:
    // - Soil moisture as soilmoisture1, soilmoisture2, etc. (battery: soilbatt1, etc.)
    // - Soil temperature as tf_ch1, tf_ch2, etc. (battery: tf_batt1, etc.)
    //   or sometimes as soiltemp1f (Fahrenheit), soiltemp1c (Celsius)
    const insertMoisture = db.prepare(`
      INSERT INTO sensor_readings (sensor_id, sensor_name, sensor_type, moisture_percent, battery_status)
      VALUES (?, ?, 'moisture', ?, ?)
    `);

    const insertTemperature = db.prepare(`
      INSERT INTO sensor_readings (sensor_id, sensor_name, sensor_type, temperature_f, battery_status)
      VALUES (?, ?, 'temperature', ?, ?)
    `);

    const insertMany = db.transaction(() => {
      // Check for up to 8 soil moisture channels
      for (let i = 1; i <= 8; i++) {
        const moistureKey = `soilmoisture${i}`;
        const batteryKey = `soilbatt${i}`;

        if (data[moistureKey] !== undefined) {
          insertMoisture.run(
            `soil_moisture_${i}`,
            `Soil Moisture ${i}`,
            parseFloat(data[moistureKey]),
            data[batteryKey] || 'unknown'
          );
        }
      }

      // Check for up to 8 soil temperature channels
      // Ecowitt uses tf_ch1 (temp F channel) or soiltemp1f format
      for (let i = 1; i <= 8; i++) {
        // Try tf_ch format first (common for WN34 sensors)
        let tempKey = `tf_ch${i}`;
        let batteryKey = `tf_batt${i}`;
        let tempValue = data[tempKey];

        // Try soiltemp format if tf_ch not found
        if (tempValue === undefined) {
          tempKey = `soiltemp${i}f`;
          batteryKey = `soiltempbatt${i}`;
          tempValue = data[tempKey];
        }

        if (tempValue !== undefined) {
          insertTemperature.run(
            `soil_temp_${i}`,
            `Soil Temp ${i}`,
            parseFloat(tempValue),
            data[batteryKey] || 'unknown'
          );
        }
      }
    });

    insertMany();

    // Check alerts for each sensor (async, don't block response)
    // Moisture sensors
    for (let i = 1; i <= 8; i++) {
      const moistureKey = `soilmoisture${i}`;
      if (data[moistureKey] !== undefined) {
        checkMoistureAlert(
          `soil_moisture_${i}`,
          `Soil Moisture ${i}`,
          parseFloat(data[moistureKey])
        ).catch(err => console.error('Moisture alert error:', err));
      }
    }

    // Temperature sensors
    for (let i = 1; i <= 8; i++) {
      let tempValue = data[`tf_ch${i}`];
      if (tempValue === undefined) {
        tempValue = data[`soiltemp${i}f`];
      }
      if (tempValue !== undefined) {
        checkTemperatureAlert(
          `soil_temp_${i}`,
          `Soil Temp ${i}`,
          parseFloat(tempValue)
        ).catch(err => console.error('Temperature alert error:', err));
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
        battery_status,
        timestamp
      FROM sensor_readings
      WHERE id IN (
        SELECT MAX(id) FROM sensor_readings GROUP BY sensor_id
      )
      ORDER BY sensor_type, sensor_id
    `).all();

    res.json(readings);
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
    
    res.json(sensors);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

module.exports = router;
