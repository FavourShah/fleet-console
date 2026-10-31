import { useMemo, useState } from "react";
import MapView from "../components/MapView";
import VehicleDrawer from "../components/VehicleDrawer";
import { Empty, ErrorState, Loading, Stat, StatusDot } from "../components/ui";
import { useLive } from "../lib/live";
import { useAsync, useNow } from "../lib/hooks";
import { api } from "../lib/api";
import { ago, vehicleStatus, type VStatus } from "../lib/format";

const STALE_MS = 60_000;

export default function MapPage() {
  const live = useLive();
  const now = useNow(5000);
  const geofences = useAsync(() => api.geofences(), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | VStatus>("");
  const [depot, setDepot] = useState("");
  const [selected, setSelected] = useState<string>();
  const [focus, setFocus] = useState<{ lat: number; lon: number; n: number }>();
  const [panel, setPanel] = useState(true);

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
      <MapView vehicles={filtered} alertIds={live.alertVehicleIds} geofences={geofences.data?.data}
        selectedId={selected} onSelect={setSelected} focus={focus} />

      {/* KPI strip */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[1000] flex flex-col items-center gap-2 p-3">
        <div className="panel pointer-events-auto flex divide-x divide-line overflow-x-auto">
          <Stat label="Online" value={`${online}/${live.vehicles.length}`} />
          <Stat label="Active trips" value={activeTrips} />
          <Stat label="Open alerts" value={live.openAlerts.length} tone={live.openAlerts.length ? "bad" : undefined} />
          <Stat label="Last data" value={newest ? ago(new Date(newest).toISOString(), now) : "—"} tone={stale ? "bad" : undefined} />
        </div>
        {live.socket !== "open" && (
          <div className="pointer-events-auto rounded border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900" role="status">
            {live.socket === "connecting" ? "Connecting to live feed…" : "Live feed disconnected — refreshing every 5 seconds instead."}
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

      {selected && <VehicleDrawer id={selected} onClose={() => setSelected(undefined)} onCentre={(lat, lon) => setFocus({ lat, lon, n: Date.now() })} />}
    </div>
  );
}
