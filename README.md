# Fleet Console

React + Vite + TypeScript + Tailwind frontend for the Fleet Tracking API (contract: `api-v0.1.0`).
Screens: Login, Map (live, filters, KPI strip, vehicle drawer), Playback, Alerts, Trips, Geofences (draw/edit), Drivers, Import, Reports, System, Audit.

## Run

Needs Node.js 18 or newer.

```bash
npm install
```

**A. Offline, with the built-in mock API** (no VPS needed)

Terminal 1: `npm run mock`
Terminal 2 (Mac/Linux): `VITE_API_TARGET=http://localhost:8787 npm run dev`
Terminal 2 (Windows cmd): `set VITE_API_TARGET=http://localhost:8787` then `npm run dev`
Terminal 2 (PowerShell): `$env:VITE_API_TARGET="http://localhost:8787"; npm run dev`

**B. Against the staging server on the VPS** (the VPS must be switched on)

`npm run dev` (proxies `/api`, including the WebSocket, to the staging host)
Or point at another backend: `VITE_API_TARGET=http://localhost:8081 npm run dev`

Open the address Vite prints (usually http://localhost:5173). Demo logins, all with password `DemoPass123!`:
`dispatcher@demo.ftb`, `security@demo.ftb`, `viewer@demo.ftb`, `admin@demo.ftb`.

`npm run build` type-checks and builds `dist/`. Serve `dist/` from the same origin as the API in production (cookie auth, no CORS).
Set `VITE_API_BASE` only if you deliberately serve the API from another origin.

## Offline mock

`npm run mock` starts a stand-in API on :8787 (same demo logins and password) with a live WebSocket, 20 trucks, 3 geofences, trips, alerts, and route history that includes a stop and a data gap.

## Notes

- Map is Leaflet with CARTO/OSM tiles (no API key). The UI brief says Google Maps first; swap `components/MapView.tsx` and `RouteMap.tsx` when a key is available.
- `src/lib/api-client.ts` is the handoff client plus an `audit()` method. A 401 anywhere returns to login.
- Live: positions are batched (500 ms); on reconnect the snapshot and open alerts are refetched (no sequence numbers).
- Roles gate the UI (mutations: admin/dispatcher, ack: +security, audit: admin/security); the API still enforces them.
- System and Audit responses are untyped in the contract, so those screens render defensively. Verify against staging.
- Import history is this-session only (no list endpoint).

## Deploy (Vercel or Netlify)

Push the project to GitHub and import it. `vercel.json` and `netlify.toml` already set the build, proxy `/api` to the staging backend and add the single-page-app fallback. If you point at a different backend, change the host in the one you use.

These hosts can't proxy WebSockets, so the live socket won't connect there. The app detects this and refreshes vehicles and alerts every 5 seconds instead. For smooth live movement, serve `dist/` from the same host as the API (Nginx/Caddy) and add your domain to the backend's `WS_ALLOWED_ORIGINS`.

## Behaviour worth knowing

- Alerts show a plain-language sentence and a suggested next step; raw evidence is under "Technical details". The list is sorted by severity, then time. Toasts appear only for high and critical alerts.
- A truck shows as "alert" only when it has an open high or critical alert.
- The map groups nearby trucks into numbered clusters (automatic above 200 trucks; checkbox to force it) and can hide zones.
- Playback's timeline is green (moving), yellow (stopped), grey (no data), with Prev/Next move buttons that skip stops.
- Top-bar numbers link to the matching list. Security users land on Alerts after sign in; everyone else lands on the map.
- The API does not say who acknowledged an alert, so the UI shows when but not who (the Audit screen has the actor).
