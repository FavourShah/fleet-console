import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { label, toLocalInput } from "../lib/format";
import { ErrorState, Loading, PageHeader } from "../components/ui";

export default function Reports() {
  const [from, setFrom] = useState(() => toLocalInput(new Date(Date.now() - 7 * 864e5)).slice(0, 10));
  const [to, setTo] = useState(() => toLocalInput(new Date()).slice(0, 10));
  const r = useAsync(() => api.reportSummary(new Date(from + "T00:00:00").toISOString(), new Date(to + "T23:59:59").toISOString()), [from, to]);
  const d = r.data;
  const cards: [string, number | string][] = d ? [["Vehicles", d.vehicles], ["Trips", d.trips], ["Completed trips", d.completed_trips], ["Active trips", d.active_trips], ["Alerts", d.alerts], ["Open alerts", d.open_alerts], ["Distance", `${Math.round(d.distance_km).toLocaleString()} km`]] : [];
  const max = Math.max(1, ...(d?.alerts_by_type ?? []).map((a) => a.count));
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Reports">
        <input className="input w-auto" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input className="input w-auto" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" />
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading && !d ? <Loading /> : d && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([l, v]) => (
              <div key={l} className="panel p-4"><div className="text-xs font-medium uppercase tracking-wide text-ink-3">{l}</div><div className="num text-2xl font-semibold">{typeof v === "number" ? v.toLocaleString() : v}</div></div>))}</div>
            <div className="panel p-4">
              <h2 className="mb-3 font-semibold">Alerts by type</h2>
              {!d.alerts_by_type?.length ? <p className="text-sm text-ink-3">No alerts in this range.</p> :
                <ul className="space-y-2">{d.alerts_by_type.map((a) => (
                  <li key={a.key} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
                    <span>{label(a.key)}</span><span className="h-3 rounded bg-slate-100"><span className="block h-3 rounded bg-ink" style={{ width: `${(a.count / max) * 100}%` }} /></span><span className="num text-right font-medium">{a.count}</span>
                  </li>))}</ul>}
            </div>
          </div>)}
      </div>
    </div>
  );
}
