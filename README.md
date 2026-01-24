# Garden Dashboard

A local garden monitoring dashboard for Raspberry Pi with Ecowitt soil moisture sensors and Open-Meteo weather integration.

## Features

- **Soil Moisture Monitoring**: Real-time readings from Ecowitt WH51 sensors via GW3000 gateway
- **Historical Charts**: 24-hour moisture trends with interactive charts
- **Weather Integration**: Current conditions and 7-day forecast from Open-Meteo (no API key required)
- **Smart Watering Advice**: Recommendations combining soil moisture data + weather forecast
- **Planting Schedule**: Zone 10b-specific planting windows with 180 plants, collapsible categories
- **Planting Calendar**: Star plants to track them, view planting windows in agenda or timeline view
- **Bed Mapping**: Visual grid layout for raised beds with drag-and-drop plant placement
- **Companion Planting**: 223 plant relationships - see good/bad companions when planning beds
- **Task Manager**: Garden maintenance tasks with recurring reminders
- **Light/Dark Theme**: Toggle between light and dark mode (preference saved)

## Tech Stack

- **Backend**: Node.js + Express + better-sqlite3
- **Frontend**: React + Vite + Recharts
- **Hardware**: Ecowitt GW3000 gateway + WH51 soil moisture sensors
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

This creates the SQLite database and seeds it with common zone 10b plants and planting windows.

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

### Step 7: Set a Static IP (Recommended)

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
| `/api/sensors/ecowitt` | POST | Webhook for Ecowitt gateway |
| `/api/sensors` | GET | List all sensors |
| `/api/sensors/latest` | GET | Latest readings for all sensors |
| `/api/sensors/history/:sensorId` | GET | Historical readings (?hours=24) |

### Plants
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plants` | GET | List plants (?category=vegetable&search=tomato) |
| `/api/plants/plant-now` | GET | Plants to plant now (zone 10b) |
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

## License

MIT
