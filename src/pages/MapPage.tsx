import { useMemo, useState } from "react";
import MapView from "../components/MapView";
import VehicleDrawer from "../components/VehicleDrawer";
import { Empty, ErrorState, Loading, Stat, StatusDot } from "../components/ui";
import { useLive } from "../lib/live";
import { useAsync, useNow } from "../lib/hooks";
import { api } from "../lib/api";
import { ago, vehicleStatus, type VStatus } from "../lib/format";

const STALE_MS = 60_000;

function Legend() {
  const item = (c: string, t: string, dashed = false) => (
    <span key={t} className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: dashed ? "transparent" : c, border: `2px ${dashed ? "dashed" : "solid"} ${c}` }} aria-hidden />{t}
    </span>
  );
  return (
    <div className="panel pointer-events-none absolute bottom-3 left-[23rem] z-[1000] hidden items-center gap-4 whitespace-nowrap px-3 py-1.5 text-xs font-medium text-ink-2 xl:flex" aria-label="Map legend">
      <span className="flex items-center gap-3"><b className="text-ink">Trucks</b>{item("#15803d", "Moving")}{item("#b45309", "Idle")}{item("#6b7280", "Offline")}{item("#c01f2f", "High or critical alert")}</span>
      <span className="h-4 w-px bg-line" aria-hidden />
      <span className="flex items-center gap-3"><b className="text-ink">Zones</b>{item("#0b5fff", "Depot")}{item("#7c3aed", "Customer")}{item("#c01f2f", "Restricted", true)}{item("#4b5563", "Other")}</span>
    </div>
  );
}

export default function MapPage() {
  const live = useLive();
  const now = useNow(5000);
  const geofences = useAsync(() => api.geofences(), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | VStatus>("");
  const [depot, setDepot] = useState("");
  const [selected, setSelected] = useState<string>();
  const [focus, setFocus] = useState<{ lat: number; lon: number; n: number }>();
  const [panel, setPanel] = useState(() => window.innerWidth >= 768); // list starts closed on phones
  const [clusterPref, setClusterPref] = useState<boolean | null>(null); // null = automatic
  const [showZones, setShowZones] = useState(true);
  const cluster = clusterPref ?? live.vehicles.length > 200;

  const depots = useMemo(() => Array.from(new Set(live.vehicles.map((v) => v.depot).filter(Boolean))).sort(), [live.vehicles]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return live.vehicles
      .filter((v) => !t || v.plate.toLowerCase().includes(t) || v.external_id.toLowerCase().includes(t))
      .filter((v) => !depot || v.depot === depot)
      .filter((v) => !status || vehicleStatus(v, live.alertVehicleIds) === status)
      .sort((a, b) => a.plate.localeCompare(b.plate));
  }, [live.vehicles, live.alertVehicleIds, q, status, depot]);

  const online = live.vehicles.filter((v) => v.online).length;
  const activeTrips = live.vehicles.filter((v) => v.trip_status === "active").length;
  const newest = live.vehicles.reduce<number>((m, v) => Math.max(m, v.recorded_at ? new Date(v.recorded_at).getTime() : 0), 0);
  const dataAge = newest ? now - newest : undefined;
  const stale = dataAge !== undefined && dataAge > STALE_MS;

  const select = (id: string) => {
    setSelected(id);
    const v = live.vehicles.find((x) => x.id === id);
    if (v?.lat != null && v.lon != null) setFocus({ lat: v.lat, lon: v.lon, n: Date.now() });
  };

  return (
    <div className="relative h-full">
      <MapView vehicles={filtered} alertIds={live.alertVehicleIds} geofences={showZones ? geofences.data?.data : undefined} cluster={cluster}
        selectedId={selected} onSelect={setSelected} focus={focus} />

      {/* KPI strip */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[1000] flex flex-col items-center gap-2 p-3">
        <div className="panel pointer-events-auto flex divide-x divide-line overflow-x-auto">
          <Stat label="Online" value={`${online}/${live.vehicles.length}`} />
          <Stat label="Active trips" value={activeTrips} to="/trips?status=active" />
          <Stat label="Open alerts" value={live.openAlerts.length} tone={live.openAlerts.length ? "bad" : undefined} to="/alerts" />
          <Stat label="Last data" value={newest ? ago(new Date(newest).toISOString(), now) : "—"} tone={stale ? "bad" : undefined} />
        </div>
        {live.socket !== "open" && (
          <div className="pointer-events-auto rounded border border-line bg-white px-3 py-1.5 text-sm text-ink-2 shadow-sm" role="status">
            {live.socket === "connecting" ? "Connecting to live feed…" : "Live socket not connected. Refreshing every 5 seconds."}
          </div>
        )}
        {live.socket === "open" && stale && (
          <div className="pointer-events-auto rounded border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900" role="status">
            No position updates for {ago(new Date(newest).toISOString(), now).replace(" ago", "")}.
          </div>
        )}
      </div>

      {/* Left panel */}
      <div className="absolute bottom-3 left-3 top-24 z-[1000] flex w-72 max-w-[calc(100%-1.5rem)] flex-col md:top-20">
        <button className="btn mb-2 self-start md:hidden" onClick={() => setPanel((p) => !p)}>{panel ? "Hide list" : "Vehicles"}</button>
        {panel && (
          <div className="panel flex min-h-0 flex-1 flex-col">
            <div className="space-y-2 border-b border-line p-2.5">
              <input className="input" placeholder="Search plate or IMEI" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search vehicles" />
              <div className="flex gap-2">
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as VStatus | "")} aria-label="Filter by status">
                  <option value="">All status</option><option value="moving">Moving</option><option value="idle">Idle</option><option value="offline">Offline</option><option value="alert">Alert</option>
                </select>
                <select className="input" value={depot} onChange={(e) => setDepot(e.target.value)} aria-label="Filter by depot">
                  <option value="">All depots</option>{depots.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} />Show zones</label>
                <label className="inline-flex items-center gap-1.5" title="Group nearby trucks. Switches on by itself above 200 trucks."><input type="checkbox" checked={cluster} onChange={(e) => setClusterPref(e.target.checked)} />Group nearby trucks</label>
              </div>
              <div className="text-xs text-ink-3">{filtered.length} of {live.vehicles.length} vehicles</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {live.loading && !live.vehicles.length ? <Loading /> :
                live.error && !live.vehicles.length ? <ErrorState message={live.error} onRetry={live.refresh} /> :
                !filtered.length ? <Empty text="No vehicles match." /> :
                <ul>{filtered.map((v) => {
                  const st = vehicleStatus(v, live.alertVehicleIds);
                  return (
                    <li key={v.id}>
                      <button onClick={() => select(v.id)} className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ${selected === v.id ? "bg-blue-50" : ""}`}>
                        <span><span className="block text-sm font-semibold">{v.plate || v.external_id}</span><span className="block text-xs text-ink-3">{v.depot || "—"} · {ago(v.recorded_at, now)}</span></span>
                        <span className="text-right"><StatusDot s={st} /><span className="num block text-xs text-ink-3">{Math.round(v.speed_kph ?? 0)} km/h</span></span>
                      </button>
                    </li>
                  );
                })}</ul>}
            </div>
          </div>
        )}
      </div>

      <Legend />

      {selected && <VehicleDrawer id={selected} onClose={() => setSelected(undefined)} onCentre={(lat, lon) => setFocus({ lat, lon, n: Date.now() })} />}
    </div>
  );
}
