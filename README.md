# Garden Dashboard

A local garden monitoring dashboard for Raspberry Pi with Ecowitt soil sensors and Open-Meteo weather integration.

## Features

- **Soil Moisture Monitoring**: Real-time readings from Ecowitt WH51 sensors via GW3000 gateway
- **Soil Temperature Monitoring**: Support for WN34 and similar soil/water temperature sensors
- **Historical Charts**: 24-hour sensor trends with interactive charts
- **Weather Integration**: Current conditions and 7-day forecast from Open-Meteo (no API key required)
- **Smart Watering Advice**: Recommendations combining soil moisture data + weather forecast
- **Planting Schedule**: Zone 10a-specific planting windows with 198 plants (including 18 bulb varieties), collapsible categories
- **Planting Calendar**: Star plants to track them, view planting windows in agenda or timeline view
- **Bed Mapping**: Visual grid layout for raised beds with drag-and-drop plant placement
- **Companion Planting**: 250 plant relationships - see good/bad companions when planning beds
- **Task Manager**: Garden maintenance tasks with recurring reminders
- **Push Notifications**: Alerts via ntfy when soil moisture or temperature hits critical levels
- **Light/Dark Theme**: Toggle between light and dark mode (preference saved)

## Tech Stack

- **Backend**: Node.js + Express + better-sqlite3
- **Frontend**: React + Vite + Recharts
- **Hardware**: Ecowitt GW3000 gateway + WH51 soil moisture sensors + WN34 soil temperature sensors
- **Deployment**: Raspberry Pi 5 on local network

## Quick Start (Development)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Initialize Database

```bash
cd backend
npm run init-db
```

This creates the SQLite database and seeds it with common zone 10a plants and planting windows.

### 3. Configure Location

Set your coordinates for accurate weather data via environment variables:

```bash
export GARDEN_LAT=32.7    # Your latitude
export GARDEN_LON=-117.1  # Your longitude
```

### 4. Run Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Access the dashboard at `http://localhost:5173`

---

## Raspberry Pi 5 Deployment

Complete guide for deploying to a Raspberry Pi 5.

### Step 1: Prepare the Raspberry Pi

Flash Raspberry Pi OS (64-bit) to your SD card using Raspberry Pi Imager. After first boot:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs git

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Step 2: Transfer Project to Pi

**Option A: From your development machine**

```bash
# On your Mac/PC - create archive without node_modules
cd /path/to/garden-dashboard
tar --exclude='node_modules' --exclude='data/*.db' -czf garden-dashboard.tar.gz .

# Copy to Pi (replace with your Pi's IP address)
scp garden-dashboard.tar.gz pi@192.168.1.100:~/
```

**Option B: Clone from Git (if you've pushed to a repo)**

```bash
# On the Pi
cd ~
git clone https://github.com/yourusername/garden-dashboard.git
```

### Step 3: Install on the Pi

```bash
# Extract if using Option A
cd ~
mkdir garden-dashboard
cd garden-dashboard
tar -xzf ~/garden-dashboard.tar.gz

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Build frontend for production
cd ../frontend && npm run build

# Initialize database
cd ../backend && npm run init-db
```

### Step 4: Test the Server

```bash
cd ~/garden-dashboard/backend
GARDEN_LAT=32.7 GARDEN_LON=-117.1 node server.js
```

Visit `http://[pi-ip]:3000` in your browser. Press Ctrl+C to stop.

### Step 5: Configure Auto-Start with systemd

Create the service file:

```bash
sudo nano /etc/systemd/system/garden-dashboard.service
```

Paste this configuration (adjust paths and coordinates as needed):

```ini
[Unit]
Description=Garden Dashboard
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/garden-dashboard/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=GARDEN_LAT=32.7
Environment=GARDEN_LON=-117.1

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable garden-dashboard
sudo systemctl start garden-dashboard

# Check status
sudo systemctl status garden-dashboard

# View logs if needed
journalctl -u garden-dashboard -f
```

### Step 6: Configure Ecowitt GW3000

In the Ecowitt app or gateway web interface:

1. Go to **Settings** → **Customized Upload**
2. Add a new server with these settings:
   - **Protocol**: HTTP
   - **Server**: Your Pi's IP address (e.g., `192.168.1.100`)
   - **Port**: `3000`
   - **Path**: `/api/sensors/ecowitt`
   - **Upload Interval**: 60 seconds (or your preference)

The dashboard will start displaying sensor data as soon as the gateway begins posting.

#### Supported Sensors

The dashboard automatically detects and displays data from these Ecowitt sensor types:

| Sensor Type | Model Examples | Data Keys |
|-------------|----------------|-----------|
| Soil Moisture | WH51 | `soilmoisture1`-`soilmoisture8`, `soilbatt1`-`soilbatt8` |
| Soil/Water Temperature | WN34, WN30 | `tf_ch1`-`tf_ch8`, `tf_batt1`-`tf_batt8` |

Temperature sensors display with color-coded status:
- **Cold** (<40°F): Too cold for most plants
- **Cool** (40-50°F): Good for cool season crops
- **Ideal** (50-75°F): Ideal growing temperature
- **Warm** (75-85°F): Good for warm season crops
- **Hot** (>85°F): May stress plants

### Step 7: Set Up Push Notifications (Optional)

The dashboard can send push notifications to your phone when soil conditions reach critical levels. This uses [ntfy](https://ntfy.sh), a free push notification service.

#### 1. Install the ntfy App

- **iOS**: [ntfy on App Store](https://apps.apple.com/us/app/ntfy/id1625396347)
- **Android**: [ntfy on Google Play](https://play.google.com/store/apps/details?id=io.heckel.ntfy) or [F-Droid](https://f-droid.org/en/packages/io.heckel.ntfy/)

#### 2. Subscribe to Your Topic

Open the ntfy app and subscribe to your topic. The default topic configured during database initialization is stored in the `alert_settings` table. You can check it with:

```bash
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "SELECT value FROM alert_settings WHERE key = 'ntfy_topic';"
```

In the ntfy app, tap **+** and enter your topic name to subscribe.

#### 3. Configure Alert Settings

Alert settings are stored in the database and can be modified:

```bash
# View all alert settings
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "SELECT key, value FROM alert_settings;"

# Change the ntfy topic
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "UPDATE alert_settings SET value = 'your-topic-name' WHERE key = 'ntfy_topic';"

# Disable alerts
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "UPDATE alert_settings SET value = 'false' WHERE key = 'ntfy_enabled';"

# Change cooldown period (minutes between repeat alerts)
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "UPDATE alert_settings SET value = '120' WHERE key = 'alert_cooldown_minutes';"

# Change quiet hours (no notifications during sleep)
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "UPDATE alert_settings SET value = '22' WHERE key = 'quiet_hours_start';"  # 10 PM
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "UPDATE alert_settings SET value = '7' WHERE key = 'quiet_hours_end';"     # 7 AM
```

#### 4. Alert Thresholds

Alerts use threshold profiles that can be assigned to beds. Available profiles:

| Profile | Moisture Low | Moisture Critical | Temp Low | Temp Critical |
|---------|--------------|-------------------|----------|---------------|
| warm_season | 20% | 15% | 50F | 45F |
| cool_season | 15% | 10% | 35F | 32F |
| seedling | 30% | 20% | 55F | 50F |

To view or modify a profile:

```bash
# View warm_season profile
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "SELECT value FROM alert_settings WHERE key = 'profile_warm_season';"

# Update a profile (JSON format)
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "UPDATE alert_settings SET value = '{\"moisture_low\":25,\"moisture_critical\":18,\"moisture_high\":80,\"temp_low\":55,\"temp_critical_low\":50,\"temp_high\":90,\"temp_critical_high\":95}' WHERE key = 'profile_warm_season';"
```

#### Self-Hosting ntfy (Alternative)

If you prefer to self-host, you can run ntfy on your Raspberry Pi:

```bash
# Install ntfy
curl -sSL https://archive.heckel.io/apt/pubkey.txt | sudo apt-key add -
sudo apt install apt-transport-https
echo "deb https://archive.heckel.io/apt debian main" | sudo tee /etc/apt/sources.list.d/ntfy.list
sudo apt update && sudo apt install ntfy

# Start ntfy server
sudo systemctl enable ntfy
sudo systemctl start ntfy

# Update garden dashboard to use local server
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "UPDATE alert_settings SET value = 'http://localhost:80' WHERE key = 'ntfy_server';"
```

Then configure the ntfy app to use your Pi's IP address as the server.

### Step 8: Set a Static IP (Recommended)

To ensure your Pi always has the same IP address:

```bash
sudo nano /etc/dhcpcd.conf
```

Add at the bottom (adjust for your network):

```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

Reboot: `sudo reboot`

---

## Maintenance

### View Logs

```bash
journalctl -u garden-dashboard -f
```

### Restart Service

```bash
sudo systemctl restart garden-dashboard
```

### Update the Application

```bash
cd ~/garden-dashboard
git pull  # if using git

# Or transfer new files manually, then:
cd frontend && npm run build
sudo systemctl restart garden-dashboard
```

### Database Cleanup

For long-running installations, periodically remove old sensor readings:

```bash
sqlite3 ~/garden-dashboard/backend/data/garden.db \
  "DELETE FROM sensor_readings WHERE timestamp < datetime('now', '-30 days');"
```

### Backup Database

```bash
cp ~/garden-dashboard/backend/data/garden.db ~/garden-backup-$(date +%Y%m%d).db
```

---

## API Reference

### Sensors
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sensors/ecowitt` | POST | Webhook for Ecowitt gateway (moisture + temperature) |
| `/api/sensors` | GET | List all sensors |
| `/api/sensors/latest` | GET | Latest readings for all sensors (includes sensor_type, moisture_percent, temperature_f) |
| `/api/sensors/history/:sensorId` | GET | Historical readings (?hours=24) |

### Plants
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plants` | GET | List plants (?category=vegetable&search=tomato) |
| `/api/plants/plant-now` | GET | Plants to plant now (zone 10a) |
| `/api/plants/watched/list` | GET | Get all starred/watched plants |
| `/api/plants/calendar/year` | GET | Calendar data for watched plants |
| `/api/plants/:id` | GET | Single plant with planting windows |
| `/api/plants/:id/watch` | POST | Toggle star/watch status |
| `/api/plants/:id/companions` | GET | Get companion planting info |
| `/api/plants` | POST | Create plant |
| `/api/plants/:id` | PUT | Update plant |
| `/api/plants/:id` | DELETE | Delete plant |
| `/api/plants/plantings/active` | GET | Active plantings |
| `/api/plants/plantings` | POST | Create planting |

### Beds
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/beds` | GET | List all beds |
| `/api/beds/:id` | GET | Get bed with placements and analysis |
| `/api/beds` | POST | Create bed |
| `/api/beds/:id` | DELETE | Delete bed |
| `/api/beds/:id/placements` | POST | Add plant to bed |
| `/api/beds/:id/placements/:placementId` | PATCH | Move plant in bed |
| `/api/beds/:id/placements/:placementId` | DELETE | Remove plant from bed |
| `/api/beds/:id/companion-check` | GET | Check companions before placing |

### Tasks
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tasks` | GET | List tasks (?status=pending&type=water) |
| `/api/tasks/due` | GET | Tasks due today or overdue |
| `/api/tasks` | POST | Create task |
| `/api/tasks/:id` | PUT | Update task |
| `/api/tasks/:id/complete` | POST | Complete (auto-creates next if recurring) |
| `/api/tasks/:id/uncomplete` | POST | Revert completion |
| `/api/tasks/:id` | DELETE | Delete task |
| `/api/tasks/bulk/reminders` | POST | Quick-add common reminders |

### Weather
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/weather/current` | GET | Current conditions |
| `/api/weather/forecast` | GET | 7-day forecast |
| `/api/weather/watering-advice` | GET | Smart watering recommendations |

---

## Project Structure

```
garden-dashboard/
├── backend/
│   ├── data/                  # SQLite database (auto-created)
│   ├── models/
│   │   └── db.js              # Database connection
│   ├── routes/
│   │   ├── sensors.js         # Ecowitt webhook + sensor API
│   │   ├── plants.js          # Plants + plantings + calendar CRUD
│   │   ├── beds.js            # Bed mapping + companion planting
│   │   ├── tasks.js           # Task management
│   │   └── weather.js         # Open-Meteo integration
│   ├── services/
│   │   └── alerts.js          # Push notification alerts via ntfy
│   ├── scripts/
│   │   └── init-db.js         # Database initialization + seed data
│   ├── server.js              # Express application
│   └── package.json
├── frontend/
│   ├── dist/                  # Production build (after npm run build)
│   ├── src/
│   │   ├── components/
│   │   │   ├── SensorCards.jsx
│   │   │   ├── WeatherWidget.jsx
│   │   │   ├── WateringAdvice.jsx
│   │   │   ├── PlantingSchedule.jsx
│   │   │   ├── PlantingCalendar.jsx
│   │   │   ├── BedManager.jsx
│   │   │   ├── BedGrid.jsx
│   │   │   ├── TaskManager.jsx
│   │   │   └── MoistureChart.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Data Sources

Plant data, planting windows, and companion relationships in this project are sourced from and cross-checked against:

### UC Master Gardener Program (Primary Sources)
- [UC Master Gardeners of Los Angeles County](https://ucanr.edu/county/los-angeles-county/gardening-uc-master-gardener-program) - Regional planting guidance
- [UC Master Gardener Time of Planting Guide](https://ucanr.edu/program/uc-master-gardener-program/time-planting) - South Coast vegetable planting calendar
- [UC Master Gardeners of Sacramento County - Bulb Planting Schedule](https://ucanr.edu/sites/sacmg/Sacramento_Bulb_Planting_Schedule/) - Bulb flower data
- [UC Master Gardeners of Santa Clara County - Cut Flower Chart](https://ucanr.edu/site/uc-master-gardeners-santa-clara-county/cut-flower-planting-chart) - Annual/perennial flower data
- [Spring & Summer Gardening Basics for LA County](https://ucanr.edu/sites/default/files/2011-11/131790.pdf) (PDF)
- [Fall & Winter Gardening Basics for LA County](https://celosangeles.ucanr.edu/files/131791.pdf) (PDF)

### Additional UC Resources
- [UC Agriculture and Natural Resources (UC ANR)](https://ucanr.edu/)
- [UC Davis Fruit & Nut Research Center](https://ucanr.edu/site/fruit-nut-research-information-center/)
- [California Master Gardener Handbook](https://anrcatalog.ucanr.edu/Items/3382) (reference)

### USDA Resources
- [USDA Plant Hardiness Zone Map](https://planthardiness.ars.usda.gov/)

### Zone Information
This database is configured for **USDA Zone 10a** (La Cañada Flintridge, CA area - 1500 ft elevation).
- Average minimum temperature: 30-35°F
- Planting windows may need adjustment for different zones

## License

MIT
