const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Get all beds with current moisture readings
router.get('/', (req, res) => {
  try {
    const beds = db.prepare(`
      SELECT b.*,
        (SELECT moisture_percent FROM sensor_readings
         WHERE sensor_id = b.sensor_id
         ORDER BY timestamp DESC LIMIT 1) as current_moisture,
        (SELECT timestamp FROM sensor_readings
         WHERE sensor_id = b.sensor_id
         ORDER BY timestamp DESC LIMIT 1) as moisture_updated_at
      FROM beds b
      ORDER BY b.name
    `).all();

    // Get placement counts for each bed
    const placementCounts = db.prepare(`
      SELECT bed_id, COUNT(*) as count FROM bed_placements GROUP BY bed_id
    `).all();

    const countMap = Object.fromEntries(placementCounts.map(p => [p.bed_id, p.count]));

    const result = beds.map(bed => ({
      ...bed,
      placement_count: countMap[bed.id] || 0,
      total_cells: bed.rows * bed.cols
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({ error: 'Failed to fetch beds' });
  }
});

// Get a single bed with all placements and analysis
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const bed = db.prepare(`
      SELECT b.*,
        (SELECT moisture_percent FROM sensor_readings
         WHERE sensor_id = b.sensor_id
         ORDER BY timestamp DESC LIMIT 1) as current_moisture,
        (SELECT timestamp FROM sensor_readings
         WHERE sensor_id = b.sensor_id
         ORDER BY timestamp DESC LIMIT 1) as moisture_updated_at
      FROM beds b
      WHERE b.id = ?
    `).get(id);

    if (!bed) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    // Get all placements with plant info
    const placements = db.prepare(`
      SELECT
        bp.*,
        p.name as plant_name,
        p.variety as plant_variety,
        p.category as plant_category,
        p.water_needs,
        p.days_to_maturity,
        p.spacing_inches
      FROM bed_placements bp
      JOIN plants p ON bp.plant_id = p.id
      WHERE bp.bed_id = ?
    `).all(id);

    // Analyze water needs
    const waterNeedsCounts = { low: 0, medium: 0, high: 0 };
    placements.forEach(p => {
      if (p.water_needs) waterNeedsCounts[p.water_needs]++;
    });

    // Check for water conflicts
    const hasWaterConflict = waterNeedsCounts.low > 0 && waterNeedsCounts.high > 0;

    // Get companion issues
    const companionIssues = [];
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const p1 = placements[i];
        const p2 = placements[j];

        // Check if adjacent (within 1 cell)
        const rowDiff = Math.abs(p1.row - p2.row);
        const colDiff = Math.abs(p1.col - p2.col);
        const isAdjacent = rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);

        if (isAdjacent) {
          // Check for bad companion relationship
          const relationship = db.prepare(`
            SELECT * FROM companion_relationships
            WHERE (plant_name_a = ? AND plant_name_b = ?)
               OR (plant_name_a = ? AND plant_name_b = ?)
          `).get(p1.plant_name, p2.plant_name, p2.plant_name, p1.plant_name);

          if (relationship && relationship.relationship === 'bad') {
            companionIssues.push({
              plant1: { id: p1.id, name: p1.plant_name, variety: p1.plant_variety, row: p1.row, col: p1.col },
              plant2: { id: p2.id, name: p2.plant_name, variety: p2.plant_variety, row: p2.row, col: p2.col },
              reason: relationship.notes
            });
          }
        }
      }
    }

    res.json({
      ...bed,
      placements,
      analysis: {
        water_needs: waterNeedsCounts,
        has_water_conflict: hasWaterConflict,
        companion_issues: companionIssues,
        total_plants: placements.length,
        total_cells: bed.rows * bed.cols
      }
    });
  } catch (error) {
    console.error('Error fetching bed:', error);
    res.status(500).json({ error: 'Failed to fetch bed' });
  }
});

// Create a new bed
router.post('/', (req, res) => {
  try {
    const { name, rows, cols, sensor_id, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Bed name is required' });
    }

    const result = db.prepare(`
      INSERT INTO beds (name, rows, cols, sensor_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, rows || 4, cols || 8, sensor_id, notes);

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(bed);
  } catch (error) {
    console.error('Error creating bed:', error);
    res.status(500).json({ error: 'Failed to create bed' });
  }
});

// Update a bed
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, rows, cols, sensor_id, notes } = req.body;

    const existing = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    db.prepare(`
      UPDATE beds SET
        name = COALESCE(?, name),
        rows = COALESCE(?, rows),
        cols = COALESCE(?, cols),
        sensor_id = ?,
        notes = ?
      WHERE id = ?
    `).run(name, rows, cols, sensor_id, notes, id);

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    res.json(bed);
  } catch (error) {
    console.error('Error updating bed:', error);
    res.status(500).json({ error: 'Failed to update bed' });
  }
});

// Delete a bed
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    db.prepare('DELETE FROM beds WHERE id = ?').run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting bed:', error);
    res.status(500).json({ error: 'Failed to delete bed' });
  }
});

// === PLACEMENTS ===

// Add a plant to a bed cell
router.post('/:id/placements', (req, res) => {
  try {
    const { id } = req.params;
    const { plant_id, row, col, planted_date, notes } = req.body;

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    if (!bed) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    // Validate cell bounds
    if (row < 0 || row >= bed.rows || col < 0 || col >= bed.cols) {
      return res.status(400).json({ error: 'Cell position out of bounds' });
    }

    // Check if cell is already occupied
    const existing = db.prepare(
      'SELECT * FROM bed_placements WHERE bed_id = ? AND row = ? AND col = ?'
    ).get(id, row, col);

    if (existing) {
      return res.status(400).json({ error: 'Cell is already occupied' });
    }

    const result = db.prepare(`
      INSERT INTO bed_placements (bed_id, plant_id, row, col, planted_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, plant_id, row, col, planted_date || new Date().toISOString().split('T')[0], notes);

    // Get the placement with plant info
    const placement = db.prepare(`
      SELECT
        bp.*,
        p.name as plant_name,
        p.variety as plant_variety,
        p.water_needs
      FROM bed_placements bp
      JOIN plants p ON bp.plant_id = p.id
      WHERE bp.id = ?
    `).get(result.lastInsertRowid);

    // Check for companion issues with adjacent plants
    const adjacentPlacements = db.prepare(`
      SELECT bp.*, p.name as plant_name, p.variety as plant_variety
      FROM bed_placements bp
      JOIN plants p ON bp.plant_id = p.id
      WHERE bp.bed_id = ?
        AND bp.id != ?
        AND ABS(bp.row - ?) <= 1
        AND ABS(bp.col - ?) <= 1
    `).all(id, placement.id, row, col);

    const warnings = [];
    for (const adj of adjacentPlacements) {
      const relationship = db.prepare(`
        SELECT * FROM companion_relationships
        WHERE (plant_name_a = ? AND plant_name_b = ?)
           OR (plant_name_a = ? AND plant_name_b = ?)
      `).get(placement.plant_name, adj.plant_name, adj.plant_name, placement.plant_name);

      if (relationship) {
        if (relationship.relationship === 'bad') {
          warnings.push({
            type: 'bad_companion',
            plant: adj.plant_name + (adj.plant_variety ? ` (${adj.plant_variety})` : ''),
            position: { row: adj.row, col: adj.col },
            message: relationship.notes
          });
        } else if (relationship.relationship === 'good') {
          warnings.push({
            type: 'good_companion',
            plant: adj.plant_name + (adj.plant_variety ? ` (${adj.plant_variety})` : ''),
            position: { row: adj.row, col: adj.col },
            message: relationship.notes
          });
        }
      }
    }

    res.status(201).json({ placement, companion_info: warnings });
  } catch (error) {
    console.error('Error adding placement:', error);
    res.status(500).json({ error: 'Failed to add placement' });
  }
});

// Move a placement to a new cell
router.patch('/:id/placements/:placementId', (req, res) => {
  try {
    const { id, placementId } = req.params;
    const { row, col, notes } = req.body;

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    if (!bed) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    const placement = db.prepare('SELECT * FROM bed_placements WHERE id = ? AND bed_id = ?').get(placementId, id);
    if (!placement) {
      return res.status(404).json({ error: 'Placement not found' });
    }

    // If moving to new position, check bounds and occupancy
    if (row !== undefined && col !== undefined) {
      if (row < 0 || row >= bed.rows || col < 0 || col >= bed.cols) {
        return res.status(400).json({ error: 'Cell position out of bounds' });
      }

      const existing = db.prepare(
        'SELECT * FROM bed_placements WHERE bed_id = ? AND row = ? AND col = ? AND id != ?'
      ).get(id, row, col, placementId);

      if (existing) {
        return res.status(400).json({ error: 'Target cell is already occupied' });
      }
    }

    db.prepare(`
      UPDATE bed_placements SET
        row = COALESCE(?, row),
        col = COALESCE(?, col),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(row, col, notes, placementId);

    const updated = db.prepare(`
      SELECT bp.*, p.name as plant_name, p.variety as plant_variety, p.water_needs
      FROM bed_placements bp
      JOIN plants p ON bp.plant_id = p.id
      WHERE bp.id = ?
    `).get(placementId);

    res.json(updated);
  } catch (error) {
    console.error('Error updating placement:', error);
    res.status(500).json({ error: 'Failed to update placement' });
  }
});

// Remove a placement
router.delete('/:id/placements/:placementId', (req, res) => {
  try {
    const { id, placementId } = req.params;

    const placement = db.prepare('SELECT * FROM bed_placements WHERE id = ? AND bed_id = ?').get(placementId, id);
    if (!placement) {
      return res.status(404).json({ error: 'Placement not found' });
    }

    db.prepare('DELETE FROM bed_placements WHERE id = ?').run(placementId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing placement:', error);
    res.status(500).json({ error: 'Failed to remove placement' });
  }
});

// Get companion suggestions for a plant at a position
router.get('/:id/companion-check', (req, res) => {
  try {
    const { id } = req.params;
    const { plant_id, row, col } = req.query;

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    if (!bed) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(plant_id);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Get adjacent placements
    const adjacentPlacements = db.prepare(`
      SELECT bp.*, p.name as plant_name, p.variety as plant_variety
      FROM bed_placements bp
      JOIN plants p ON bp.plant_id = p.id
      WHERE bp.bed_id = ?
        AND ABS(bp.row - ?) <= 1
        AND ABS(bp.col - ?) <= 1
    `).all(id, parseInt(row), parseInt(col));

    const companions = { good: [], bad: [], neutral: [] };

    for (const adj of adjacentPlacements) {
      const relationship = db.prepare(`
        SELECT * FROM companion_relationships
        WHERE (plant_name_a = ? AND plant_name_b = ?)
           OR (plant_name_a = ? AND plant_name_b = ?)
      `).get(plant.name, adj.plant_name, adj.plant_name, plant.name);

      const info = {
        plant: adj.plant_name + (adj.plant_variety ? ` (${adj.plant_variety})` : ''),
        position: { row: adj.row, col: adj.col },
        notes: relationship?.notes || null
      };

      if (relationship) {
        companions[relationship.relationship].push(info);
      } else {
        companions.neutral.push(info);
      }
    }

    // Get general companion suggestions for this plant
    const goodCompanions = db.prepare(`
      SELECT DISTINCT
        CASE WHEN plant_name_a = ? THEN plant_name_b ELSE plant_name_a END as companion,
        notes
      FROM companion_relationships
      WHERE (plant_name_a = ? OR plant_name_b = ?) AND relationship = 'good'
    `).all(plant.name, plant.name, plant.name);

    const badCompanions = db.prepare(`
      SELECT DISTINCT
        CASE WHEN plant_name_a = ? THEN plant_name_b ELSE plant_name_a END as companion,
        notes
      FROM companion_relationships
      WHERE (plant_name_a = ? OR plant_name_b = ?) AND relationship = 'bad'
    `).all(plant.name, plant.name, plant.name);

    res.json({
      plant: plant.name + (plant.variety ? ` (${plant.variety})` : ''),
      adjacent_analysis: companions,
      general_companions: {
        good: goodCompanions,
        bad: badCompanions
      }
    });
  } catch (error) {
    console.error('Error checking companions:', error);
    res.status(500).json({ error: 'Failed to check companions' });
  }
});

module.exports = router;
