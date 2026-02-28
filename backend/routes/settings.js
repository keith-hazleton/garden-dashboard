const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /api/settings — return all alert_settings as { key: value }
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM alert_settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — upsert key/value pairs
router.put('/', (req, res) => {
  try {
    const pairs = req.body;
    const upsert = db.prepare(`
      INSERT INTO alert_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const upsertMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value));
      }
    });

    upsertMany(Object.entries(pairs));

    // Return full updated settings
    const rows = db.prepare('SELECT key, value FROM alert_settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
