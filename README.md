# Fleet Console

React + Vite + TypeScript + Tailwind frontend for the Fleet Tracking API (contract: `api-v0.1.0`).
Screens: Login, Map (live, filters, KPI strip, vehicle drawer), Playback, Alerts, Trips, Geofences (draw/edit), Drivers, Import, Reports, System, Audit.

## Run

```bash
npm install
npm run dev                      # proxies /api (incl. WebSocket) to the staging host
VITE_API_TARGET=http://localhost:8081 npm run dev   # or your local backend
npm run build                    # typecheck + production build in dist/
```

Serve `dist/` from the same origin as the API in production (cookie auth, no CORS).
Set `VITE_API_BASE` only if you deliberately serve the API from another origin.

## Offline mock

`npm run mock` starts a stand-in API on :8787 (same demo logins and password) with a live WebSocket:
`npm run mock` then `VITE_API_TARGET=http://localhost:8787 npm run dev`.

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
