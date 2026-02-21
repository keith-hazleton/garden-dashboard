# Garden Dashboard

## Overview
React/Vite frontend + Express/better-sqlite3 backend garden dashboard for monitoring soil conditions, planning planting, and managing raised beds.

## Tech Stack
- **Frontend:** React 18.2, Recharts 2.10, Vite 5
- **Backend:** Express 4.18, better-sqlite3 11
- **Database:** SQLite
- **Notifications:** ntfy push notifications

## Directory Structure
- `backend/` — Express server (routes, services, models, scripts)
- `frontend/src/` — React app (components, App.jsx, index.css)

## How to Run (Local Dev)
- **Backend:** `cd backend && npm run dev` (port 3000, auto-restarts on changes)
- **Frontend:** `cd frontend && npm run dev` (port 5173 with Vite proxy to backend)

## Deploying to Pi
The backend serves the frontend's built static files from `frontend/dist`. One pm2 process runs everything.
```bash
cd ~/garden-dashboard
git pull
cd frontend && npm run build
pm2 restart garden-dashboard
```

## Database
- SQLite at `backend/data/garden.db`
- Initialize with `npm run init-db`
- **Key tables:** sensor_readings, beds, bed_placements, plants, planting_windows, tasks, companion_relationships, alert_settings

## External Integrations
- **Ecowitt gateway:** POSTs sensor data to `/api/sensors/ecowitt`
- **Open-Meteo:** Weather API (no key required)
- **ntfy:** Push notifications for alerts

## Environment
- `GARDEN_LAT`, `GARDEN_LON` in `backend/.env`
- Zone 10a plant data

## Conventions
- camelCase.jsx component files
- snake_case DB columns
- Local `useState` (no Redux)
- CSS custom properties for theming, dark mode default
- `useCallback` for memoized fetches
- `refreshKey` pattern for cross-component re-renders
- try-catch with console.error for error handling
- Vite proxy: `/api` -> localhost:3000
- **Always update this CLAUDE.md file** when making changes that affect project structure, conventions, deployment, or key patterns

## Current / Recent Changes
- Beds support both `sensor_id` (moisture) and `temp_sensor_id` (temperature) columns
- `backend/services/sensorNames.js` resolves sensor IDs to bed-friendly display names (e.g., "Raised Bed 1 Moisture")
- All sensor API responses include `display_name`; frontend uses `display_name || sensor_name`
- Backend PUT `/api/beds/:id` accepts `sensor_id` and `temp_sensor_id`
- `BedManager.jsx` has inline sensor editing: "Edit Sensors" button toggles moisture/temp dropdowns, PUTs to backend on Save
