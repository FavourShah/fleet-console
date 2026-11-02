import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { api, errMsg } from "../lib/api";
import { useAsync, useNow } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { useLive } from "../lib/live";
import { ago, dt, label, vehicleStatus } from "../lib/format";
import { ErrorState, Field, Loading, Modal, SeverityBadge, StatusDot } from "./ui";
import type { Vehicle, VehicleUpdate } from "../lib/api-types";

export default function VehicleDrawer({ id, onClose, onCentre }: { id: string; onClose: () => void; onCentre: (lat: number, lon: number) => void }) {
  const { can } = useAuth();
  const live = useLive();
  const now = useNow(5000);
  const detail = useAsync(() => api.vehicle(id), [id]);
  const events = useAsync(() => api.events(id), [id]);
  const [edit, setEdit] = useState(false);

  // Live position/online state wins over the one-off detail fetch.
  const lv = live.vehicles.find((v) => v.id === id);
  const v: Vehicle | undefined = detail.data ? { ...detail.data.data, ...(lv ? { lat: lv.lat, lon: lv.lon, speed_kph: lv.speed_kph, heading_deg: lv.heading_deg, recorded_at: lv.recorded_at, online: lv.online } : {}) } : undefined;

  return (
    <aside className="panel absolute bottom-3 right-3 top-24 z-[1000] flex w-80 max-w-[calc(100%-1.5rem)] flex-col md:top-3" aria-label="Vehicle details">
      <div className="flex items-start justify-between gap-2 border-b border-line p-3">
        <div>
          <div className="text-lg font-semibold">{v?.plate ?? "…"}</div>
          {v && <StatusDot s={vehicleStatus(v, live.alertVehicleIds)} />}
        </div>
        <button className="btn" onClick={onClose} aria-label="Close drawer">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {detail.loading && !v ? <Loading /> : detail.error ? <ErrorState message={detail.error} onRetry={detail.reload} /> : v && (
          <>
            <div className="flex flex-wrap gap-2 border-b border-line p-3">
              <button className="btn" disabled={v.lat == null} onClick={() => v.lat != null && v.lon != null && onCentre(v.lat, v.lon)}>Centre</button>
              <Link className="btn" to={`/playback/${v.id}`}>Play back</Link>
              {can("mutate") && <button className="btn" onClick={() => setEdit(true)}>Edit / assign driver</button>}
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1.5 p-3 text-sm">
              <Row k="Type" v={v.vehicle_type} />
              <Row k="Make / model" v={[v.make, v.model, v.year].filter(Boolean).join(" ")} />
              <Row k="Colour" v={v.colour} />
              <Row k="Depot" v={v.depot} />
              <Row k="Department" v={v.department} />
              <Row k="Driver" v={v.driver_name} />
              <Row k="Driver phone" v={v.driver_phone} />
              <Row k="Trip" v={v.trip_id ? `${v.destination ?? "—"} (${label(v.trip_status ?? "")})` : "No active trip"} />
              <Row k="Speed" v={v.speed_kph != null ? `${Math.round(v.speed_kph)} km/h` : undefined} />
              <Row k="Heading" v={v.heading_deg != null ? `${Math.round(v.heading_deg)}°` : undefined} />
              <Row k="Last seen" v={ago(v.last_seen_at ?? v.recorded_at, now)} />
              <Row k="Online" v={v.online ? "Yes" : "No"} />
            </dl>
            <div className="border-t border-line p-3">
              <h3 className="mb-2 text-xs font-semibold text-ink-3">Recent events</h3>
              {events.loading && !events.data ? <Loading /> : events.error ? <ErrorState message={events.error} onRetry={events.reload} /> :
                !events.data?.data.length ? <p className="text-sm text-ink-3">No recent events.</p> :
                <ul className="space-y-2">{events.data.data.slice(0, 15).map((e, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      {e.severity && <SeverityBadge s={e.severity} />}
                      <span className="font-medium">{label(e.type)}{e.name ? ` · ${e.name}` : ""}</span>
                    </div>
                    <div className="text-xs text-ink-3">{dt(e.at)}{e.status ? ` · ${e.status}` : ""}</div>
                  </li>))}</ul>}
            </div>
          </>
        )}
      </div>
      {edit && v && <EditVehicle v={v} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); detail.reload(); live.refresh(); }} />}
    </aside>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return <Fragment><dt className="text-ink-3">{k}</dt><dd className="break-words font-medium">{v || "—"}</dd></Fragment>;
}

function EditVehicle({ v, onClose, onSaved }: { v: Vehicle; onClose: () => void; onSaved: () => void }) {
  const drivers = useAsync(() => api.drivers(), []);
  const [f, setF] = useState<VehicleUpdate>({ plate: v.plate, vehicle_type: v.vehicle_type, make: v.make, model: v.model, year: v.year, colour: v.colour, depot: v.depot, department: v.department, status: v.status, driver_id: v.driver_id });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const set = <K extends keyof VehicleUpdate>(k: K, val: VehicleUpdate[K]) => setF((p) => ({ ...p, [k]: val }));

  async function save() {
    setBusy(true); setErr(undefined);
    try {
      const body: VehicleUpdate = { ...f };
      if (!body.driver_id) delete body.driver_id;
      await api.updateVehicle(v.id, body);
      onSaved();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }

  return (
    <Modal title={`Edit ${v.plate}`} onClose={onClose}>
      {err && <ErrorState message={err} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plate"><input className="input" value={f.plate ?? ""} onChange={(e) => set("plate", e.target.value)} /></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={(e) => set("status", e.target.value as Vehicle["status"])}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></Field>
        <Field label="Type"><input className="input" value={f.vehicle_type ?? ""} onChange={(e) => set("vehicle_type", e.target.value)} /></Field>
        <Field label="Colour"><input className="input" value={f.colour ?? ""} onChange={(e) => set("colour", e.target.value)} /></Field>
        <Field label="Make"><input className="input" value={f.make ?? ""} onChange={(e) => set("make", e.target.value)} /></Field>
        <Field label="Model"><input className="input" value={f.model ?? ""} onChange={(e) => set("model", e.target.value)} /></Field>
        <Field label="Year"><input className="input" type="number" value={f.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : undefined)} /></Field>
        <Field label="Depot"><input className="input" value={f.depot ?? ""} onChange={(e) => set("depot", e.target.value)} /></Field>
        <Field label="Department"><input className="input" value={f.department ?? ""} onChange={(e) => set("department", e.target.value)} /></Field>
        <Field label="Driver">
          <select className="input" value={f.driver_id ?? ""} onChange={(e) => set("driver_id", e.target.value || undefined)}>
            <option value="">{v.driver_id ? "Keep current" : "Unassigned"}</option>
            {drivers.data?.data.filter((d) => d.status === "active").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}
