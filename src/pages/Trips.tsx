import { useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { useLive } from "../lib/live";
import { dt, label } from "../lib/format";
import { Empty, ErrorState, Field, Loading, Modal, PageHeader, Pill } from "../components/ui";
import type { Trip, TripStatus } from "../lib/api-types";

const STATUSES: TripStatus[] = ["planned", "assigned", "active", "completed", "cancelled"];
const TONE: Record<TripStatus, "neutral" | "ok" | "warn" | "bad"> = { planned: "neutral", assigned: "warn", active: "ok", completed: "neutral", cancelled: "bad" };

export default function Trips() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<Trip>();
  const [busy, setBusy] = useState<string>();
  const [actErr, setActErr] = useState<string>();
  const list = useAsync(() => api.trips(status), [status]);

  async function setTripStatus(t: Trip, s: TripStatus) {
    if (s === "cancelled" && !confirm(`Cancel trip to ${t.destination}?`)) return;
    setBusy(t.id); setActErr(undefined);
    try { await api.updateTrip(t.id, { status: s }); list.reload(); }
    catch (e) { setActErr(errMsg(e)); } finally { setBusy(undefined); }
  }

  const actions = (t: Trip) => {
    if (!can("mutate")) return null;
    const b = (text: string, fn: () => void, cls = "") => <button key={text} className={`btn ${cls}`} disabled={busy === t.id} onClick={fn}>{text}</button>;
    const out = [];
    if (t.status === "planned") out.push(b("Assign", () => (t.driver_id ? setTripStatus(t, "assigned") : setAssigning(t))));
    if (t.status === "assigned") out.push(b("Start", () => setTripStatus(t, "active"), "btn-primary"));
    if (t.status === "active") out.push(b("Complete", () => setTripStatus(t, "completed"), "btn-primary"));
    if (["planned", "assigned", "active"].includes(t.status)) out.push(b("Cancel", () => setTripStatus(t, "cancelled"), "btn-danger"));
    return <div className="flex justify-end gap-1.5">{out}</div>;
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Trips">
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <button className="btn" onClick={list.reload}>Refresh</button>
        {can("mutate") && <button className="btn btn-primary" onClick={() => setCreating(true)}>New trip</button>}
      </PageHeader>
      {actErr && <ErrorState message={actErr} />}
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Loading /> :
          !list.data?.data.length ? <Empty text="No trips match." /> : (
          <table className="w-full">
            <thead><tr>{["Vehicle", "Driver", "Origin", "Destination", "Status", "Started", "Ended", "Distance"].map((h) => <th key={h} className="th">{h}</th>)}<th className="th" /></tr></thead>
            <tbody>{list.data.data.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="td font-semibold">{t.plate}</td><td className="td">{t.driver_name ?? "—"}</td><td className="td">{t.origin}</td><td className="td">{t.destination}</td>
                <td className="td"><Pill tone={TONE[t.status]}>{label(t.status)}</Pill></td>
                <td className="td num">{dt(t.started_at)}</td><td className="td num">{dt(t.ended_at)}</td>
                <td className="td num text-right">{t.distance_km ? `${t.distance_km.toFixed(1)} km` : "—"}</td>
                <td className="td">{actions(t)}</td>
              </tr>))}</tbody>
          </table>)}
      </div>
      {creating && <CreateTrip onClose={() => setCreating(false)} onDone={() => { setCreating(false); list.reload(); }} />}
      {assigning && <AssignDriver trip={assigning} onClose={() => setAssigning(undefined)} onDone={() => { setAssigning(undefined); list.reload(); }} />}
    </div>
  );
}

function CreateTrip({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { vehicles } = useLive();
  const drivers = useAsync(() => api.drivers(), []);
  const [vehicle, setVehicle] = useState(""); const [driver, setDriver] = useState("");
  const [origin, setOrigin] = useState(""); const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();
  async function go() {
    if (!vehicle || !origin.trim() || !dest.trim()) { setErr("Vehicle, origin and destination are required."); return; }
    setBusy(true); setErr(undefined);
    try { await api.createTrip({ vehicle_id: vehicle, driver_id: driver || undefined, origin: origin.trim(), destination: dest.trim() }); onDone(); }
    catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal title="New trip" onClose={onClose}>
      {err && <ErrorState message={err} />}
      <div className="space-y-3">
        <Field label="Vehicle"><select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="">Choose…</option>{[...vehicles].sort((a, b) => a.plate.localeCompare(b.plate)).map((v) => <option key={v.id} value={v.id}>{v.plate}{v.depot ? ` · ${v.depot}` : ""}</option>)}</select></Field>
        <Field label="Driver (optional)"><select className="input" value={driver} onChange={(e) => setDriver(e.target.value)}><option value="">None</option>{drivers.data?.data.filter((d) => d.status === "active").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Origin"><input className="input" value={origin} onChange={(e) => setOrigin(e.target.value)} /></Field>
        <Field label="Destination"><input className="input" value={dest} onChange={(e) => setDest(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>{busy ? "Creating…" : "Create trip"}</button></div>
    </Modal>
  );
}

function AssignDriver({ trip, onClose, onDone }: { trip: Trip; onClose: () => void; onDone: () => void }) {
  const drivers = useAsync(() => api.drivers(), []);
  const [driver, setDriver] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();
  async function go() {
    if (!driver) { setErr("Choose a driver."); return; }
    setBusy(true);
    try { await api.updateTrip(trip.id, { status: "assigned", driver_id: driver }); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal title={`Assign driver · ${trip.plate}`} onClose={onClose}>
      {err && <ErrorState message={err} />}
      <Field label="Driver"><select className="input" value={driver} onChange={(e) => setDriver(e.target.value)}><option value="">Choose…</option>{drivers.data?.data.filter((d) => d.status === "active").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
      <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>Assign</button></div>
    </Modal>
  );
}
