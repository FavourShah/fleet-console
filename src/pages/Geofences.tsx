import { useMemo, useState } from "react";
import MapView, { KIND_COLOR } from "../components/MapView";
import { api, errMsg } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { label } from "../lib/format";
import { Empty, ErrorState, Field, Loading, PageHeader } from "../components/ui";
import type { Geofence, GeofenceKind } from "../lib/api-types";

interface Draft { id?: string; name: string; kind: GeofenceKind; pts: [number, number][] }

export default function Geofences() {
  const { can } = useAuth();
  const list = useAsync(() => api.geofences(), []);
  const [draft, setDraft] = useState<Draft>();
  const [sel, setSel] = useState<string>();
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  const startEdit = (g: Geofence) => setDraft({ id: g.id, name: g.name, kind: g.kind, pts: g.geometry.coordinates[0].slice(0, -1) as [number, number][] });

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setErr("Name is required."); return; }
    if (draft.pts.length < 3) { setErr("Click at least 3 points on the map."); return; }
    setBusy(true); setErr(undefined);
    const ring = [...draft.pts, draft.pts[0]]; // GeoJSON rings are closed
    const body = { name: draft.name.trim(), kind: draft.kind, geometry: { type: "Polygon" as const, coordinates: [ring] } };
    try {
      if (draft.id) await api.updateGeofence(draft.id, body); else await api.createGeofence(body);
      setDraft(undefined); list.reload();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  async function remove(g: Geofence) {
    if (!confirm(`Delete geofence "${g.name}"?`)) return;
    setErr(undefined);
    try { await api.deleteGeofence(g.id); list.reload(); }
    catch (e) { setErr(`Can't delete "${g.name}": ${errMsg(e)}`); }
  }

  const shown = useMemo(() => list.data?.data.filter((g) => g.id !== draft?.id), [list.data, draft?.id]);
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Geofences">{can("mutate") && !draft && <button className="btn btn-primary" onClick={() => setDraft({ name: "", kind: "depot", pts: [] })}>New geofence</button>}</PageHeader>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="max-h-56 w-full shrink-0 overflow-auto border-b border-line bg-white md:max-h-none md:w-80 md:border-b-0 md:border-r">
          {err && <ErrorState message={err} />}
          {draft && (
            <div className="space-y-3 border-b border-line bg-blue-50 p-3">
              <div className="text-sm font-semibold">{draft.id ? "Edit geofence" : "New geofence"}</div>
              <Field label="Name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="Kind"><select className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as GeofenceKind })}>{(["depot", "customer", "restricted", "other"] as const).map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
              <p className="text-xs text-ink-2">Click the map to add corners. {draft.pts.length} point{draft.pts.length === 1 ? "" : "s"}.</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => setDraft({ ...draft, pts: draft.pts.slice(0, -1) })} disabled={!draft.pts.length}>Undo</button>
                <button className="btn" onClick={() => setDraft({ ...draft, pts: [] })} disabled={!draft.pts.length}>Clear</button>
                <button className="btn" onClick={() => { setDraft(undefined); setErr(undefined); }}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}
          {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Loading /> :
            !list.data?.data.length ? <Empty text="No geofences yet." /> : (
            <ul>{list.data.data.map((g) => (
              <li key={g.id} className={`flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 ${sel === g.id ? "bg-blue-50" : ""}`}>
                <button className="flex items-center gap-2 text-left" onClick={() => setSel(g.id)}>
                  <span className="h-3 w-3 rounded-sm" style={{ background: KIND_COLOR[g.kind] }} aria-hidden />
                  <span><span className="block text-sm font-semibold">{g.name}</span><span className="block text-xs text-ink-3">{label(g.kind)}</span></span>
                </button>
                {can("mutate") && !draft && <div className="flex gap-1"><button className="btn" onClick={() => startEdit(g)}>Edit</button><button className="btn btn-danger" onClick={() => remove(g)}>Delete</button></div>}
              </li>))}</ul>)}
        </div>
        <div className="min-h-[300px] flex-1">
          <MapView geofences={shown} highlightId={sel} fitGeofences onMapClick={draft ? (p) => setDraft({ ...draft, pts: [...draft.pts, p] }) : undefined} draft={draft?.pts} />
        </div>
      </div>
    </div>
  );
}
