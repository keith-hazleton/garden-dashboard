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
