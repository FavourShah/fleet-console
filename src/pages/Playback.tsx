import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import RouteMap from "../components/RouteMap";
import { PageHeader, Empty, ErrorState, Loading } from "../components/ui";
import { api, errMsg } from "../lib/api";
import { useLive } from "../lib/live";
import { dt, toLocalInput } from "../lib/format";
import type { Point } from "../lib/api-types";

const SPEEDS = [1, 4, 16, 64];

export default function Playback() {
  const { vehicleId } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { vehicles } = useLive();
  const [from, setFrom] = useState(() => sp.get("from") ? toLocalInput(new Date(sp.get("from")!)) : toLocalInput(new Date(Date.now() - 2 * 3600e3)));
  const [to, setTo] = useState(() => sp.get("to") ? toLocalInput(new Date(sp.get("to")!)) : toLocalInput(new Date()));
  const [res, setRes] = useState<"" | "raw" | "30s" | "5m">("");
  const [points, setPoints] = useState<Point[]>([]);
  const [used, setUsed] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  async function load() {
    if (!vehicleId) return;
    setLoading(true); setErr(undefined); setPlaying(false);
    try {
      const r = await api.history(vehicleId, new Date(from).toISOString(), new Date(to).toISOString(), res || undefined);
      setPoints(r.data ?? []); setUsed(r.resolution); setIdx(0); setLoaded(true);
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  }

  // Auto-load when arriving from a link.
  useEffect(() => { setLoaded(false); setPoints([]); if (vehicleId) load(); /* eslint-disable-next-line */ }, [vehicleId]);

  useEffect(() => {
    clearInterval(timer.current);
    if (!playing) return;
    timer.current = setInterval(() => setIdx((i) => {
      if (i >= points.length - 1) { setPlaying(false); return i; }
      return Math.min(points.length - 1, i + Math.max(1, Math.round(speed / 4)));
    }), 250);
    return () => clearInterval(timer.current);
  }, [playing, speed, points.length]);

  const cur = points[idx];
  const km = useMemo(() => {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const R = 6371, rad = Math.PI / 180;
      const x = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
      d += 2 * R * Math.asin(Math.sqrt(x));
    }
    return d;
  }, [points]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Playback">
        <select className="input w-44" value={vehicleId ?? ""} onChange={(e) => nav(`/playback/${e.target.value}`)} aria-label="Vehicle">
          <option value="" disabled>Choose vehicle</option>
          {[...vehicles].sort((a, b) => a.plate.localeCompare(b.plate)).map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
        </select>
        <input className="input w-auto" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input className="input w-auto" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <select className="input w-auto" value={res} onChange={(e) => setRes(e.target.value as typeof res)} aria-label="Resolution">
          <option value="">Auto resolution</option><option value="raw">Raw</option><option value="30s">30 s</option><option value="5m">5 min</option>
        </select>
        <button className="btn btn-primary" onClick={load} disabled={!vehicleId || loading}>Load</button>
      </PageHeader>
      <div className="relative min-h-0 flex-1">
        <RouteMap points={points} index={idx} />
        {!vehicleId && <div className="panel absolute left-1/2 top-4 z-[1000] -translate-x-1/2"><Empty text="Choose a vehicle to replay its route." /></div>}
        {loading && <div className="panel absolute left-1/2 top-4 z-[1000] -translate-x-1/2"><Loading text="Loading route…" /></div>}
        {err && <div className="absolute left-1/2 top-4 z-[1000] w-96 max-w-full -translate-x-1/2 bg-white"><ErrorState message={err} onRetry={load} /></div>}
        {loaded && !loading && !err && points.length === 0 && <div className="panel absolute left-1/2 top-4 z-[1000] -translate-x-1/2"><Empty text="No positions in this time range." /></div>}
        {points.length > 0 && (
          <div className="panel absolute bottom-3 left-3 right-3 z-[1000] space-y-2 p-3 md:left-1/2 md:right-auto md:w-[40rem] md:-translate-x-1/2">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-primary w-20 justify-center" onClick={() => { if (idx >= points.length - 1) setIdx(0); setPlaying((p) => !p); }}>{playing ? "Pause" : "Play"}</button>
              <div className="flex" role="group" aria-label="Speed">
                {SPEEDS.map((s) => <button key={s} className={`btn rounded-none first:rounded-l last:rounded-r ${speed === s ? "bg-ink text-white hover:bg-ink" : ""}`} onClick={() => setSpeed(s)}>{s}×</button>)}
              </div>
              <span className="num ml-auto text-xs text-ink-3">{vehicle?.plate} · {points.length} points · {km.toFixed(1)} km · resolution: <b>{used ?? "—"}</b></span>
            </div>
            <input type="range" className="w-full" min={0} max={points.length - 1} value={idx} onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} aria-label="Timeline" />
            {cur && <div className="num flex justify-between text-xs"><span>{dt(cur.t)}</span><span>{Math.round(cur.speed_kph)} km/h</span><span>{Math.round(cur.heading_deg)}°</span></div>}
          </div>
        )}
      </div>
    </div>
  );
}
