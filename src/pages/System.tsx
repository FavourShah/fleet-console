import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { useEffect } from "react";
import { label } from "../lib/format";
import { ErrorState, Loading, PageHeader, Pill } from "../components/ui";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const OK = new Set(["ok", "up", "healthy", "connected", "true"]);

function Value({ v }: { v: Json }) {
  if (typeof v === "boolean") return <Pill tone={v ? "ok" : "bad"}>{v ? "Yes" : "No"}</Pill>;
  if (typeof v === "string") return OK.has(v.toLowerCase()) ? <Pill tone="ok">{label(v)}</Pill> : <span className="font-medium">{v}</span>;
  if (typeof v === "number") return <span className="num font-semibold">{v.toLocaleString()}</span>;
  if (v === null) return <span className="text-ink-3">—</span>;
  return <span>{JSON.stringify(v)}</span>;
}

function Section({ name, data }: { name: string; data: Json }) {
  const entries = data && typeof data === "object" && !Array.isArray(data) ? Object.entries(data) : null;
  return (
    <div className="panel p-4">
      <h2 className="mb-2 text-xs font-semibold text-ink-3">{label(name)}</h2>
      {entries ? <dl className="space-y-1.5 text-sm">{entries.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4">
          <dt className="text-ink-2">{label(k)}</dt>
          <dd className="text-right">{v && typeof v === "object" && !Array.isArray(v) ? <div className="space-y-1">{Object.entries(v).map(([kk, vv]) => <div key={kk}><span className="text-ink-3">{label(kk)}: </span><Value v={vv as Json} /></div>)}</div> : <Value v={v} />}</dd>
        </div>))}</dl> : <div className="text-lg"><Value v={data} /></div>}
    </div>
  );
}

export default function System() {
  const h = useAsync(() => api.systemHealth() as Promise<Record<string, Json>>, []);
  useEffect(() => { const id = setInterval(h.reload, 10000); return () => clearInterval(id); }, [h.reload]);
  const data = h.data;
  const scalars = data ? Object.entries(data).filter(([, v]) => typeof v !== "object" || v === null) : [];
  const groups = data ? Object.entries(data).filter(([, v]) => typeof v === "object" && v !== null) : [];
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="System"><span className="text-xs text-ink-3">Refreshes every 10 s</span><button className="btn" onClick={h.reload}>Refresh</button></PageHeader>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {h.error && <ErrorState message={`Health check failed: ${h.error}`} onRetry={h.reload} />}
        {h.loading && !data ? <Loading /> : data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scalars.length > 0 && <Section name="Overview" data={Object.fromEntries(scalars) as Json} />}
            {groups.map(([k, v]) => <Section key={k} name={k} data={v as Json} />)}
          </div>)}
      </div>
    </div>
  );
}
