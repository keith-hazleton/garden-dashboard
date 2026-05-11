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
- `camera/` — Pi Zero 2W capture script (Python, runs on separate Pi)

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
- **Key tables:** sensor_readings, beds, bed_placements, plants, planting_windows, tasks, companion_relationships, alert_settings, cameras, camera_frames

## External Integrations
- **Ecowitt gateway:** POSTs sensor data to `/api/sensors/ecowitt`
- **Open-Meteo:** Weather API (no key required)
- **ntfy:** Push notifications for alerts
- **Pi Zero 2W camera:** POSTs JPEG frames to `/api/camera/frames` (multer for multipart uploads)

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
- History chart (`MoistureChart.jsx`) has a bed dropdown selector (persisted in localStorage as `historyChartSelectedBedId`) and shows the selected bed's moisture (left axis, %), temperature (right axis, °F, dashed), and EC (hidden axis, µS/cm, dotted — value shown in tooltip on hover)
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
- `backend/routes/camera.js` — camera CRUD + frame upload/serve/timelapse endpoints, mounted at `/api/camera`
- `backend/services/cameraCleanup.js` — daily 2 AM cron deletes frames older than `camera_retention_days` (default 90) from DB + disk
- Frame storage: `backend/data/frames/{camera_id}/{YYYY-MM-DD}/{HH-MM-SS}.jpg`
- `CameraView.jsx` — latest frame display, online/offline status, time-lapse player with play/pause/scrub/fps controls
- `SettingsModal.jsx` — camera section: retention days, per-camera bed linking and enable/disable
- `camera/capture.py` — Pi Zero capture script using picamera2 + astral (daylight-only), with spool-on-failure retry
- WH52 multi-channel soil sensor support: `backend/routes/sensors.js` parses `soil_ec_hum{N}` (moisture), `soil_ec_temp{N}` (temp °F), `soil_ec{N}` (μS/cm), `soil_ec_batt{N}` (battery voltage). WH52 channels are normalized to the same `soil_moisture_{N}` / `soil_temp_{N}` / `soil_ec_{N}` IDs as WH51/WN34 (channels are unique across families). Webhook loops cover channels 1–16.
- `sensor_readings.ec_us_cm` and `beds.ec_sensor_id` columns added (idempotent migrations in `backend/models/db.js`).
- `BedManager.jsx` includes EC sensor dropdown (filters `soil_ec_` IDs) and renders an EC chip in the bed header. EC thresholds: <500=depleted, 500–2000=ideal, 2000–4000=high, ≥4000=critical.
- `SensorCards.jsx` has an `EcSensorCard` and dedicated "Soil EC" section. `isBatteryLow()` helper handles both legacy string status (`'0'`/`'low'`) and WH52 voltage strings (treats <1.4 V as low).
