const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Get all tasks with filtering
router.get('/', (req, res) => {
  try {
    const { status, type, upcoming_days } = req.query;

    let query = `
      SELECT
        t.*,
        p.name as plant_name,
        p.variety as plant_variety,
        pl.location as planting_location
      FROM tasks t
      LEFT JOIN plants p ON t.plant_id = p.id
      LEFT JOIN plantings pl ON t.planting_id = pl.id
      WHERE 1=1
    `;
    const params = [];

    if (status === 'pending') {
      query += ' AND t.completed_at IS NULL';
    } else if (status === 'completed') {
      query += ' AND t.completed_at IS NOT NULL';
    }

    if (type) {
      query += ' AND t.task_type = ?';
      params.push(type);
    }

    if (upcoming_days) {
      query += ' AND t.due_date <= date("now", "+" || ? || " days") AND t.completed_at IS NULL';
      params.push(upcoming_days);
    }

    query += ' ORDER BY t.due_date ASC, t.created_at ASC';

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get tasks due today or overdue
router.get('/due', (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT
        t.*,
        p.name as plant_name,
        p.variety as plant_variety,
        pl.location as planting_location
      FROM tasks t
      LEFT JOIN plants p ON t.plant_id = p.id
      LEFT JOIN plantings pl ON t.planting_id = pl.id
      WHERE t.completed_at IS NULL
        AND t.due_date <= date('now')
      ORDER BY t.due_date ASC
    `).all();

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching due tasks:', error);
    res.status(500).json({ error: 'Failed to fetch due tasks' });
  }
});

// Get a single task
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare(`
      SELECT
        t.*,
        p.name as plant_name,
        p.variety as plant_variety,
        pl.location as planting_location
      FROM tasks t
      LEFT JOIN plants p ON t.plant_id = p.id
      LEFT JOIN plantings pl ON t.planting_id = pl.id
      WHERE t.id = ?
    `).get(id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create a new task
router.post('/', (req, res) => {
  try {
    const { title, description, task_type, due_date, recurring, plant_id, planting_id } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, task_type, due_date, recurring, plant_id, planting_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, task_type, due_date, recurring, plant_id, planting_id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update a task
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, task_type, due_date, recurring, plant_id, planting_id } = req.body;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare(`
      UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        task_type = COALESCE(?, task_type),
        due_date = COALESCE(?, due_date),
        recurring = COALESCE(?, recurring),
        plant_id = ?,
        planting_id = ?
      WHERE id = ?
    `).run(title, description, task_type, due_date, recurring, plant_id, planting_id, id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Complete a task (handles recurring tasks)
router.post('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Mark current task as completed
    db.prepare(`
      UPDATE tasks SET completed_at = datetime('now') WHERE id = ?
    `).run(id);

    // If recurring, create the next occurrence
    if (task.recurring && task.due_date) {
      let nextDate = new Date(task.due_date);

      switch (task.recurring) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      const nextDateStr = nextDate.toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO tasks (title, description, task_type, due_date, recurring, plant_id, planting_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(task.title, task.description, task.task_type, nextDateStr, task.recurring, task.plant_id, task.planting_id);
    }

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Uncomplete a task (revert completion)
router.post('/:id/uncomplete', (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare(`
      UPDATE tasks SET completed_at = NULL WHERE id = ?
    `).run(id);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error uncompleting task:', error);
    res.status(500).json({ error: 'Failed to uncomplete task' });
  }
});

// Delete a task
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Bulk create common garden tasks
router.post('/bulk/reminders', (req, res) => {
  try {
    const { task_type, start_date, recurring, plant_id, planting_id } = req.body;

    const templates = {
      water: { title: 'Water plants', description: 'Check soil moisture and water as needed' },
      fertilize: { title: 'Apply fertilizer', description: 'Apply balanced fertilizer or compost tea' },
      harvest: { title: 'Check for harvest', description: 'Inspect plants and harvest ripe produce' },
      maintenance: { title: 'Garden maintenance', description: 'Weed, prune, and general upkeep' },
    };

    const template = templates[task_type];
    if (!template) {
      return res.status(400).json({ error: 'Invalid task_type. Use: water, fertilize, harvest, maintenance' });
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, task_type, due_date, recurring, plant_id, planting_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(template.title, template.description, task_type, start_date || new Date().toISOString().split('T')[0], recurring || 'weekly', plant_id, planting_id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

module.exports = router;
