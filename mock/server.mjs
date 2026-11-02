// Tiny stand-in for the Fleet API so the UI can be developed/tested offline.
// Run: npm run mock   (port 8787) then VITE_API_TARGET=http://localhost:8787 npm run dev
import http from "node:http";
import crypto from "node:crypto";

const PORT = process.env.PORT || 8787;
const id = () => crypto.randomUUID();
const sessions = new Set();
const users = { "dispatcher@demo.ftb": "dispatcher", "admin@demo.ftb": "admin", "security@demo.ftb": "security", "viewer@demo.ftb": "viewer" };

const depots = ["Apapa", "Ikeja", "Lekki"];
const centre = [6.5244, 3.3792];
const vehicles = Array.from({ length: 20 }, (_, i) => ({
  id: `veh-${i}`, external_id: `demo-imei-${String(i).padStart(4, "0")}`, plate: `LAG-${100 + i}XY`, vehicle_type: "Tanker", make: "MAN", model: "TGS", year: 2019 + (i % 5), colour: "White",
  status: "active", depot: depots[i % 3], department: "Distribution", driver_id: `drv-${i % 6}`, driver_name: `Driver ${i % 6}`, driver_phone: "+23480000000" + (i % 10),
  lat: centre[0] + (Math.random() - 0.5) * 0.15, lon: centre[1] + (Math.random() - 0.5) * 0.15,
  speed_kph: i % 5 === 0 ? 0 : 30 + Math.random() * 40, heading_deg: Math.random() * 360, recorded_at: new Date().toISOString(), online: i !== 7, last_seen_at: new Date().toISOString(),
  trip_id: i % 4 === 0 ? `trip-${i}` : undefined, trip_status: i % 4 === 0 ? "active" : undefined, destination: i % 4 === 0 ? "Ikeja Depot" : undefined,
}));
const drivers = Array.from({ length: 6 }, (_, i) => ({ id: `drv-${i}`, name: `Driver ${i}`, phone: `+2348000000${i}`, licence: `LIC-${1000 + i}`, status: "active", vehicles: 3 }));
const sq = (lat, lon, d) => [[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]];
let geofences = [
  { id: "g1", name: "Apapa Depot", kind: "depot", geometry: { type: "Polygon", coordinates: [sq(6.45, 3.36, 0.01)] } },
  { id: "g2", name: "Refinery", kind: "restricted", geometry: { type: "Polygon", coordinates: [sq(6.58, 3.45, 0.015)] } },
  { id: "g3", name: "Customer A", kind: "customer", geometry: { type: "Polygon", coordinates: [sq(6.52, 3.3, 0.008)] } },
];
let trips = Array.from({ length: 8 }, (_, i) => ({ id: `trip-${i}`, vehicle_id: `veh-${i}`, plate: vehicles[i].plate, driver_id: i % 3 ? `drv-${i % 6}` : undefined, driver_name: i % 3 ? `Driver ${i % 6}` : undefined, origin: "Apapa Depot", destination: "Ikeja Depot", status: ["planned", "assigned", "active", "completed", "cancelled"][i % 5], distance_km: i % 5 === 3 ? 41.2 : 0, started_at: i % 5 >= 2 ? new Date(Date.now() - 3600e3).toISOString() : undefined }));
let alerts = [
  { id: "a1", vehicle_id: "veh-3", plate: vehicles[3].plate, type: "geofence_exit", severity: "high", status: "open", occurred_at: new Date(Date.now() - 600e3).toISOString(), evidence: { geofence_name: "Refinery", lat: 6.58, lon: 3.45 } },
  { id: "a2", vehicle_id: "veh-5", plate: vehicles[5].plate, type: "route_deviation", severity: "critical", status: "open", trip_id: "trip-4", occurred_at: new Date(Date.now() - 1800e3).toISOString(), evidence: { deviation_m: 1450 } },
  { id: "a3", vehicle_id: "veh-9", plate: vehicles[9].plate, type: "idle", severity: "low", status: "acked", occurred_at: new Date(Date.now() - 7200e3).toISOString(), acked_at: new Date().toISOString(), evidence: {} },
];

const send = (res, code, body, headers = {}) => { res.writeHead(code, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const err = (res, code, c, m) => send(res, code, { error: { code: c, message: m } });
const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c).toString())); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/^\/api\/v1/, "");
  const cookie = /ftb_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  const sess = cookie && sessions.has(cookie) ? cookie : null;
  const role = sess ? sess.split(":")[0] : null;
  const user = () => ({ id: "u1", tenant_id: "t1", email: `${role}@demo.ftb`, name: role[0].toUpperCase() + role.slice(1), role });

  if (p === "/auth/login" && req.method === "POST") {
    const b = JSON.parse((await readBody(req)) || "{}");
    if (users[b.email] && b.password === "DemoPass123!") {
      const s = `${users[b.email]}:${id()}`; sessions.add(s);
      return send(res, 200, { user: { ...{ id: "u1", tenant_id: "t1", email: b.email, name: users[b.email], role: users[b.email] } }, csrf_token: "csrf-" + s.slice(-6) }, { "Set-Cookie": `ftb_session=${s}; HttpOnly; Path=/` });
    }
    return err(res, 401, "invalid_credentials", "invalid email or password");
  }
  if (!sess) return err(res, 401, "unauthorized", "not signed in");
  if (p === "/me") return send(res, 200, { user: user(), csrf_token: "csrf-" + sess.slice(-6) });
  if (p === "/auth/logout") { sessions.delete(sess); return send(res, 204); }
  if (req.method !== "GET" && req.headers["x-csrf-token"] !== "csrf-" + sess.slice(-6)) return err(res, 403, "csrf", "bad csrf token");
  const canMutate = ["admin", "dispatcher"].includes(role);

  if (p === "/live/snapshot" || p === "/vehicles") return send(res, 200, { data: vehicles });
  let m;
  if ((m = /^\/vehicles\/([^/]+)$/.exec(p))) {
    const v = vehicles.find((x) => x.id === m[1]); if (!v) return err(res, 404, "not_found", "vehicle not found");
    if (req.method === "PATCH") { if (!canMutate) return err(res, 403, "forbidden", "forbidden"); Object.assign(v, JSON.parse(await readBody(req))); return send(res, 204); }
    return send(res, 200, { data: v });
  }
  if ((m = /^\/vehicles\/([^/]+)\/events$/.exec(p))) return send(res, 200, { data: [{ kind: "alert", type: "geofence_exit", severity: "high", status: "open", at: new Date(Date.now() - 600e3).toISOString() }, { kind: "geofence", type: "enter", name: "Apapa Depot", at: new Date(Date.now() - 4000e3).toISOString() }] });
  if ((m = /^\/vehicles\/([^/]+)\/history$/.exec(p))) {
    const v = vehicles.find((x) => x.id === m[1]); const n = 120;
    // Includes a stop (points 40-60) and a data gap (points 85-95) so the timeline has all three states.
    const data = Array.from({ length: n }, (_, i) => ({ t: new Date(Date.now() - (n - i) * 30e3).toISOString(), lat: v.lat + Math.sin(i / 15) * 0.02 + i * 0.0001, lon: v.lon + i * 0.0003, speed_kph: i >= 40 && i < 60 ? 0 : 40 + 20 * Math.sin(i / 8), heading_deg: 90 })).filter((_, i) => i < 85 || i >= 95);
    return send(res, 200, { resolution: "30s", data });
  }
  if (p === "/geofences") {
    if (req.method === "POST") { if (!canMutate) return err(res, 403, "forbidden", "forbidden"); const b = JSON.parse(await readBody(req)); const g = { id: id(), kind: "other", ...b }; geofences.push(g); return send(res, 201, { id: g.id }); }
    return send(res, 200, { data: geofences });
  }
  if ((m = /^\/geofences\/([^/]+)$/.exec(p))) {
    if (req.method === "DELETE") { if (m[1] === "g2") return err(res, 409, "geofence_in_use", "geofence has recorded events and cannot be deleted"); geofences = geofences.filter((g) => g.id !== m[1]); return send(res, 204); }
    if (req.method === "PATCH") { Object.assign(geofences.find((g) => g.id === m[1]), JSON.parse(await readBody(req))); return send(res, 204); }
  }
  if (p === "/trips") {
    if (req.method === "POST") { const b = JSON.parse(await readBody(req)); const v = vehicles.find((x) => x.id === b.vehicle_id); const t = { id: id(), plate: v?.plate, status: b.driver_id ? "assigned" : "planned", distance_km: 0, ...b }; trips.unshift(t); return send(res, 201, { id: t.id }); }
    const s = url.searchParams.get("status"); return send(res, 200, { data: trips.filter((t) => !s || t.status === s) });
  }
  if ((m = /^\/trips\/([^/]+)$/.exec(p)) && req.method === "PATCH") { const t = trips.find((x) => x.id === m[1]); Object.assign(t, JSON.parse(await readBody(req))); if (t.status === "completed") t.distance_km = 38.4; return send(res, 204); }
  if (p === "/alerts") { const s = url.searchParams.get("status"), ty = url.searchParams.get("type"); return send(res, 200, { data: alerts.filter((a) => (!s || a.status === s) && (!ty || a.type === ty)) }); }
  if ((m = /^\/alerts\/([^/]+)\/ack$/.exec(p))) { if (role === "viewer") return err(res, 403, "forbidden", "viewers cannot acknowledge"); const a = alerts.find((x) => x.id === m[1]); a.status = "acked"; a.acked_at = new Date().toISOString(); return send(res, 204); }
  if (p === "/drivers") { if (req.method === "POST") { const b = JSON.parse(await readBody(req)); const d = { id: id(), status: "active", vehicles: 0, phone: "", licence: "", ...b }; drivers.push(d); return send(res, 201, { id: d.id }); } return send(res, 200, { data: drivers }); }
  if ((m = /^\/drivers\/([^/]+)$/.exec(p)) && req.method === "PATCH") { Object.assign(drivers.find((x) => x.id === m[1]), JSON.parse(await readBody(req))); return send(res, 204); }
  if (p === "/reports/summary") return send(res, 200, { from: "", to: "", vehicles: 20, trips: 143, completed_trips: 120, active_trips: 5, alerts: 37, open_alerts: alerts.filter((a) => a.status === "open").length, distance_km: 18432.6, alerts_by_type: [{ key: "geofence_exit", count: 14 }, { key: "idle", count: 11 }, { key: "route_deviation", count: 7 }, { key: "speeding", count: 5 }] });
  if (p === "/system/health") return send(res, 200, { status: "ok", dependencies: { postgres: "ok", redis: "ok" }, vehicles: 20, online: 19, active_trips: 5, open_alerts: 2, ingest: { received: 182340, dropped: 0, stale: 12, validation_errors: 3, queue_depth: 0, cold_path_failures: 0 } });
  if (p === "/audit") return send(res, 200, { data: [{ created_at: new Date().toISOString(), actor: "dispatcher@demo.ftb", action: "trip.create", entity: "trip", entity_id: "trip-1" }, { created_at: new Date(Date.now() - 3600e3).toISOString(), actor: "security@demo.ftb", action: "alert.ack", entity: "alert", entity_id: "a3" }] });
  if (p === "/import/vehicles") { await readBody(req); return send(res, 200, { job_id: id(), total: 5000, imported: 4997, failed: 3, errors: [{ row: 12, message: "invalid imei" }, { row: 88, message: "duplicate plate" }, { row: 301, message: "year out of range" }] }); }
  err(res, 404, "not_found", `no route ${p}`);
});

// Minimal WebSocket (RFC 6455) so the live feed works without a dependency.
server.on("upgrade", (req, socket) => {
  if (!/ftb_session=([^;]+)/.test(req.headers.cookie || "")) { socket.destroy(); return; }
  const key = req.headers["sec-websocket-key"];
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64")}\r\n\r\n`);
  const frame = (s) => { const b = Buffer.from(s); const h = b.length < 126 ? Buffer.from([0x81, b.length]) : Buffer.from([0x81, 126, b.length >> 8, b.length & 255]); return Buffer.concat([h, b]); };
  const t = setInterval(() => {
    const v = vehicles[Math.floor(Math.random() * vehicles.length)];
    v.lat += (Math.random() - 0.5) * 0.002; v.lon += (Math.random() - 0.5) * 0.002;
    socket.write(frame(JSON.stringify({ type: "position", tenant_id: "t1", vehicle_id: v.external_id, lat: v.lat, lon: v.lon, recorded_at: new Date().toISOString() })));
  }, 300);
  socket.on("close", () => clearInterval(t)); socket.on("error", () => clearInterval(t));
});

server.listen(PORT, () => console.log(`mock API on :${PORT}`));
