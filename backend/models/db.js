const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/garden.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

// Idempotent migrations — safe to run on every server start
try {
  db.exec(`ALTER TABLE bed_placements ADD COLUMN planting_method TEXT DEFAULT 'transplant'`);
} catch (e) {
  if (!e.message.includes('duplicate column')) throw e;
}
try {
  db.prepare(`INSERT OR IGNORE INTO alert_settings (key, value) VALUES (?, ?)`).run('seedling_graduation_weeks', '4');
} catch (e) {
  // alert_settings table may not exist yet on first run before init-db
}

module.exports = db;
