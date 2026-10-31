import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, errMsg } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { useLive } from "../lib/live";
import { dt, label } from "../lib/format";
import { Empty, ErrorState, Loading, PageHeader, Pill, SeverityBadge } from "../components/ui";
import RouteMap from "../components/RouteMap";
import type { Alert } from "../lib/api-types";

const TYPES = ["geofence_enter", "geofence_exit", "route_deviation", "idle", "speeding", "device_offline", "unplanned_trip"];

export default function Alerts() {
  const { can } = useAuth();
  const live = useLive();
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("");
  const [sev, setSev] = useState("");
  const [sel, setSel] = useState<Alert>();
  const [busy, setBusy] = useState<string>();
  const [actErr, setActErr] = useState<string>();
  const list = useAsync(() => api.alerts({ status, type, limit: 200 }), [status, type]);
  const rows = useMemo(() => (list.data?.data ?? []).filter((a) => !sev || a.severity === sev), [list.data, sev]);

  async function ack(a: Alert) {
    setBusy(a.id); setActErr(undefined);
    try {
      await api.ackAlert(a.id);
      list.reload(); live.refreshAlerts();
      setSel((s) => (s?.id === a.id ? { ...s, status: "acked", acked_at: new Date().toISOString() } : s));
    } catch (e) { setActErr(errMsg(e)); }
    finally { setBusy(undefined); }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Alerts">
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="open">Open</option><option value="acked">Acknowledged</option><option value="closed">Closed</option><option value="">All</option>
        </select>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </select>
        <select className="input w-auto" value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity">
          <option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <button className="btn" onClick={list.reload}>Refresh</button>
      </PageHeader>
      {actErr && <ErrorState message={actErr} />}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Loading /> :
            !rows.length ? <Empty text="No alerts match these filters." /> : (
            <table className="w-full">
              <thead><tr><th className="th">Time</th><th className="th">Vehicle</th><th className="th">Type</th><th className="th">Severity</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody>{rows.map((a) => (
                <tr key={a.id} onClick={() => setSel(a)} className={`cursor-pointer hover:bg-slate-50 ${sel?.id === a.id ? "bg-blue-50" : ""}`}>
                  <td className="td num">{dt(a.occurred_at)}</td>
                  <td className="td font-semibold">{a.plate}</td>
                  <td className="td">{label(a.type)}{typeof a.evidence?.geofence_name === "string" ? ` · ${a.evidence.geofence_name}` : ""}</td>
                  <td className="td"><SeverityBadge s={a.severity} /></td>
                  <td className="td"><Pill tone={a.status === "open" ? "bad" : "neutral"}>{a.status === "acked" ? "Acknowledged" : label(a.status)}</Pill></td>
                  <td className="td text-right">{a.status === "open" && can("ack") && <button className="btn" disabled={busy === a.id} onClick={(e) => { e.stopPropagation(); ack(a); }}>{busy === a.id ? "…" : "Acknowledge"}</button>}</td>
                </tr>))}</tbody>
            </table>)}
        </div>
        {sel && <Detail a={sel} onClose={() => setSel(undefined)} onAck={() => ack(sel)} busy={busy === sel.id} canAck={can("ack")} />}
      </div>
    </div>
  );
}

function Detail({ a, onClose, onAck, busy, canAck }: { a: Alert; onClose: () => void; onAck: () => void; busy: boolean; canAck: boolean }) {
  const { vehicles } = useLive();
  const ev = a.evidence ?? {};
  const v = vehicles.find((x) => x.id === a.vehicle_id);
  const lat = typeof ev.lat === "number" ? ev.lat : v?.lat;
  const lon = typeof ev.lon === "number" ? ev.lon : v?.lon;
  const t = new Date(a.occurred_at).getTime();
  const from = new Date(t - 30 * 60e3).toISOString(), to = new Date(t + 5 * 60e3).toISOString();
  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-line bg-white md:w-96 md:border-l md:border-t-0" aria-label="Alert detail">
      <div className="flex items-center justify-between border-b border-line p-3">
        <div><div className="font-semibold">{label(a.type)}</div><div className="text-xs text-ink-3">{a.plate} · {dt(a.occurred_at)}</div></div>
        <button className="btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="h-48 border-b border-line">{lat != null && lon != null ? <RouteMap points={[]} index={0} single={{ lat, lon }} /> : <Empty text="No position for this alert." />}</div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3 text-sm">
        <div className="flex gap-2"><SeverityBadge s={a.severity} /><Pill tone={a.status === "open" ? "bad" : "neutral"}>{label(a.status)}</Pill></div>
        {a.acked_at && <div className="text-ink-3">Acknowledged {dt(a.acked_at)}</div>}
        <div>Trip: {a.trip_id ? <span className="font-medium">{a.trip_id.slice(0, 8)}…</span> : "—"}{v?.driver_name ? <> · Driver: <span className="font-medium">{v.driver_name}</span></> : null}</div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Evidence</div>
          {Object.keys(ev).length ? <dl className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1">{Object.entries(ev).map(([k, val]) => (<Fragment key={k}><dt className="text-ink-3">{label(k)}</dt><dd className="break-words font-medium">{typeof val === "object" ? JSON.stringify(val) : String(val)}</dd></Fragment>))}</dl> : <span className="text-ink-3">None recorded.</span>}
        </div>
      </div>
      <div className="flex gap-2 border-t border-line p-3">
        <Link className="btn" to={`/playback/${a.vehicle_id}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>Replay 30 min</Link>
        {a.status === "open" && canAck && <button className="btn btn-primary" onClick={onAck} disabled={busy}>{busy ? "…" : "Acknowledge"}</button>}
      </div>
    </aside>
  );
}
