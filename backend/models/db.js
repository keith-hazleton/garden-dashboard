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
  db.exec(`ALTER TABLE sensor_readings ADD COLUMN ec_us_cm REAL`);
} catch (e) {
  if (!e.message.includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE beds ADD COLUMN ec_sensor_id TEXT`);
} catch (e) {
  if (!e.message.includes('duplicate column')) throw e;
}
try {
  db.prepare(`INSERT OR IGNORE INTO alert_settings (key, value) VALUES (?, ?)`).run('seedling_graduation_weeks', '4');
} catch (e) {
  // alert_settings table may not exist yet on first run before init-db
}

// Camera tables migration
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cameras (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      interval_minutes INTEGER DEFAULT 15,
      resolution TEXT DEFAULT '1920x1080',
      enabled INTEGER DEFAULT 1,
      bed_id INTEGER,
      last_seen_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS camera_frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camera_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      captured_at DATETIME NOT NULL,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_camera_frames_lookup
      ON camera_frames(camera_id, captured_at DESC);
  `);
} catch (e) {
  console.error('Camera tables migration error:', e.message);
}

module.exports = db;
