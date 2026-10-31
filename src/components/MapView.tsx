import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Geofence, Vehicle } from "../lib/api-types";
import { STATUS_COLOR, vehicleStatus } from "../lib/format";

export const KIND_COLOR: Record<string, string> = { depot: "#0b5fff", customer: "#7c3aed", restricted: "#c01f2f", other: "#4b5563" };

const LAGOS: L.LatLngExpression = [6.5244, 3.3792];

interface Props {
  vehicles?: Vehicle[];
  alertIds?: Set<string>;
  geofences?: Geofence[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  focus?: { lat: number; lon: number; n: number };
  className?: string;
  /** Called with clicked [lon,lat] when set (polygon drawing). */
  onMapClick?: (lonLat: [number, number]) => void;
  draft?: [number, number][];
  fitGeofences?: boolean;
}

function icon(text: string, color: string, selected: boolean) {
  return L.divIcon({
    className: "veh-marker",
    html: `<span style="background:${color};${selected ? "outline:3px solid #0b5fff;" : ""}">${text.replace(/</g, "&lt;")}</span>`,
    iconSize: [0, 0],
  });
}

export default function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const vLayer = useRef<L.LayerGroup>();
  const gLayer = useRef<L.LayerGroup>();
  const dLayer = useRef<L.LayerGroup>();
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const fitted = useRef(false);
  const clickRef = useRef(p.onMapClick);
  clickRef.current = p.onMapClick;

  useEffect(() => {
    const m = L.map(el.current!, { center: LAGOS, zoom: 11, zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(m);
    gLayer.current = L.layerGroup().addTo(m);
    vLayer.current = L.layerGroup().addTo(m);
    dLayer.current = L.layerGroup().addTo(m);
    m.on("click", (e) => clickRef.current?.([e.latlng.lng, e.latlng.lat]));
    map.current = m;
    return () => { m.stop(); m.off(); m.remove(); map.current = undefined; markers.current.clear(); fitted.current = false; };
  }, []);

  // Vehicles: update markers in place.
  useEffect(() => {
    const layer = vLayer.current;
    if (!layer || !p.vehicles) return;
    const seen = new Set<string>();
    const pts: L.LatLngExpression[] = [];
    for (const v of p.vehicles) {
      if (v.lat == null || v.lon == null) continue;
      seen.add(v.id);
      pts.push([v.lat, v.lon]);
      const st = vehicleStatus(v, p.alertIds ?? new Set());
      const ic = icon(v.plate || v.external_id.slice(-4), STATUS_COLOR[st], v.id === p.selectedId);
      let mk = markers.current.get(v.id);
      if (!mk) {
        mk = L.marker([v.lat, v.lon], { icon: ic, keyboard: true, title: `${v.plate} (${st})` }).addTo(layer);
        mk.on("click", () => p.onSelect?.(v.id));
        markers.current.set(v.id, mk);
      } else {
        mk.setLatLng([v.lat, v.lon]);
        mk.setIcon(ic);
        mk.options.title = `${v.plate} (${st})`;
      }
      mk.setZIndexOffset(v.id === p.selectedId ? 1000 : st === "alert" ? 500 : 0);
    }
    markers.current.forEach((mk, id) => { if (!seen.has(id)) { layer.removeLayer(mk); markers.current.delete(id); } });
    if (!fitted.current && pts.length && map.current) {
      map.current.fitBounds(L.latLngBounds(pts as L.LatLngTuple[]).pad(0.2), { animate: false });
      fitted.current = true;
    }
  }, [p.vehicles, p.alertIds, p.selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Geofence polygons.
  useEffect(() => {
    const layer = gLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const all: L.LatLngTuple[] = [];
    for (const g of p.geofences ?? []) {
      const ring = g.geometry.coordinates[0]?.map(([lon, lat]) => [lat, lon] as L.LatLngTuple) ?? [];
      if (!ring.length) continue;
      all.push(...ring);
      const c = KIND_COLOR[g.kind] ?? KIND_COLOR.other;
      L.polygon(ring, { color: c, weight: 2, fillColor: c, fillOpacity: 0.12, dashArray: g.kind === "restricted" ? "6 4" : undefined })
        .bindTooltip(`${g.name} · ${g.kind}`, { sticky: true }).addTo(layer);
    }
    if (p.fitGeofences && all.length && map.current) map.current.fitBounds(L.latLngBounds(all).pad(0.3), { animate: false });
  }, [p.geofences, p.fitGeofences]);

  // Draft polygon while drawing.
  useEffect(() => {
    const layer = dLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const d = (p.draft ?? []).map(([lon, lat]) => [lat, lon] as L.LatLngTuple);
    if (d.length >= 3) L.polygon(d, { color: "#0b5fff", weight: 2, dashArray: "4 4", fillOpacity: 0.1 }).addTo(layer);
    else if (d.length === 2) L.polyline(d, { color: "#0b5fff", weight: 2, dashArray: "4 4" }).addTo(layer);
    d.forEach((pt) => L.circleMarker(pt, { radius: 4, color: "#0b5fff", fillColor: "#fff", fillOpacity: 1 }).addTo(layer));
    el.current?.classList.toggle("cursor-crosshair", !!p.onMapClick);
  }, [p.draft, p.onMapClick]);

  // Programmatic focus ("centre on map").
  useEffect(() => {
    if (p.focus && map.current) map.current.setView([p.focus.lat, p.focus.lon], Math.max(map.current.getZoom(), 15));
  }, [p.focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={p.className ?? "h-full w-full"} />;
}
