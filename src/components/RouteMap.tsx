import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Point } from "../lib/api-types";

/** Route line + moving marker for playback / alert detail. */
export default function RouteMap({ points, index, single }: { points: Point[]; index: number; single?: { lat: number; lon: number } }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const line = useRef<L.Polyline>();
  const dot = useRef<L.CircleMarker>();

  useEffect(() => {
    const m = L.map(el.current!, { center: [6.5244, 3.3792], zoom: 11 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(m);
    map.current = m;
    return () => { m.stop(); m.off(); m.remove(); };
  }, []);

  useEffect(() => {
    const m = map.current!;
    const safe = (l?: L.Layer) => { try { l?.remove(); } catch { /* map already torn down (StrictMode remount) */ } };
    safe(line.current); safe(dot.current);
    const ll = points.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    if (ll.length) {
      line.current = L.polyline(ll, { color: "#0b5fff", weight: 4, opacity: 0.8 }).addTo(m);
      m.fitBounds(line.current.getBounds().pad(0.15), { animate: false });
      dot.current = L.circleMarker(ll[0], { radius: 8, color: "#fff", weight: 3, fillColor: "#c01f2f", fillOpacity: 1 }).addTo(m);
    } else if (single) {
      dot.current = L.circleMarker([single.lat, single.lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#c01f2f", fillOpacity: 1 }).addTo(m);
      m.setView([single.lat, single.lon], 15, { animate: false });
    }
  }, [points, single?.lat, single?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = points[index];
    if (p) dot.current?.setLatLng([p.lat, p.lon]);
  }, [index, points]);

  return <div ref={el} className="h-full w-full" />;
}
