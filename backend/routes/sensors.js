const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Ecowitt gateway webhook endpoint
// The gateway POSTs form-encoded data to this endpoint
router.post('/ecowitt', (req, res) => {
  try {
    const data = req.body;
    
    // Log raw data for debugging (remove in production)
    console.log('Ecowitt data received:', JSON.stringify(data, null, 2));
    
    // Ecowitt sends soil moisture as soilmoisture1, soilmoisture2, etc.
    // Battery status as soilbatt1, soilbatt2, etc.
    const insert = db.prepare(`
      INSERT INTO sensor_readings (sensor_id, sensor_name, moisture_percent, battery_status)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction(() => {
      // Check for up to 8 soil moisture channels
      for (let i = 1; i <= 8; i++) {
        const moistureKey = `soilmoisture${i}`;
        const batteryKey = `soilbatt${i}`;
        
        if (data[moistureKey] !== undefined) {
          insert.run(
            `soil_${i}`,
            `Soil Sensor ${i}`,
            parseFloat(data[moistureKey]),
            data[batteryKey] || 'unknown'
          );
        }
      }
    });
    
    insertMany();
    
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
        moisture_percent,
        battery_status,
        timestamp
      FROM sensor_readings
      WHERE id IN (
        SELECT MAX(id) FROM sensor_readings GROUP BY sensor_id
      )
      ORDER BY sensor_id
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
        moisture_percent,
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
