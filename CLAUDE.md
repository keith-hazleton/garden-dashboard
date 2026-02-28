# Garden Dashboard

## Overview
React/Vite frontend + Express/better-sqlite3 backend garden dashboard for monitoring soil conditions, planning planting, and managing raised beds.

## Tech Stack
- **Frontend:** React 18.2, Recharts 2.10, Vite 5
- **Backend:** Express 4.18, better-sqlite3 11, node-cron
- **Database:** SQLite
- **Notifications:** ntfy push notifications (threshold alerts + daily morning report)

## Directory Structure
- `backend/` — Express server (routes, services, models, scripts)
- `frontend/src/` — React app (components, App.jsx, index.css)

## How to Run (Local Dev)
- **Backend:** `cd backend && npm run dev` (port 3000, auto-restarts on changes)
- **Frontend:** `cd frontend && npm run dev` (port 5173 with Vite proxy to backend)

## Deploying to Pi
The backend serves the frontend's built static files from `frontend/dist`. One pm2 process runs everything on the Pi at `~/projects/garden-dashboard`.
- **One-command deploy:** `cd ~/projects/garden-dashboard && ./deploy.sh`
- `deploy.sh` runs: git pull, backend npm install, frontend build, pm2 restart
- Frontend changes require `npm run build` — the Pi serves static files, not a dev server

## Database
- SQLite at `backend/data/garden.db`
- Initialize with `npm run init-db`
- **Key tables:** sensor_readings, beds, bed_placements, plants, planting_windows, tasks, companion_relationships, alert_settings

## External Integrations
- **Ecowitt gateway:** POSTs sensor data to `/api/sensors/ecowitt`
- **Open-Meteo:** Weather API (no key required)
- **ntfy:** Push notifications for alerts

## Environment
- `GARDEN_LAT`, `GARDEN_LON` in `backend/.env` (overridable via Settings UI / `alert_settings` table)
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
- Extract shared business logic into `backend/services/` when used by both routes and background jobs
- **Always update this CLAUDE.md file** when making changes that affect project structure, conventions, deployment, or key patterns

## Current / Recent Changes
- `backend/services/wateringAdvice.js` — shared watering advice logic (used by both API route and cron notification)
- `backend/services/scheduledNotifications.js` — node-cron jobs: morning watering report at 7 AM, seedling graduation check at 7:05 AM
- `backend/routes/weather.js` `/watering-advice` endpoint delegates to shared `getWateringAdvice()`
- History chart (`MoistureChart.jsx`) shows both moisture and temperature with dual y-axes (both dynamic/auto-scaled)
- Beds support both `sensor_id` (moisture) and `temp_sensor_id` (temperature) columns
- `backend/services/sensorNames.js` resolves sensor IDs to bed-friendly display names (e.g., "Raised Bed 1 Moisture")
- All sensor API responses include `display_name`; frontend uses `display_name || sensor_name`
- Backend PUT `/api/beds/:id` accepts `sensor_id`, `temp_sensor_id`, and `profile`
- `BedManager.jsx` has inline sensor editing: "Edit Sensors" button toggles moisture/temp/profile controls, PUTs to backend on Save
- `backend/routes/settings.js` — GET/PUT `/api/settings` reads/upserts `alert_settings` key-value pairs
- `SettingsModal.jsx` — modal for editing notifications, alert behavior (including seedling graduation weeks), quiet hours, location, and threshold profiles
- Weather routes and watering advice resolve coordinates from DB (`garden_lat`/`garden_lon`) first, then fall back to env vars
- `bed_placements` has `planting_method` column (`seed` or `transplant`, defaults to `transplant`)
- `backend/services/bedProfiles.js` — `computeSuggestedProfile(bedId)` returns suggested profile based on plant frost_tolerant flags and seed age
- GET `/api/beds/:id` returns `suggested_profile` alongside bed data; placements include `frost_tolerant`
- `BedGrid.jsx` — seed/transplant toggle in plant picker; drag-drop shows confirmation bar with method choice; "S" indicator on seed cells
- `BedManager.jsx` — profile colored pill badge in header; blue suggestion banner when suggested !== current profile; manual profile dropdown in edit panel
- Seedling graduation cron auto-updates bed profiles when seeds mature past `seedling_graduation_weeks` (default 4), sends ntfy notification
