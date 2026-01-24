const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/garden.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Sensor readings from Ecowitt
  CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id TEXT NOT NULL,
    sensor_name TEXT,
    sensor_type TEXT DEFAULT 'moisture', -- moisture, temperature, or combo
    moisture_percent REAL,
    temperature_f REAL,
    battery_status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp 
    ON sensor_readings(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_id 
    ON sensor_readings(sensor_id);

  -- Plants in your garden
  CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    variety TEXT,
    category TEXT, -- vegetable, herb, fruit, flower, cover_crop
    days_to_maturity INTEGER,
    spacing_inches INTEGER,
    sun_requirement TEXT, -- full, partial, shade
    water_needs TEXT, -- low, medium, high
    frost_tolerant BOOLEAN DEFAULT 0,
    watched BOOLEAN DEFAULT 0, -- user is interested in growing this
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Planting schedule based on zone 10b
  CREATE TABLE IF NOT EXISTS planting_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL,
    window_type TEXT NOT NULL, -- indoor_start, transplant, direct_sow
    start_month INTEGER NOT NULL, -- 1-12
    start_day INTEGER DEFAULT 1,
    end_month INTEGER NOT NULL,
    end_day INTEGER DEFAULT 28,
    FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
  );

  -- Your actual plantings (what's in the ground)
  CREATE TABLE IF NOT EXISTS plantings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL,
    location TEXT, -- bed name or zone
    sensor_id TEXT, -- links to moisture sensor
    planted_date DATE,
    expected_harvest_date DATE,
    status TEXT DEFAULT 'active', -- active, harvested, removed
    notes TEXT,
    FOREIGN KEY (plant_id) REFERENCES plants(id)
  );

  -- Maintenance tasks
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT, -- water, fertilize, plant, harvest, cover_crop, maintenance
    due_date DATE,
    recurring TEXT, -- null, daily, weekly, biweekly, monthly, yearly
    completed_at DATETIME,
    plant_id INTEGER,
    planting_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plant_id) REFERENCES plants(id),
    FOREIGN KEY (planting_id) REFERENCES plantings(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_at);

  -- Weather cache (from Open-Meteo)
  CREATE TABLE IF NOT EXISTS weather_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_type TEXT NOT NULL, -- current, forecast, historical
    data JSON NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Raised beds with grid dimensions
  CREATE TABLE IF NOT EXISTS beds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rows INTEGER NOT NULL DEFAULT 4,
    cols INTEGER NOT NULL DEFAULT 8,
    sensor_id TEXT, -- links to moisture sensor
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Plant placements in bed grid cells
  CREATE TABLE IF NOT EXISTS bed_placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id INTEGER NOT NULL,
    plant_id INTEGER NOT NULL,
    row INTEGER NOT NULL,
    col INTEGER NOT NULL,
    planted_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE,
    FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
    UNIQUE(bed_id, row, col)
  );

  CREATE INDEX IF NOT EXISTS idx_bed_placements_bed ON bed_placements(bed_id);

  -- Companion planting relationships
  CREATE TABLE IF NOT EXISTS companion_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_name_a TEXT NOT NULL, -- generic name like "Tomato" (matches any variety)
    plant_name_b TEXT NOT NULL,
    relationship TEXT NOT NULL, -- good, bad, neutral
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_companions_a ON companion_relationships(plant_name_a);
  CREATE INDEX IF NOT EXISTS idx_companions_b ON companion_relationships(plant_name_b);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_plants_name_variety ON plants(name, variety);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_planting_windows_unique ON planting_windows(plant_id, window_type);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_unique ON companion_relationships(plant_name_a, plant_name_b);
`);

console.log('Database initialized at:', dbPath);

// Data sources for plant information (Zone 10a - Los Angeles County / La Cañada Flintridge area):
// - UC Master Gardener Time of Planting (South Coast): https://ucanr.edu/program/uc-master-gardener-program/time-planting
// - UC Master Gardeners of Los Angeles County: https://ucanr.edu/county/los-angeles-county/gardening-uc-master-gardener-program
// - Spring & Summer Gardening Basics for LA County: https://ucanr.edu/sites/default/files/2011-11/131790.pdf
// - Fall & Winter Gardening Basics for LA County: https://celosangeles.ucanr.edu/files/131791.pdf
// - UC Master Gardeners of Sacramento County (bulbs): https://ucanr.edu/sites/sacmg/Sacramento_Bulb_Planting_Schedule/
// - UC Master Gardeners of Santa Clara County (flowers): https://ucanr.edu/site/uc-master-gardeners-santa-clara-county/cut-flower-planting-chart
// - UC ANR (Agriculture and Natural Resources): https://ucanr.edu/

// Seed zone 10a plants - comprehensive list for LA County / South Coast region
const seedPlants = db.prepare(`
  INSERT OR IGNORE INTO plants (name, variety, category, days_to_maturity, spacing_inches, sun_requirement, water_needs, frost_tolerant)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const zone10aPlants = [
  // === TOMATOES ===
  ['Tomato', 'Cherokee Purple', 'vegetable', 80, 24, 'full', 'medium', 0],
  ['Tomato', 'Sun Gold', 'vegetable', 65, 24, 'full', 'medium', 0],
  ['Tomato', 'Brandywine', 'vegetable', 90, 24, 'full', 'medium', 0],
  ['Tomato', 'Roma', 'vegetable', 75, 24, 'full', 'medium', 0],
  ['Tomato', 'Early Girl', 'vegetable', 57, 24, 'full', 'medium', 0],
  ['Tomato', 'San Marzano', 'vegetable', 80, 24, 'full', 'medium', 0],
  ['Tomato', 'Cherry (Sweet 100)', 'vegetable', 65, 24, 'full', 'medium', 0],
  ['Tomato', 'Beefsteak', 'vegetable', 85, 24, 'full', 'medium', 0],
  ['Tomato', 'Green Zebra', 'vegetable', 75, 24, 'full', 'medium', 0],
  ['Tomato', 'Black Krim', 'vegetable', 80, 24, 'full', 'medium', 0],

  // === PEPPERS ===
  ['Pepper', 'California Wonder', 'vegetable', 75, 18, 'full', 'medium', 0],
  ['Pepper', 'Jalapeño', 'vegetable', 70, 18, 'full', 'medium', 0],
  ['Pepper', 'Serrano', 'vegetable', 75, 18, 'full', 'medium', 0],
  ['Pepper', 'Poblano', 'vegetable', 80, 18, 'full', 'medium', 0],
  ['Pepper', 'Anaheim', 'vegetable', 75, 18, 'full', 'medium', 0],
  ['Pepper', 'Habanero', 'vegetable', 95, 18, 'full', 'medium', 0],
  ['Pepper', 'Bell (Red)', 'vegetable', 75, 18, 'full', 'medium', 0],
  ['Pepper', 'Banana', 'vegetable', 70, 18, 'full', 'medium', 0],
  ['Pepper', 'Shishito', 'vegetable', 60, 18, 'full', 'medium', 0],
  ['Pepper', 'Padron', 'vegetable', 60, 18, 'full', 'medium', 0],

  // === SQUASH & MELONS ===
  ['Zucchini', 'Black Beauty', 'vegetable', 50, 36, 'full', 'medium', 0],
  ['Zucchini', 'Costata Romanesco', 'vegetable', 55, 36, 'full', 'medium', 0],
  ['Summer Squash', 'Yellow Crookneck', 'vegetable', 50, 36, 'full', 'medium', 0],
  ['Summer Squash', 'Pattypan', 'vegetable', 50, 36, 'full', 'medium', 0],
  ['Winter Squash', 'Butternut', 'vegetable', 100, 48, 'full', 'medium', 0],
  ['Winter Squash', 'Acorn', 'vegetable', 85, 48, 'full', 'medium', 0],
  ['Winter Squash', 'Delicata', 'vegetable', 100, 48, 'full', 'medium', 0],
  ['Winter Squash', 'Spaghetti', 'vegetable', 90, 48, 'full', 'medium', 0],
  ['Pumpkin', 'Sugar Pie', 'vegetable', 100, 60, 'full', 'medium', 0],
  ['Pumpkin', 'Jack O Lantern', 'vegetable', 110, 72, 'full', 'medium', 0],
  ['Cucumber', 'Marketmore', 'vegetable', 55, 36, 'full', 'high', 0],
  ['Cucumber', 'Lemon', 'vegetable', 65, 36, 'full', 'high', 0],
  ['Cucumber', 'Armenian', 'vegetable', 70, 36, 'full', 'high', 0],
  ['Cucumber', 'Persian', 'vegetable', 55, 36, 'full', 'high', 0],
  ['Melon', 'Cantaloupe', 'vegetable', 85, 36, 'full', 'medium', 0],
  ['Melon', 'Honeydew', 'vegetable', 90, 36, 'full', 'medium', 0],
  ['Watermelon', 'Sugar Baby', 'vegetable', 80, 72, 'full', 'medium', 0],
  ['Watermelon', 'Crimson Sweet', 'vegetable', 85, 72, 'full', 'medium', 0],

  // === LEAFY GREENS ===
  ['Lettuce', 'Butterhead', 'vegetable', 45, 8, 'partial', 'high', 1],
  ['Lettuce', 'Romaine', 'vegetable', 70, 8, 'partial', 'high', 1],
  ['Lettuce', 'Red Leaf', 'vegetable', 45, 8, 'partial', 'high', 1],
  ['Lettuce', 'Oak Leaf', 'vegetable', 45, 8, 'partial', 'high', 1],
  ['Lettuce', 'Iceberg', 'vegetable', 80, 12, 'partial', 'high', 1],
  ['Spinach', 'Bloomsdale', 'vegetable', 45, 6, 'partial', 'high', 1],
  ['Spinach', 'Baby Leaf', 'vegetable', 30, 4, 'partial', 'high', 1],
  ['Arugula', null, 'vegetable', 40, 6, 'partial', 'medium', 1],
  ['Kale', 'Lacinato', 'vegetable', 60, 18, 'partial', 'medium', 1],
  ['Kale', 'Red Russian', 'vegetable', 50, 18, 'partial', 'medium', 1],
  ['Kale', 'Curly', 'vegetable', 55, 18, 'partial', 'medium', 1],
  ['Swiss Chard', 'Rainbow', 'vegetable', 55, 12, 'partial', 'medium', 1],
  ['Swiss Chard', 'Fordhook Giant', 'vegetable', 55, 12, 'partial', 'medium', 1],
  ['Collard Greens', null, 'vegetable', 60, 18, 'partial', 'medium', 1],
  ['Mustard Greens', null, 'vegetable', 45, 12, 'partial', 'medium', 1],
  ['Bok Choy', null, 'vegetable', 45, 10, 'partial', 'high', 1],
  ['Mache', null, 'vegetable', 50, 4, 'partial', 'medium', 1],
  ['Endive', 'Frisee', 'vegetable', 85, 12, 'partial', 'medium', 1],
  ['Radicchio', null, 'vegetable', 80, 10, 'partial', 'medium', 1],

  // === BRASSICAS ===
  ['Broccoli', 'Calabrese', 'vegetable', 70, 18, 'full', 'medium', 1],
  ['Broccoli', 'Di Cicco', 'vegetable', 65, 18, 'full', 'medium', 1],
  ['Cauliflower', 'Snowball', 'vegetable', 75, 18, 'full', 'medium', 1],
  ['Cauliflower', 'Purple', 'vegetable', 80, 18, 'full', 'medium', 1],
  ['Cabbage', 'Green', 'vegetable', 70, 18, 'full', 'medium', 1],
  ['Cabbage', 'Red', 'vegetable', 75, 18, 'full', 'medium', 1],
  ['Cabbage', 'Napa', 'vegetable', 70, 12, 'full', 'medium', 1],
  ['Brussels Sprouts', null, 'vegetable', 100, 24, 'full', 'medium', 1],
  ['Kohlrabi', null, 'vegetable', 55, 6, 'full', 'medium', 1],

  // === ROOT VEGETABLES ===
  ['Carrot', 'Nantes', 'vegetable', 70, 2, 'full', 'medium', 1],
  ['Carrot', 'Chantenay', 'vegetable', 70, 2, 'full', 'medium', 1],
  ['Carrot', 'Purple Haze', 'vegetable', 70, 2, 'full', 'medium', 1],
  ['Beet', 'Detroit Dark Red', 'vegetable', 55, 4, 'full', 'medium', 1],
  ['Beet', 'Chioggia', 'vegetable', 55, 4, 'full', 'medium', 1],
  ['Beet', 'Golden', 'vegetable', 55, 4, 'full', 'medium', 1],
  ['Radish', 'Cherry Belle', 'vegetable', 25, 2, 'full', 'medium', 1],
  ['Radish', 'French Breakfast', 'vegetable', 28, 2, 'full', 'medium', 1],
  ['Radish', 'Watermelon', 'vegetable', 60, 4, 'full', 'medium', 1],
  ['Radish', 'Daikon', 'vegetable', 60, 6, 'full', 'medium', 1],
  ['Turnip', 'Purple Top', 'vegetable', 55, 4, 'full', 'medium', 1],
  ['Turnip', 'Hakurei', 'vegetable', 40, 4, 'full', 'medium', 1],
  ['Parsnip', null, 'vegetable', 120, 4, 'full', 'medium', 1],
  ['Rutabaga', null, 'vegetable', 90, 6, 'full', 'medium', 1],
  ['Sweet Potato', 'Beauregard', 'vegetable', 100, 12, 'full', 'medium', 0],
  ['Sweet Potato', 'Japanese', 'vegetable', 100, 12, 'full', 'medium', 0],
  ['Potato', 'Yukon Gold', 'vegetable', 80, 12, 'full', 'medium', 0],
  ['Potato', 'Red', 'vegetable', 80, 12, 'full', 'medium', 0],
  ['Potato', 'Fingerling', 'vegetable', 90, 12, 'full', 'medium', 0],

  // === ALLIUMS ===
  ['Onion', 'Yellow', 'vegetable', 100, 4, 'full', 'medium', 1],
  ['Onion', 'Red', 'vegetable', 100, 4, 'full', 'medium', 1],
  ['Onion', 'White', 'vegetable', 100, 4, 'full', 'medium', 1],
  ['Green Onion', null, 'vegetable', 60, 2, 'full', 'medium', 1],
  ['Shallot', null, 'vegetable', 90, 6, 'full', 'medium', 1],
  ['Leek', null, 'vegetable', 120, 6, 'full', 'medium', 1],
  ['Garlic', 'Softneck', 'vegetable', 180, 6, 'full', 'low', 1],
  ['Garlic', 'Hardneck', 'vegetable', 180, 6, 'full', 'low', 1],
  ['Chives', null, 'herb', 90, 6, 'full', 'medium', 1],

  // === LEGUMES ===
  ['Beans', 'Blue Lake', 'vegetable', 55, 4, 'full', 'medium', 0],
  ['Beans', 'Kentucky Wonder', 'vegetable', 65, 6, 'full', 'medium', 0],
  ['Beans', 'Dragon Tongue', 'vegetable', 60, 4, 'full', 'medium', 0],
  ['Beans', 'Scarlet Runner', 'vegetable', 70, 6, 'full', 'medium', 0],
  ['Beans', 'Black', 'vegetable', 90, 4, 'full', 'medium', 0],
  ['Peas', 'Sugar Snap', 'vegetable', 60, 3, 'full', 'medium', 1],
  ['Peas', 'Snow Pea', 'vegetable', 60, 3, 'full', 'medium', 1],
  ['Peas', 'Shelling', 'vegetable', 70, 3, 'full', 'medium', 1],
  ['Edamame', null, 'vegetable', 90, 6, 'full', 'medium', 0],

  // === NIGHTSHADES (other) ===
  ['Eggplant', 'Black Beauty', 'vegetable', 80, 24, 'full', 'medium', 0],
  ['Eggplant', 'Japanese', 'vegetable', 70, 24, 'full', 'medium', 0],
  ['Eggplant', 'Rosa Bianca', 'vegetable', 75, 24, 'full', 'medium', 0],
  ['Tomatillo', null, 'vegetable', 75, 24, 'full', 'medium', 0],
  ['Ground Cherry', null, 'vegetable', 70, 24, 'full', 'medium', 0],

  // === OTHER VEGETABLES ===
  ['Corn', 'Golden Bantam', 'vegetable', 75, 12, 'full', 'medium', 0],
  ['Corn', 'Silver Queen', 'vegetable', 92, 12, 'full', 'medium', 0],
  ['Okra', 'Clemson Spineless', 'vegetable', 55, 18, 'full', 'medium', 0],
  ['Artichoke', 'Green Globe', 'vegetable', 180, 48, 'full', 'medium', 1],
  ['Asparagus', 'Mary Washington', 'vegetable', 730, 18, 'full', 'medium', 1],
  ['Celery', null, 'vegetable', 120, 8, 'partial', 'high', 1],
  ['Fennel', 'Florence', 'vegetable', 80, 12, 'full', 'medium', 1],
  ['Rhubarb', null, 'vegetable', 365, 36, 'partial', 'medium', 1],

  // === HERBS ===
  ['Basil', 'Genovese', 'herb', 60, 12, 'full', 'medium', 0],
  ['Basil', 'Thai', 'herb', 60, 12, 'full', 'medium', 0],
  ['Basil', 'Purple', 'herb', 60, 12, 'full', 'medium', 0],
  ['Basil', 'Lemon', 'herb', 60, 12, 'full', 'medium', 0],
  ['Cilantro', null, 'herb', 50, 6, 'partial', 'medium', 1],
  ['Parsley', 'Italian', 'herb', 75, 8, 'partial', 'medium', 1],
  ['Parsley', 'Curly', 'herb', 75, 8, 'partial', 'medium', 1],
  ['Dill', null, 'herb', 55, 12, 'full', 'medium', 1],
  ['Oregano', null, 'herb', 90, 12, 'full', 'low', 1],
  ['Thyme', null, 'herb', 90, 12, 'full', 'low', 1],
  ['Rosemary', null, 'herb', 180, 24, 'full', 'low', 1],
  ['Sage', null, 'herb', 75, 18, 'full', 'low', 1],
  ['Mint', 'Spearmint', 'herb', 90, 18, 'partial', 'medium', 1],
  ['Mint', 'Peppermint', 'herb', 90, 18, 'partial', 'medium', 1],
  ['Lavender', null, 'herb', 180, 18, 'full', 'low', 1],
  ['Lemongrass', null, 'herb', 120, 24, 'full', 'medium', 0],
  ['Chamomile', null, 'herb', 60, 8, 'full', 'medium', 1],
  ['Tarragon', null, 'herb', 90, 18, 'full', 'medium', 1],
  ['Marjoram', null, 'herb', 80, 12, 'full', 'low', 1],
  ['Chervil', null, 'herb', 60, 6, 'partial', 'medium', 1],
  ['Savory', 'Summer', 'herb', 60, 12, 'full', 'low', 0],
  ['Savory', 'Winter', 'herb', 90, 12, 'full', 'low', 1],
  ['Stevia', null, 'herb', 90, 12, 'full', 'medium', 0],
  ['Lemon Balm', null, 'herb', 70, 18, 'partial', 'medium', 1],
  ['Borage', null, 'herb', 55, 18, 'full', 'medium', 1],

  // === FLOWERS ===
  ['Zinnia', 'California Giant', 'flower', 75, 12, 'full', 'medium', 0],
  ['Zinnia', 'Dwarf', 'flower', 60, 8, 'full', 'medium', 0],
  ['Marigold', 'French', 'flower', 50, 8, 'full', 'low', 0],
  ['Marigold', 'African', 'flower', 60, 12, 'full', 'low', 0],
  ['Sunflower', 'Mammoth', 'flower', 80, 24, 'full', 'medium', 0],
  ['Sunflower', 'Teddy Bear', 'flower', 65, 12, 'full', 'medium', 0],
  ['Cosmos', 'Sensation', 'flower', 60, 12, 'full', 'low', 0],
  ['Nasturtium', null, 'flower', 55, 12, 'full', 'low', 0],
  ['Sweet Pea', null, 'flower', 75, 6, 'full', 'medium', 1],
  ['Snapdragon', null, 'flower', 80, 9, 'full', 'medium', 1],
  ['Calendula', null, 'flower', 55, 12, 'full', 'low', 1],
  ['Alyssum', null, 'flower', 50, 6, 'full', 'low', 1],
  ['Celosia', null, 'flower', 75, 12, 'full', 'medium', 0],
  ['Dahlia', null, 'flower', 120, 18, 'full', 'medium', 0],
  ['Larkspur', null, 'flower', 90, 12, 'full', 'medium', 1],
  ['Bachelor Button', null, 'flower', 65, 12, 'full', 'low', 1],
  ['California Poppy', null, 'flower', 60, 8, 'full', 'low', 1],
  ['Petunia', null, 'flower', 75, 12, 'full', 'medium', 0],
  ['Salvia', null, 'flower', 80, 12, 'full', 'low', 0],
  ['Verbena', null, 'flower', 90, 12, 'full', 'low', 0],
  ['Echinacea', null, 'flower', 120, 18, 'full', 'low', 1],
  ['Black-Eyed Susan', null, 'flower', 120, 18, 'full', 'low', 1],

  // === BULB FLOWERS (data cross-checked with UC Master Gardeners) ===
  ['Gladiolus', 'Standard Mix', 'flower', 90, 6, 'full', 'medium', 0],
  ['Gladiolus', 'Nanus (Dwarf)', 'flower', 70, 4, 'full', 'medium', 0],
  ['Tulip', 'Darwin Hybrid', 'flower', 120, 6, 'full', 'medium', 1],
  ['Tulip', 'Parrot', 'flower', 120, 6, 'full', 'medium', 1],
  ['Daffodil', 'King Alfred', 'flower', 90, 6, 'full', 'low', 1],
  ['Daffodil', 'Tête-à-Tête', 'flower', 90, 4, 'full', 'low', 1],
  ['Iris', 'Dutch', 'flower', 90, 4, 'full', 'medium', 1],
  ['Iris', 'Bearded', 'flower', 365, 12, 'full', 'low', 1],
  ['Ranunculus', null, 'flower', 90, 6, 'full', 'medium', 1],
  ['Anemone', 'De Caen', 'flower', 90, 6, 'partial', 'medium', 1],
  ['Freesia', null, 'flower', 100, 3, 'full', 'medium', 1],
  ['Lily', 'Asiatic', 'flower', 90, 12, 'full', 'medium', 1],
  ['Lily', 'Oriental', 'flower', 120, 12, 'partial', 'medium', 1],
  ['Crocosmia', 'Lucifer', 'flower', 90, 6, 'full', 'medium', 0],
  ['Calla Lily', null, 'flower', 75, 12, 'partial', 'medium', 0],
  ['Hyacinth', null, 'flower', 90, 6, 'full', 'medium', 1],
  ['Allium', 'Ornamental', 'flower', 90, 8, 'full', 'low', 1],
  ['Amaryllis', null, 'flower', 60, 12, 'partial', 'medium', 0],

  // === FRUITS ===
  ['Strawberry', 'Everbearing', 'fruit', 90, 12, 'full', 'medium', 1],
  ['Strawberry', 'June-bearing', 'fruit', 365, 12, 'full', 'medium', 1],
  ['Blueberry', null, 'fruit', 730, 48, 'full', 'medium', 1],
  ['Raspberry', null, 'fruit', 365, 24, 'full', 'medium', 1],
  ['Blackberry', null, 'fruit', 365, 36, 'full', 'medium', 1],
  ['Grape', null, 'fruit', 730, 72, 'full', 'low', 1],
  ['Fig', null, 'fruit', 365, 120, 'full', 'low', 1],
  ['Passion Fruit', null, 'fruit', 365, 120, 'full', 'medium', 0],

  // === COVER CROPS ===
  ['Crimson Clover', null, 'cover_crop', 90, 6, 'full', 'low', 1],
  ['Fava Beans', null, 'cover_crop', 90, 6, 'full', 'low', 1],
  ['Winter Rye', null, 'cover_crop', 120, 4, 'full', 'low', 1],
  ['Buckwheat', null, 'cover_crop', 45, 4, 'full', 'low', 0],
  ['Austrian Winter Peas', null, 'cover_crop', 90, 4, 'full', 'low', 1],
  ['Hairy Vetch', null, 'cover_crop', 120, 4, 'full', 'low', 1],
  ['White Clover', null, 'cover_crop', 90, 4, 'partial', 'medium', 1],
  ['Oats', null, 'cover_crop', 60, 4, 'full', 'low', 1],
  ['Mustard', 'Cover Crop', 'cover_crop', 45, 6, 'full', 'low', 1],
];

const insertMany = db.transaction((plants) => {
  for (const plant of plants) {
    seedPlants.run(...plant);
  }
});

insertMany(zone10aPlants);
console.log('Seeded', zone10aPlants.length, 'plants for zone 10a (LA County/South Coast)');

// Add notes for bulbs with special care requirements (per UC Master Gardeners)
const updateNotes = db.prepare(`
  UPDATE plants SET notes = ? WHERE name = ? AND (variety = ? OR (variety IS NULL AND ? IS NULL))
`);

const bulbNotes = [
  ['Tulip', 'Darwin Hybrid', 'Requires 6-8 weeks refrigerator chilling before planting. Store in paper bag away from fruit. Treat as annual in zone 10b.'],
  ['Tulip', 'Parrot', 'Requires 6-8 weeks refrigerator chilling before planting. Store in paper bag away from fruit. Treat as annual in zone 10b.'],
  ['Hyacinth', null, 'Requires 6-8 weeks refrigerator chilling before planting. Store in paper bag away from fruit.'],
  ['Gladiolus', 'Standard Mix', 'Plant corms at 2-week intervals for extended bloom. Can overwinter in ground in zone 10b. Superb cut flower.'],
  ['Gladiolus', 'Nanus (Dwarf)', 'Plant corms at 2-week intervals for extended bloom. Can overwinter in ground in zone 10b.'],
  ['Ranunculus', null, 'Soak tubers in water for 45 minutes before planting. Plant with "toes" pointing down. Prefers excellent drainage.'],
  ['Anemone', 'De Caen', 'Soak tubers before planting. Plant with scarred side up in full sun.'],
  ['Daffodil', 'King Alfred', 'Rodent-resistant due to bitter taste. Naturalizes well. No chilling required in zone 10b.'],
  ['Daffodil', 'Tête-à-Tête', 'Rodent-resistant due to bitter taste. Naturalizes well. No chilling required in zone 10b.'],
  ['Freesia', null, 'Naturalizes well in zone 10b. Fragrant cut flower.'],
  ['Calla Lily', null, 'Requires consistent moisture. Can be grown in containers or pond margins.'],
];

const insertBulbNotes = db.transaction((notes) => {
  for (const [name, variety, note] of notes) {
    updateNotes.run(note, name, variety, variety);
  }
});

insertBulbNotes(bulbNotes);
console.log('Added care notes for', bulbNotes.length, 'bulb varieties');

// Add planting windows for zone 10b (rough guidelines)
const seedWindow = db.prepare(`
  INSERT OR IGNORE INTO planting_windows (plant_id, window_type, start_month, end_month)
  SELECT id, ?, ?, ? FROM plants WHERE name = ? AND (variety = ? OR (variety IS NULL AND ? IS NULL))
`);

// Zone 10a planting windows based on UC Master Gardener South Coast guide
const zone10aWindows = [
  // === TOMATOES (UC: transplant Apr-Jul 15; indoor start 6-8 weeks before) ===
  ['Tomato', 'Cherokee Purple', 'indoor_start', 2, 4],
  ['Tomato', 'Cherokee Purple', 'transplant', 4, 7],
  ['Tomato', 'Sun Gold', 'indoor_start', 2, 4],
  ['Tomato', 'Sun Gold', 'transplant', 4, 7],
  ['Tomato', 'Brandywine', 'indoor_start', 2, 4],
  ['Tomato', 'Brandywine', 'transplant', 4, 7],
  ['Tomato', 'Roma', 'indoor_start', 2, 4],
  ['Tomato', 'Roma', 'transplant', 4, 7],
  ['Tomato', 'Early Girl', 'indoor_start', 2, 4],
  ['Tomato', 'Early Girl', 'transplant', 4, 7],
  ['Tomato', 'San Marzano', 'indoor_start', 2, 4],
  ['Tomato', 'San Marzano', 'transplant', 4, 7],
  ['Tomato', 'Cherry (Sweet 100)', 'indoor_start', 2, 4],
  ['Tomato', 'Cherry (Sweet 100)', 'transplant', 4, 7],
  ['Tomato', 'Beefsteak', 'indoor_start', 2, 4],
  ['Tomato', 'Beefsteak', 'transplant', 4, 7],
  ['Tomato', 'Green Zebra', 'indoor_start', 2, 4],
  ['Tomato', 'Green Zebra', 'transplant', 4, 7],
  ['Tomato', 'Black Krim', 'indoor_start', 2, 4],
  ['Tomato', 'Black Krim', 'transplant', 4, 7],

  // === PEPPERS (UC: transplant Apr-May; indoor start 8-10 weeks before) ===
  ['Pepper', 'California Wonder', 'indoor_start', 1, 3],
  ['Pepper', 'California Wonder', 'transplant', 4, 5],
  ['Pepper', 'Jalapeño', 'indoor_start', 1, 3],
  ['Pepper', 'Jalapeño', 'transplant', 4, 5],
  ['Pepper', 'Serrano', 'indoor_start', 1, 3],
  ['Pepper', 'Serrano', 'transplant', 4, 5],
  ['Pepper', 'Poblano', 'indoor_start', 1, 3],
  ['Pepper', 'Poblano', 'transplant', 4, 5],
  ['Pepper', 'Anaheim', 'indoor_start', 1, 3],
  ['Pepper', 'Anaheim', 'transplant', 4, 5],
  ['Pepper', 'Habanero', 'indoor_start', 1, 3],
  ['Pepper', 'Habanero', 'transplant', 4, 6],
  ['Pepper', 'Bell (Red)', 'indoor_start', 1, 3],
  ['Pepper', 'Bell (Red)', 'transplant', 4, 5],
  ['Pepper', 'Banana', 'indoor_start', 1, 3],
  ['Pepper', 'Banana', 'transplant', 4, 5],
  ['Pepper', 'Shishito', 'indoor_start', 1, 3],
  ['Pepper', 'Shishito', 'transplant', 4, 5],
  ['Pepper', 'Padron', 'indoor_start', 1, 3],
  ['Pepper', 'Padron', 'transplant', 4, 5],

  // === SQUASH (UC: direct sow Apr-Jun) ===
  ['Zucchini', 'Black Beauty', 'direct_sow', 4, 6],
  ['Zucchini', 'Costata Romanesco', 'direct_sow', 4, 6],
  ['Summer Squash', 'Yellow Crookneck', 'direct_sow', 4, 6],
  ['Summer Squash', 'Pattypan', 'direct_sow', 4, 6],
  ['Winter Squash', 'Butternut', 'direct_sow', 4, 6],
  ['Winter Squash', 'Acorn', 'direct_sow', 4, 6],
  ['Winter Squash', 'Delicata', 'direct_sow', 4, 6],
  ['Winter Squash', 'Spaghetti', 'direct_sow', 4, 6],
  ['Pumpkin', 'Sugar Pie', 'direct_sow', 5, 6],
  ['Pumpkin', 'Jack O Lantern', 'direct_sow', 5, 6],
  // === CUCUMBERS (UC: direct sow Apr-Jun) ===
  ['Cucumber', 'Marketmore', 'direct_sow', 4, 6],
  ['Cucumber', 'Lemon', 'direct_sow', 4, 6],
  ['Cucumber', 'Armenian', 'direct_sow', 4, 6],
  ['Cucumber', 'Persian', 'direct_sow', 4, 6],
  // === MELONS (UC: direct sow Apr-May) ===
  ['Melon', 'Cantaloupe', 'direct_sow', 4, 5],
  ['Melon', 'Honeydew', 'direct_sow', 4, 5],
  ['Watermelon', 'Sugar Baby', 'direct_sow', 4, 6],
  ['Watermelon', 'Crimson Sweet', 'direct_sow', 4, 6],

  // === LEAFY GREENS (UC: lettuce Aug-Apr, spinach Aug-Mar) ===
  ['Lettuce', 'Butterhead', 'direct_sow', 8, 4],
  ['Lettuce', 'Romaine', 'direct_sow', 8, 4],
  ['Lettuce', 'Red Leaf', 'direct_sow', 8, 4],
  ['Lettuce', 'Oak Leaf', 'direct_sow', 8, 4],
  ['Lettuce', 'Iceberg', 'direct_sow', 8, 4],
  ['Spinach', 'Bloomsdale', 'direct_sow', 8, 3],
  ['Spinach', 'Baby Leaf', 'direct_sow', 8, 3],
  ['Arugula', null, 'direct_sow', 8, 4],
  ['Kale', 'Lacinato', 'direct_sow', 8, 10],
  ['Kale', 'Red Russian', 'direct_sow', 8, 10],
  ['Kale', 'Curly', 'direct_sow', 8, 10],
  ['Swiss Chard', 'Rainbow', 'direct_sow', 8, 4],
  ['Swiss Chard', 'Fordhook Giant', 'direct_sow', 8, 4],
  ['Collard Greens', null, 'direct_sow', 8, 3],
  ['Mustard Greens', null, 'direct_sow', 8, 3],
  ['Bok Choy', null, 'direct_sow', 8, 3],
  ['Mache', null, 'direct_sow', 9, 2],
  ['Endive', 'Frisee', 'direct_sow', 8, 2],
  ['Radicchio', null, 'direct_sow', 8, 11],

  // === BRASSICAS (UC: broccoli start Jun-Jul & Jan-Feb, transplant Sep-Dec; cabbage Aug-Feb) ===
  ['Broccoli', 'Calabrese', 'indoor_start', 6, 7],
  ['Broccoli', 'Calabrese', 'transplant', 9, 12],
  ['Broccoli', 'Di Cicco', 'indoor_start', 6, 7],
  ['Broccoli', 'Di Cicco', 'transplant', 9, 12],
  ['Cauliflower', 'Snowball', 'indoor_start', 7, 10],
  ['Cauliflower', 'Snowball', 'transplant', 9, 12],
  ['Cauliflower', 'Purple', 'indoor_start', 7, 10],
  ['Cauliflower', 'Purple', 'transplant', 9, 12],
  ['Cabbage', 'Green', 'indoor_start', 6, 12],
  ['Cabbage', 'Green', 'transplant', 8, 2],
  ['Cabbage', 'Red', 'indoor_start', 6, 12],
  ['Cabbage', 'Red', 'transplant', 8, 2],
  ['Cabbage', 'Napa', 'direct_sow', 8, 2],
  ['Brussels Sprouts', null, 'indoor_start', 6, 8],
  ['Brussels Sprouts', null, 'transplant', 8, 11],
  ['Kohlrabi', null, 'direct_sow', 1, 9],

  // === ROOT VEGETABLES (UC: carrots Jan-Sep, beets Jan-Sep, potatoes Feb-May & Jun-Aug) ===
  ['Carrot', 'Nantes', 'direct_sow', 1, 9],
  ['Carrot', 'Chantenay', 'direct_sow', 1, 9],
  ['Carrot', 'Purple Haze', 'direct_sow', 1, 9],
  ['Beet', 'Detroit Dark Red', 'direct_sow', 1, 9],
  ['Beet', 'Chioggia', 'direct_sow', 1, 9],
  ['Beet', 'Golden', 'direct_sow', 1, 9],
  ['Radish', 'Cherry Belle', 'direct_sow', 9, 4],
  ['Radish', 'French Breakfast', 'direct_sow', 9, 4],
  ['Radish', 'Watermelon', 'direct_sow', 9, 12],
  ['Radish', 'Daikon', 'direct_sow', 9, 12],
  ['Turnip', 'Purple Top', 'direct_sow', 9, 2],
  ['Turnip', 'Hakurei', 'direct_sow', 9, 3],
  ['Parsnip', null, 'direct_sow', 3, 7],
  ['Rutabaga', null, 'direct_sow', 8, 11],
  ['Sweet Potato', 'Beauregard', 'transplant', 4, 5],
  ['Sweet Potato', 'Japanese', 'transplant', 4, 5],
  ['Potato', 'Yukon Gold', 'direct_sow', 2, 8],
  ['Potato', 'Red', 'direct_sow', 2, 8],
  ['Potato', 'Fingerling', 'direct_sow', 2, 8],

  // === ALLIUMS (UC: onions Feb-Oct, green onions all year, garlic Oct-Dec) ===
  ['Onion', 'Yellow', 'transplant', 2, 10],
  ['Onion', 'Red', 'transplant', 2, 10],
  ['Onion', 'White', 'transplant', 2, 10],
  ['Green Onion', null, 'direct_sow', 1, 12],
  ['Shallot', null, 'direct_sow', 10, 12],
  ['Leek', null, 'indoor_start', 8, 11],
  ['Leek', null, 'transplant', 10, 1],
  ['Garlic', 'Softneck', 'direct_sow', 10, 12],
  ['Garlic', 'Hardneck', 'direct_sow', 10, 12],
  ['Chives', null, 'direct_sow', 1, 12],

  // === LEGUMES (UC: beans Mar-Aug) ===
  ['Beans', 'Blue Lake', 'direct_sow', 3, 8],
  ['Beans', 'Kentucky Wonder', 'direct_sow', 3, 8],
  ['Beans', 'Dragon Tongue', 'direct_sow', 3, 8],
  ['Beans', 'Scarlet Runner', 'direct_sow', 3, 8],
  ['Beans', 'Black', 'direct_sow', 4, 7],
  ['Peas', 'Sugar Snap', 'direct_sow', 10, 2],
  ['Peas', 'Snow Pea', 'direct_sow', 10, 2],
  ['Peas', 'Shelling', 'direct_sow', 10, 2],
  ['Edamame', null, 'direct_sow', 4, 7],

  // === EGGPLANT & NIGHTSHADES (UC: transplant Apr-May) ===
  ['Eggplant', 'Black Beauty', 'indoor_start', 1, 3],
  ['Eggplant', 'Black Beauty', 'transplant', 4, 5],
  ['Eggplant', 'Japanese', 'indoor_start', 1, 3],
  ['Eggplant', 'Japanese', 'transplant', 4, 5],
  ['Eggplant', 'Rosa Bianca', 'indoor_start', 1, 3],
  ['Eggplant', 'Rosa Bianca', 'transplant', 4, 5],
  ['Tomatillo', null, 'indoor_start', 1, 3],
  ['Tomatillo', null, 'transplant', 4, 5],
  ['Ground Cherry', null, 'indoor_start', 1, 3],
  ['Ground Cherry', null, 'transplant', 4, 5],

  // === OTHER VEGETABLES (UC: corn Mar-Jul, okra Apr-May) ===
  ['Corn', 'Golden Bantam', 'direct_sow', 3, 7],
  ['Corn', 'Silver Queen', 'direct_sow', 3, 7],
  ['Okra', 'Clemson Spineless', 'direct_sow', 4, 5],
  ['Artichoke', 'Green Globe', 'transplant', 9, 11],
  ['Asparagus', 'Mary Washington', 'transplant', 1, 3],
  ['Celery', null, 'indoor_start', 8, 10],
  ['Celery', null, 'transplant', 10, 12],
  ['Fennel', 'Florence', 'direct_sow', 9, 3],
  ['Rhubarb', null, 'transplant', 11, 2],

  // === HERBS ===
  ['Basil', 'Genovese', 'direct_sow', 3, 9],
  ['Basil', 'Thai', 'direct_sow', 3, 9],
  ['Basil', 'Purple', 'direct_sow', 3, 9],
  ['Basil', 'Lemon', 'direct_sow', 3, 9],
  ['Cilantro', null, 'direct_sow', 9, 3],
  ['Parsley', 'Italian', 'direct_sow', 9, 4],
  ['Parsley', 'Curly', 'direct_sow', 9, 4],
  ['Dill', null, 'direct_sow', 9, 4],
  ['Oregano', null, 'direct_sow', 3, 5],
  ['Oregano', null, 'transplant', 3, 10],
  ['Thyme', null, 'transplant', 3, 10],
  ['Rosemary', null, 'transplant', 3, 10],
  ['Sage', null, 'transplant', 3, 10],
  ['Mint', 'Spearmint', 'transplant', 3, 10],
  ['Mint', 'Peppermint', 'transplant', 3, 10],
  ['Lavender', null, 'transplant', 3, 5],
  ['Lemongrass', null, 'transplant', 4, 8],
  ['Chamomile', null, 'direct_sow', 9, 3],
  ['Tarragon', null, 'transplant', 3, 5],
  ['Marjoram', null, 'direct_sow', 3, 5],
  ['Chervil', null, 'direct_sow', 9, 3],
  ['Savory', 'Summer', 'direct_sow', 3, 5],
  ['Savory', 'Winter', 'transplant', 3, 5],
  ['Stevia', null, 'transplant', 4, 8],
  ['Lemon Balm', null, 'transplant', 3, 10],
  ['Borage', null, 'direct_sow', 9, 4],

  // === FLOWERS (per UC Santa Clara cut flower chart) ===
  ['Zinnia', 'California Giant', 'direct_sow', 4, 6],
  ['Zinnia', 'Dwarf', 'direct_sow', 4, 6],
  ['Marigold', 'French', 'direct_sow', 4, 6],
  ['Marigold', 'African', 'direct_sow', 4, 6],
  ['Sunflower', 'Mammoth', 'direct_sow', 5, 9],
  ['Sunflower', 'Teddy Bear', 'direct_sow', 5, 9],
  ['Cosmos', 'Sensation', 'direct_sow', 4, 6],
  ['Nasturtium', null, 'direct_sow', 3, 10],
  ['Sweet Pea', null, 'direct_sow', 8, 3],
  ['Snapdragon', null, 'indoor_start', 2, 8],
  ['Snapdragon', null, 'transplant', 4, 11],
  ['Calendula', null, 'direct_sow', 9, 3],
  ['Alyssum', null, 'direct_sow', 9, 4],
  ['Celosia', null, 'indoor_start', 2, 3],
  ['Celosia', null, 'transplant', 5, 6],
  ['Dahlia', null, 'transplant', 4, 5],
  ['Larkspur', null, 'direct_sow', 10, 12],
  ['Bachelor Button', null, 'direct_sow', 9, 3],
  ['California Poppy', null, 'direct_sow', 10, 2],
  ['Petunia', null, 'transplant', 4, 5],
  ['Salvia', null, 'transplant', 4, 5],
  ['Verbena', null, 'transplant', 4, 5],
  ['Echinacea', null, 'transplant', 4, 5],
  ['Black-Eyed Susan', null, 'direct_sow', 4, 5],

  // === BULB FLOWERS (zone 10b planting times per UC Master Gardeners) ===
  ['Gladiolus', 'Standard Mix', 'direct_sow', 2, 7],
  ['Gladiolus', 'Nanus (Dwarf)', 'direct_sow', 2, 7],
  ['Tulip', 'Darwin Hybrid', 'direct_sow', 11, 12],
  ['Tulip', 'Parrot', 'direct_sow', 11, 12],
  ['Daffodil', 'King Alfred', 'direct_sow', 9, 12],
  ['Daffodil', 'Tête-à-Tête', 'direct_sow', 9, 12],
  ['Iris', 'Dutch', 'direct_sow', 9, 12],
  ['Iris', 'Bearded', 'transplant', 8, 10],
  ['Ranunculus', null, 'direct_sow', 9, 12],
  ['Anemone', 'De Caen', 'direct_sow', 9, 12],
  ['Freesia', null, 'direct_sow', 9, 11],
  ['Lily', 'Asiatic', 'direct_sow', 9, 3],
  ['Lily', 'Oriental', 'direct_sow', 9, 3],
  ['Crocosmia', 'Lucifer', 'direct_sow', 2, 5],
  ['Calla Lily', null, 'direct_sow', 10, 4],
  ['Hyacinth', null, 'direct_sow', 11, 12],
  ['Allium', 'Ornamental', 'direct_sow', 9, 11],
  ['Amaryllis', null, 'indoor_start', 10, 2],

  // === FRUITS ===
  ['Strawberry', 'Everbearing', 'transplant', 10, 2],
  ['Strawberry', 'June-bearing', 'transplant', 10, 2],
  ['Blueberry', null, 'transplant', 12, 2],
  ['Raspberry', null, 'transplant', 12, 2],
  ['Blackberry', null, 'transplant', 12, 2],
  ['Grape', null, 'transplant', 1, 3],
  ['Fig', null, 'transplant', 1, 3],
  ['Passion Fruit', null, 'transplant', 3, 5],

  // === COVER CROPS ===
  ['Crimson Clover', null, 'direct_sow', 9, 11],
  ['Fava Beans', null, 'direct_sow', 10, 12],
  ['Winter Rye', null, 'direct_sow', 9, 11],
  ['Buckwheat', null, 'direct_sow', 4, 8],
  ['Austrian Winter Peas', null, 'direct_sow', 9, 11],
  ['Hairy Vetch', null, 'direct_sow', 9, 11],
  ['White Clover', null, 'direct_sow', 9, 4],
  ['Oats', null, 'direct_sow', 9, 11],
  ['Mustard', 'Cover Crop', 'direct_sow', 9, 11],
];

const insertWindows = db.transaction((windows) => {
  for (const [name, variety, windowType, startMonth, endMonth] of windows) {
    seedWindow.run(windowType, startMonth, endMonth, name, variety, variety);
  }
});

insertWindows(zone10aWindows);
console.log('Seeded planting windows for zone 10a (LA County/South Coast)');

// Seed companion planting relationships
const seedCompanion = db.prepare(`
  INSERT OR IGNORE INTO companion_relationships (plant_name_a, plant_name_b, relationship, notes)
  VALUES (?, ?, ?, ?)
`);

const companionRelationships = [
  // === TOMATO COMPANIONS ===
  ['Tomato', 'Basil', 'good', 'Basil repels pests and may improve tomato flavor'],
  ['Tomato', 'Carrot', 'good', 'Carrots loosen soil for tomato roots'],
  ['Tomato', 'Parsley', 'good', 'Parsley attracts beneficial insects'],
  ['Tomato', 'Marigold', 'good', 'Marigolds repel nematodes and whiteflies'],
  ['Tomato', 'Nasturtium', 'good', 'Nasturtiums trap aphids away from tomatoes'],
  ['Tomato', 'Pepper', 'good', 'Same family, similar needs'],
  ['Tomato', 'Onion', 'good', 'Onions deter pests'],
  ['Tomato', 'Garlic', 'good', 'Garlic repels spider mites'],
  ['Tomato', 'Lettuce', 'good', 'Lettuce benefits from tomato shade'],
  ['Tomato', 'Spinach', 'good', 'Spinach benefits from tomato shade'],
  ['Tomato', 'Celery', 'good', 'Good growing companions'],
  ['Tomato', 'Chives', 'good', 'Chives deter aphids'],
  ['Tomato', 'Asparagus', 'good', 'Tomatoes repel asparagus beetle'],
  ['Tomato', 'Brassica', 'bad', 'Compete for nutrients, stunt growth'],
  ['Tomato', 'Broccoli', 'bad', 'Compete for nutrients'],
  ['Tomato', 'Cabbage', 'bad', 'Compete for nutrients'],
  ['Tomato', 'Cauliflower', 'bad', 'Compete for nutrients'],
  ['Tomato', 'Kale', 'bad', 'Compete for nutrients'],
  ['Tomato', 'Corn', 'bad', 'Both attract same pests (tomato hornworm/corn earworm)'],
  ['Tomato', 'Fennel', 'bad', 'Fennel inhibits tomato growth'],
  ['Tomato', 'Dill', 'bad', 'Mature dill stunts tomato growth'],
  ['Tomato', 'Potato', 'bad', 'Both susceptible to blight, compete for nutrients'],
  ['Tomato', 'Eggplant', 'bad', 'Same family, share diseases and pests'],
  ['Tomato', 'Walnut', 'bad', 'Walnut releases growth-inhibiting juglone'],

  // === PEPPER COMPANIONS ===
  ['Pepper', 'Basil', 'good', 'Basil repels aphids and spider mites'],
  ['Pepper', 'Tomato', 'good', 'Same family, similar needs'],
  ['Pepper', 'Carrot', 'good', 'Good space utilization'],
  ['Pepper', 'Onion', 'good', 'Onions deter pests'],
  ['Pepper', 'Spinach', 'good', 'Spinach provides ground cover'],
  ['Pepper', 'Lettuce', 'good', 'Lettuce provides ground cover'],
  ['Pepper', 'Parsley', 'good', 'Attracts beneficial insects'],
  ['Pepper', 'Marigold', 'good', 'Marigolds repel pests'],
  ['Pepper', 'Fennel', 'bad', 'Fennel inhibits pepper growth'],
  ['Pepper', 'Beans', 'bad', 'Beans can spread diseases to peppers'],
  ['Pepper', 'Brassica', 'bad', 'Compete for nutrients'],

  // === BEAN COMPANIONS ===
  ['Beans', 'Corn', 'good', 'Classic Three Sisters - beans fix nitrogen, climb corn'],
  ['Beans', 'Squash', 'good', 'Three Sisters - squash shades soil'],
  ['Beans', 'Cucumber', 'good', 'Beans fix nitrogen for cucumbers'],
  ['Beans', 'Carrot', 'good', 'Beans add nitrogen to soil'],
  ['Beans', 'Beet', 'good', 'Beans add nitrogen to soil'],
  ['Beans', 'Cabbage', 'good', 'Beans add nitrogen for heavy feeders'],
  ['Beans', 'Celery', 'good', 'Good companions'],
  ['Beans', 'Marigold', 'good', 'Marigolds repel bean beetles'],
  ['Beans', 'Nasturtium', 'good', 'Nasturtiums trap aphids'],
  ['Beans', 'Rosemary', 'good', 'Rosemary deters bean beetles'],
  ['Beans', 'Onion', 'bad', 'Onions stunt bean growth'],
  ['Beans', 'Garlic', 'bad', 'Garlic stunts bean growth'],
  ['Beans', 'Chives', 'bad', 'Alliums stunt bean growth'],
  ['Beans', 'Leek', 'bad', 'Alliums stunt bean growth'],
  ['Beans', 'Shallot', 'bad', 'Alliums stunt bean growth'],
  ['Beans', 'Pepper', 'bad', 'Can spread diseases'],
  ['Beans', 'Fennel', 'bad', 'Fennel inhibits most plants'],

  // === CARROT COMPANIONS ===
  ['Carrot', 'Onion', 'good', 'Onions repel carrot fly, carrots repel onion fly'],
  ['Carrot', 'Leek', 'good', 'Leeks repel carrot fly'],
  ['Carrot', 'Lettuce', 'good', 'Good space utilization'],
  ['Carrot', 'Tomato', 'good', 'Tomatoes provide shade'],
  ['Carrot', 'Rosemary', 'good', 'Rosemary repels carrot fly'],
  ['Carrot', 'Sage', 'good', 'Sage repels carrot fly'],
  ['Carrot', 'Chives', 'good', 'Chives repel carrot fly'],
  ['Carrot', 'Beans', 'good', 'Beans add nitrogen'],
  ['Carrot', 'Peas', 'good', 'Peas add nitrogen'],
  ['Carrot', 'Radish', 'good', 'Radishes loosen soil, mark rows'],
  ['Carrot', 'Dill', 'bad', 'Dill can cross-pollinate and stunt carrots'],
  ['Carrot', 'Fennel', 'bad', 'Fennel inhibits carrot growth'],
  ['Carrot', 'Parsnip', 'bad', 'Attract same pests'],

  // === CUCUMBER COMPANIONS ===
  ['Cucumber', 'Beans', 'good', 'Beans fix nitrogen'],
  ['Cucumber', 'Peas', 'good', 'Peas fix nitrogen'],
  ['Cucumber', 'Corn', 'good', 'Corn provides support and shade'],
  ['Cucumber', 'Sunflower', 'good', 'Sunflowers attract pollinators'],
  ['Cucumber', 'Lettuce', 'good', 'Good ground cover'],
  ['Cucumber', 'Radish', 'good', 'Radishes deter cucumber beetles'],
  ['Cucumber', 'Marigold', 'good', 'Marigolds repel pests'],
  ['Cucumber', 'Nasturtium', 'good', 'Nasturtiums repel pests'],
  ['Cucumber', 'Dill', 'good', 'Dill attracts beneficial insects'],
  ['Cucumber', 'Oregano', 'good', 'Oregano repels pests'],
  ['Cucumber', 'Potato', 'bad', 'Compete for nutrients, cucumbers make potatoes more susceptible to blight'],
  ['Cucumber', 'Melon', 'bad', 'Can cross-pollinate, attract same pests'],
  ['Cucumber', 'Aromatic herbs', 'bad', 'Strong herbs can stunt cucumber growth'],

  // === LETTUCE COMPANIONS ===
  ['Lettuce', 'Carrot', 'good', 'Different root depths, good space use'],
  ['Lettuce', 'Radish', 'good', 'Radishes mature quickly, mark rows'],
  ['Lettuce', 'Strawberry', 'good', 'Good ground cover combination'],
  ['Lettuce', 'Chives', 'good', 'Chives repel aphids'],
  ['Lettuce', 'Onion', 'good', 'Onions repel pests'],
  ['Lettuce', 'Garlic', 'good', 'Garlic repels aphids'],
  ['Lettuce', 'Beet', 'good', 'Different root depths'],
  ['Lettuce', 'Spinach', 'good', 'Similar growing conditions'],
  ['Lettuce', 'Corn', 'good', 'Corn provides shade in summer'],
  ['Lettuce', 'Tomato', 'good', 'Tomatoes provide shade'],
  ['Lettuce', 'Celery', 'bad', 'Both attract similar pests'],

  // === SQUASH/ZUCCHINI COMPANIONS ===
  ['Squash', 'Corn', 'good', 'Three Sisters planting'],
  ['Squash', 'Beans', 'good', 'Three Sisters planting'],
  ['Squash', 'Nasturtium', 'good', 'Nasturtiums repel squash bugs'],
  ['Squash', 'Marigold', 'good', 'Marigolds repel pests'],
  ['Squash', 'Radish', 'good', 'Radishes deter squash borers'],
  ['Squash', 'Borage', 'good', 'Borage deters worms, attracts pollinators'],
  ['Squash', 'Oregano', 'good', 'Oregano repels pests'],
  ['Squash', 'Sunflower', 'good', 'Sunflowers attract pollinators'],
  ['Squash', 'Potato', 'bad', 'Both heavy feeders, compete for nutrients'],
  ['Zucchini', 'Corn', 'good', 'Three Sisters planting'],
  ['Zucchini', 'Beans', 'good', 'Three Sisters planting'],
  ['Zucchini', 'Nasturtium', 'good', 'Nasturtiums repel squash bugs'],
  ['Zucchini', 'Marigold', 'good', 'Marigolds repel pests'],
  ['Zucchini', 'Radish', 'good', 'Radishes deter squash borers'],
  ['Zucchini', 'Borage', 'good', 'Borage deters worms'],
  ['Zucchini', 'Potato', 'bad', 'Compete for nutrients'],

  // === BRASSICA (Cabbage family) COMPANIONS ===
  ['Broccoli', 'Onion', 'good', 'Onions deter cabbage pests'],
  ['Broccoli', 'Garlic', 'good', 'Garlic deters pests'],
  ['Broccoli', 'Beet', 'good', 'Good companions'],
  ['Broccoli', 'Celery', 'good', 'Celery repels cabbage butterfly'],
  ['Broccoli', 'Chamomile', 'good', 'Chamomile improves flavor'],
  ['Broccoli', 'Dill', 'good', 'Dill attracts beneficial wasps'],
  ['Broccoli', 'Nasturtium', 'good', 'Nasturtiums trap aphids'],
  ['Broccoli', 'Tomato', 'bad', 'Compete for calcium and nutrients'],
  ['Broccoli', 'Strawberry', 'bad', 'Both attract similar pests'],
  ['Cabbage', 'Onion', 'good', 'Onions deter cabbage pests'],
  ['Cabbage', 'Celery', 'good', 'Celery repels cabbage butterfly'],
  ['Cabbage', 'Dill', 'good', 'Dill attracts beneficial wasps'],
  ['Cabbage', 'Thyme', 'good', 'Thyme deters cabbage worms'],
  ['Cabbage', 'Tomato', 'bad', 'Compete for nutrients'],
  ['Cabbage', 'Strawberry', 'bad', 'Attract similar pests'],
  ['Kale', 'Beet', 'good', 'Good companions'],
  ['Kale', 'Celery', 'good', 'Celery repels pests'],
  ['Kale', 'Onion', 'good', 'Onions deter pests'],
  ['Kale', 'Tomato', 'bad', 'Compete for nutrients'],
  ['Cauliflower', 'Celery', 'good', 'Celery repels cabbage butterfly'],
  ['Cauliflower', 'Beans', 'good', 'Beans add nitrogen'],
  ['Cauliflower', 'Tomato', 'bad', 'Compete for nutrients'],

  // === ALLIUM (Onion family) COMPANIONS ===
  ['Onion', 'Carrot', 'good', 'Onions repel carrot fly'],
  ['Onion', 'Beet', 'good', 'Good companions'],
  ['Onion', 'Lettuce', 'good', 'Onions repel pests'],
  ['Onion', 'Tomato', 'good', 'Onions deter pests'],
  ['Onion', 'Pepper', 'good', 'Onions deter pests'],
  ['Onion', 'Strawberry', 'good', 'Onions deter pests'],
  ['Onion', 'Chamomile', 'good', 'Chamomile improves onion flavor'],
  ['Onion', 'Beans', 'bad', 'Onions stunt bean growth'],
  ['Onion', 'Peas', 'bad', 'Onions stunt pea growth'],
  ['Garlic', 'Tomato', 'good', 'Garlic repels spider mites'],
  ['Garlic', 'Pepper', 'good', 'Garlic deters pests'],
  ['Garlic', 'Lettuce', 'good', 'Garlic repels aphids'],
  ['Garlic', 'Beet', 'good', 'Good companions'],
  ['Garlic', 'Carrot', 'good', 'Garlic repels carrot fly'],
  ['Garlic', 'Strawberry', 'good', 'Garlic deters pests'],
  ['Garlic', 'Beans', 'bad', 'Garlic stunts bean growth'],
  ['Garlic', 'Peas', 'bad', 'Garlic stunts pea growth'],

  // === HERB COMPANIONS ===
  ['Basil', 'Tomato', 'good', 'Classic companion, improves flavor'],
  ['Basil', 'Pepper', 'good', 'Basil repels pests'],
  ['Basil', 'Oregano', 'good', 'Good herb garden companions'],
  ['Basil', 'Parsley', 'good', 'Good herb garden companions'],
  ['Basil', 'Rue', 'bad', 'Rue inhibits basil growth'],
  ['Basil', 'Sage', 'bad', 'Different water needs'],
  ['Cilantro', 'Spinach', 'good', 'Similar growing conditions'],
  ['Cilantro', 'Tomato', 'good', 'Cilantro repels spider mites'],
  ['Cilantro', 'Fennel', 'bad', 'Can cross-pollinate poorly'],
  ['Dill', 'Cabbage', 'good', 'Dill attracts beneficial wasps'],
  ['Dill', 'Lettuce', 'good', 'Dill attracts beneficial insects'],
  ['Dill', 'Cucumber', 'good', 'Young dill is beneficial'],
  ['Dill', 'Carrot', 'bad', 'Cross-pollination issues'],
  ['Dill', 'Tomato', 'bad', 'Mature dill stunts tomatoes'],
  ['Oregano', 'Pepper', 'good', 'Oregano repels pests'],
  ['Oregano', 'Tomato', 'good', 'Oregano repels pests'],
  ['Oregano', 'Squash', 'good', 'Oregano repels pests'],
  ['Rosemary', 'Beans', 'good', 'Rosemary repels bean beetles'],
  ['Rosemary', 'Cabbage', 'good', 'Rosemary repels cabbage moth'],
  ['Rosemary', 'Carrot', 'good', 'Rosemary repels carrot fly'],
  ['Sage', 'Cabbage', 'good', 'Sage repels cabbage moth'],
  ['Sage', 'Carrot', 'good', 'Sage repels carrot fly'],
  ['Sage', 'Tomato', 'good', 'Sage repels pests'],
  ['Thyme', 'Cabbage', 'good', 'Thyme repels cabbage worm'],
  ['Thyme', 'Tomato', 'good', 'Thyme repels pests'],
  ['Mint', 'Cabbage', 'good', 'Mint repels cabbage moth'],
  ['Mint', 'Tomato', 'good', 'Mint repels pests'],
  ['Chives', 'Carrot', 'good', 'Chives repel carrot fly'],
  ['Chives', 'Tomato', 'good', 'Chives deter aphids'],
  ['Chives', 'Apple', 'good', 'Chives prevent apple scab'],

  // === FLOWER COMPANIONS ===
  ['Marigold', 'Tomato', 'good', 'Marigolds repel nematodes'],
  ['Marigold', 'Pepper', 'good', 'Marigolds repel aphids'],
  ['Marigold', 'Squash', 'good', 'Marigolds repel pests'],
  ['Marigold', 'Melon', 'good', 'Marigolds repel pests'],
  ['Marigold', 'Cucumber', 'good', 'Marigolds repel beetles'],
  ['Marigold', 'Potato', 'good', 'Marigolds repel pests'],
  ['Nasturtium', 'Tomato', 'good', 'Nasturtiums trap aphids'],
  ['Nasturtium', 'Cucumber', 'good', 'Nasturtiums repel beetles'],
  ['Nasturtium', 'Squash', 'good', 'Nasturtiums repel squash bugs'],
  ['Nasturtium', 'Cabbage', 'good', 'Nasturtiums trap caterpillars'],
  ['Sunflower', 'Corn', 'good', 'Attract pollinators'],
  ['Sunflower', 'Cucumber', 'good', 'Sunflowers attract pollinators'],
  ['Sunflower', 'Squash', 'good', 'Sunflowers attract pollinators'],
  ['Borage', 'Tomato', 'good', 'Borage deters tomato hornworm'],
  ['Borage', 'Squash', 'good', 'Borage attracts pollinators'],
  ['Borage', 'Strawberry', 'good', 'Borage improves strawberry flavor'],
  ['Calendula', 'Tomato', 'good', 'Calendula attracts beneficial insects'],
  ['Calendula', 'Pepper', 'good', 'Calendula attracts beneficial insects'],

  // === FRUIT COMPANIONS ===
  ['Strawberry', 'Beans', 'good', 'Beans add nitrogen'],
  ['Strawberry', 'Lettuce', 'good', 'Good ground cover'],
  ['Strawberry', 'Spinach', 'good', 'Good ground cover'],
  ['Strawberry', 'Onion', 'good', 'Onions deter pests'],
  ['Strawberry', 'Garlic', 'good', 'Garlic deters pests'],
  ['Strawberry', 'Borage', 'good', 'Borage improves flavor and yield'],
  ['Strawberry', 'Thyme', 'good', 'Thyme deters worms'],
  ['Strawberry', 'Cabbage', 'bad', 'Compete for nutrients'],
  ['Strawberry', 'Broccoli', 'bad', 'Brassicas stunt strawberries'],
  ['Strawberry', 'Fennel', 'bad', 'Fennel inhibits growth'],

  // === FENNEL (antagonist to most plants) ===
  ['Fennel', 'Dill', 'bad', 'Cross-pollination issues'],
  ['Fennel', 'Coriander', 'bad', 'Cross-pollination issues'],

  // === POTATO COMPANIONS ===
  ['Potato', 'Beans', 'good', 'Beans add nitrogen'],
  ['Potato', 'Corn', 'good', 'Good companions'],
  ['Potato', 'Cabbage', 'good', 'Good companions'],
  ['Potato', 'Marigold', 'good', 'Marigolds repel pests'],
  ['Potato', 'Horseradish', 'good', 'Horseradish repels potato beetles'],
  ['Potato', 'Tomato', 'bad', 'Share blight and pests'],
  ['Potato', 'Cucumber', 'bad', 'Cucumbers worsen blight susceptibility'],
  ['Potato', 'Squash', 'bad', 'Compete for nutrients'],
  ['Potato', 'Sunflower', 'bad', 'Sunflowers inhibit potato growth'],
  ['Potato', 'Raspberry', 'bad', 'Share diseases'],

  // === CORN COMPANIONS ===
  ['Corn', 'Beans', 'good', 'Three Sisters - beans climb corn, fix nitrogen'],
  ['Corn', 'Squash', 'good', 'Three Sisters - squash shades soil'],
  ['Corn', 'Pumpkin', 'good', 'Three Sisters variant'],
  ['Corn', 'Cucumber', 'good', 'Corn provides support'],
  ['Corn', 'Melon', 'good', 'Good companions'],
  ['Corn', 'Sunflower', 'good', 'Attract pollinators'],
  ['Corn', 'Peas', 'good', 'Peas fix nitrogen'],
  ['Corn', 'Potato', 'good', 'Good companions'],
  ['Corn', 'Tomato', 'bad', 'Both attract corn earworm/tomato hornworm'],

  // === BULB FLOWER COMPANIONS ===
  ['Gladiolus', 'Marigold', 'good', 'Marigolds repel thrips that attack gladiolus'],
  ['Gladiolus', 'Zinnia', 'good', 'Good cutting garden companions'],
  ['Gladiolus', 'Dahlia', 'good', 'Similar growing requirements and bloom times'],
  ['Gladiolus', 'Beans', 'bad', 'Beans and gladiolus inhibit each other'],
  ['Gladiolus', 'Peas', 'bad', 'Peas and gladiolus inhibit each other'],
  ['Daffodil', 'Tulip', 'good', 'Classic spring bulb pairing'],
  ['Daffodil', 'Hyacinth', 'good', 'Spring bulb companions'],
  ['Daffodil', 'Apple', 'good', 'Daffodils deter rodents from fruit trees'],
  ['Daffodil', 'Strawberry', 'good', 'Daffodils deter rodents'],
  ['Tulip', 'Hyacinth', 'good', 'Spring bulb companions with similar timing'],
  ['Tulip', 'Pansy', 'good', 'Classic spring pairing'],
  ['Iris', 'Rose', 'good', 'Classic cottage garden pairing'],
  ['Iris', 'Lavender', 'good', 'Both thrive in similar conditions'],
  ['Lily', 'Rose', 'good', 'Classic garden companions'],
  ['Lily', 'Lavender', 'good', 'Lavender deters lily pests'],
  ['Lily', 'Marigold', 'good', 'Marigolds repel lily pests'],
  ['Allium', 'Rose', 'good', 'Alliums repel aphids from roses'],
  ['Allium', 'Tomato', 'good', 'Alliums repel pests'],
  ['Allium', 'Carrot', 'good', 'Alliums repel carrot fly'],
  ['Allium', 'Pepper', 'good', 'Alliums repel aphids'],
  ['Ranunculus', 'Anemone', 'good', 'Same planting and care requirements'],
  ['Ranunculus', 'Sweet Pea', 'good', 'Cool season cut flower companions'],
  ['Anemone', 'Ranunculus', 'good', 'Perfect cool season companions'],
  ['Freesia', 'Ranunculus', 'good', 'Cool season bulb companions'],
  ['Crocosmia', 'Dahlia', 'good', 'Summer color companions'],
  ['Calla Lily', 'Fern', 'good', 'Both enjoy partial shade and moisture'],
  ['Amaryllis', 'Lily', 'good', 'Similar care requirements'],
];

const insertCompanions = db.transaction((companions) => {
  for (const [a, b, rel, notes] of companions) {
    seedCompanion.run(a, b, rel, notes);
  }
});

insertCompanions(companionRelationships);
console.log('Seeded', companionRelationships.length, 'companion planting relationships');

db.close();
console.log('Database setup complete!');
