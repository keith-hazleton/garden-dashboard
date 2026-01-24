const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Get all plants with optional filtering
router.get('/', (req, res) => {
  try {
    const { category, search } = req.query;

    let query = 'SELECT * FROM plants WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (name LIKE ? OR variety LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY category, name, variety';

    const plants = db.prepare(query).all(...params);
    res.json(plants);
  } catch (error) {
    console.error('Error fetching plants:', error);
    res.status(500).json({ error: 'Failed to fetch plants' });
  }
});

// Get plants that can be planted now (based on current date and zone 10b windows)
router.get('/plant-now', (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    // Handle windows that wrap around the year (e.g., Dec-Feb = months 12,1,2)
    const plants = db.prepare(`
      SELECT DISTINCT
        p.*,
        pw.window_type,
        pw.start_month,
        pw.end_month
      FROM plants p
      JOIN planting_windows pw ON p.id = pw.plant_id
      WHERE
        (pw.start_month <= pw.end_month AND ? BETWEEN pw.start_month AND pw.end_month)
        OR (pw.start_month > pw.end_month AND (? >= pw.start_month OR ? <= pw.end_month))
      ORDER BY p.category, p.name
    `).all(currentMonth, currentMonth, currentMonth);

    res.json(plants);
  } catch (error) {
    console.error('Error fetching plantable plants:', error);
    res.status(500).json({ error: 'Failed to fetch plantable plants' });
  }
});

// Get a single plant with its planting windows
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);

    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const windows = db.prepare(`
      SELECT * FROM planting_windows WHERE plant_id = ? ORDER BY start_month
    `).all(id);

    res.json({ ...plant, planting_windows: windows });
  } catch (error) {
    console.error('Error fetching plant:', error);
    res.status(500).json({ error: 'Failed to fetch plant' });
  }
});

// Create a new plant
router.post('/', (req, res) => {
  try {
    const {
      name, variety, category, days_to_maturity, spacing_inches,
      sun_requirement, water_needs, frost_tolerant, notes, planting_windows
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Plant name is required' });
    }

    const result = db.prepare(`
      INSERT INTO plants (name, variety, category, days_to_maturity, spacing_inches, sun_requirement, water_needs, frost_tolerant, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, variety, category, days_to_maturity, spacing_inches, sun_requirement, water_needs, frost_tolerant ? 1 : 0, notes);

    const plantId = result.lastInsertRowid;

    // Add planting windows if provided
    if (planting_windows && planting_windows.length > 0) {
      const insertWindow = db.prepare(`
        INSERT INTO planting_windows (plant_id, window_type, start_month, start_day, end_month, end_day)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertWindows = db.transaction(() => {
        for (const w of planting_windows) {
          insertWindow.run(plantId, w.window_type, w.start_month, w.start_day || 1, w.end_month, w.end_day || 28);
        }
      });

      insertWindows();
    }

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(plantId);
    res.status(201).json(plant);
  } catch (error) {
    console.error('Error creating plant:', error);
    res.status(500).json({ error: 'Failed to create plant' });
  }
});

// Update a plant
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, variety, category, days_to_maturity, spacing_inches,
      sun_requirement, water_needs, frost_tolerant, notes
    } = req.body;

    const existing = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    db.prepare(`
      UPDATE plants SET
        name = COALESCE(?, name),
        variety = COALESCE(?, variety),
        category = COALESCE(?, category),
        days_to_maturity = COALESCE(?, days_to_maturity),
        spacing_inches = COALESCE(?, spacing_inches),
        sun_requirement = COALESCE(?, sun_requirement),
        water_needs = COALESCE(?, water_needs),
        frost_tolerant = COALESCE(?, frost_tolerant),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name, variety, category, days_to_maturity, spacing_inches, sun_requirement, water_needs, frost_tolerant !== undefined ? (frost_tolerant ? 1 : 0) : null, notes, id);

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    res.json(plant);
  } catch (error) {
    console.error('Error updating plant:', error);
    res.status(500).json({ error: 'Failed to update plant' });
  }
});

// Delete a plant
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    db.prepare('DELETE FROM plants WHERE id = ?').run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting plant:', error);
    res.status(500).json({ error: 'Failed to delete plant' });
  }
});

// --- Watchlist ---

// Toggle watch status for a plant
router.post('/:id/watch', (req, res) => {
  try {
    const { id } = req.params;

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const newWatched = plant.watched ? 0 : 1;
    db.prepare('UPDATE plants SET watched = ? WHERE id = ?').run(newWatched, id);

    const updated = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error toggling watch status:', error);
    res.status(500).json({ error: 'Failed to update watch status' });
  }
});

// Get all watched plants
router.get('/watched/list', (req, res) => {
  try {
    const plants = db.prepare(`
      SELECT p.*,
        json_group_array(json_object(
          'id', pw.id,
          'window_type', pw.window_type,
          'start_month', pw.start_month,
          'start_day', pw.start_day,
          'end_month', pw.end_month,
          'end_day', pw.end_day
        )) as planting_windows
      FROM plants p
      LEFT JOIN planting_windows pw ON p.id = pw.plant_id
      WHERE p.watched = 1
      GROUP BY p.id
      ORDER BY p.name, p.variety
    `).all();

    // Parse the JSON planting_windows
    const result = plants.map(p => ({
      ...p,
      planting_windows: JSON.parse(p.planting_windows).filter(w => w.id !== null)
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching watched plants:', error);
    res.status(500).json({ error: 'Failed to fetch watched plants' });
  }
});

// Get calendar view of watched plants with their planting windows
router.get('/calendar/year', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const plants = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.variety,
        p.category,
        p.days_to_maturity,
        pw.window_type,
        pw.start_month,
        pw.start_day,
        pw.end_month,
        pw.end_day
      FROM plants p
      JOIN planting_windows pw ON p.id = pw.plant_id
      WHERE p.watched = 1
      ORDER BY pw.start_month, pw.start_day, p.name
    `).all();

    // Build calendar events
    const events = [];
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const plant of plants) {
      const plantName = plant.variety ? `${plant.name} (${plant.variety})` : plant.name;

      // Handle windows that wrap around the year
      let startMonth = plant.start_month;
      let endMonth = plant.end_month;

      // Create event for the window
      events.push({
        plant_id: plant.id,
        plant_name: plantName,
        category: plant.category,
        window_type: plant.window_type,
        start_month: startMonth,
        start_day: plant.start_day || 1,
        end_month: endMonth,
        end_day: plant.end_day || 28,
        wraps_year: startMonth > endMonth,
        days_to_maturity: plant.days_to_maturity,
        label: `${plantName} - ${plant.window_type.replace('_', ' ')}`
      });
    }

    // Group by month for agenda view
    const agenda = {};
    for (let month = 1; month <= 12; month++) {
      agenda[month] = {
        name: monthNames[month],
        events: events.filter(e => {
          if (e.wraps_year) {
            return month >= e.start_month || month <= e.end_month;
          }
          return month >= e.start_month && month <= e.end_month;
        })
      };
    }

    res.json({
      year,
      events,
      agenda,
      watched_count: new Set(plants.map(p => p.id)).size
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// --- Plantings (what's actually in the ground) ---

// Get all plantings
router.get('/plantings/active', (req, res) => {
  try {
    const plantings = db.prepare(`
      SELECT
        pl.*,
        p.name as plant_name,
        p.variety as plant_variety,
        p.category as plant_category,
        p.days_to_maturity
      FROM plantings pl
      JOIN plants p ON pl.plant_id = p.id
      WHERE pl.status = 'active'
      ORDER BY pl.planted_date DESC
    `).all();

    res.json(plantings);
  } catch (error) {
    console.error('Error fetching plantings:', error);
    res.status(500).json({ error: 'Failed to fetch plantings' });
  }
});

// Create a planting
router.post('/plantings', (req, res) => {
  try {
    const { plant_id, location, sensor_id, planted_date, notes } = req.body;

    if (!plant_id) {
      return res.status(400).json({ error: 'plant_id is required' });
    }

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(plant_id);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Calculate expected harvest date
    const plantedDateObj = planted_date ? new Date(planted_date) : new Date();
    const expectedHarvest = plant.days_to_maturity
      ? new Date(plantedDateObj.getTime() + plant.days_to_maturity * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    const result = db.prepare(`
      INSERT INTO plantings (plant_id, location, sensor_id, planted_date, expected_harvest_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(plant_id, location, sensor_id, planted_date || new Date().toISOString().split('T')[0], expectedHarvest, notes);

    const planting = db.prepare(`
      SELECT pl.*, p.name as plant_name, p.variety as plant_variety
      FROM plantings pl
      JOIN plants p ON pl.plant_id = p.id
      WHERE pl.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(planting);
  } catch (error) {
    console.error('Error creating planting:', error);
    res.status(500).json({ error: 'Failed to create planting' });
  }
});

// Update a planting status
router.patch('/plantings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, location, sensor_id, notes } = req.body;

    const existing = db.prepare('SELECT * FROM plantings WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Planting not found' });
    }

    db.prepare(`
      UPDATE plantings SET
        status = COALESCE(?, status),
        location = COALESCE(?, location),
        sensor_id = COALESCE(?, sensor_id),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(status, location, sensor_id, notes, id);

    const planting = db.prepare(`
      SELECT pl.*, p.name as plant_name, p.variety as plant_variety
      FROM plantings pl
      JOIN plants p ON pl.plant_id = p.id
      WHERE pl.id = ?
    `).get(id);

    res.json(planting);
  } catch (error) {
    console.error('Error updating planting:', error);
    res.status(500).json({ error: 'Failed to update planting' });
  }
});

// Get companion planting info for a plant
router.get('/:id/companions', (req, res) => {
  try {
    const { id } = req.params;

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Get companion relationships by plant name (ignoring variety), deduplicated
    const companions = db.prepare(`
      SELECT DISTINCT
        CASE
          WHEN plant_name_a = ? THEN plant_name_b
          ELSE plant_name_a
        END as companion_name,
        relationship,
        notes
      FROM companion_relationships
      WHERE plant_name_a = ? OR plant_name_b = ?
      ORDER BY relationship, companion_name
    `).all(plant.name, plant.name, plant.name);

    // Group by relationship type
    const good = companions.filter(c => c.relationship === 'good');
    const bad = companions.filter(c => c.relationship === 'bad');

    res.json({
      plant_id: plant.id,
      plant_name: plant.name,
      good_companions: good,
      bad_companions: bad
    });
  } catch (error) {
    console.error('Error fetching companions:', error);
    res.status(500).json({ error: 'Failed to fetch companions' });
  }
});

module.exports = router;
