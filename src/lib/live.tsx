import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Alert, LiveMessage, Vehicle } from "./api-types";

export type SocketState = "connecting" | "open" | "reconnecting";

interface LiveCtx {
  vehicles: Vehicle[];
  loading: boolean;
  error?: string;
  socket: SocketState;
  lastMessageAt?: number;
  openAlerts: Alert[];
  alertVehicleIds: Set<string>;
  toast?: { id: number; text: string };
  refresh: () => void;
  refreshAlerts: () => void;
}

const Ctx = createContext<LiveCtx>(null as never);
export const useLive = () => useContext(Ctx);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [byId, setById] = useState<Map<string, Vehicle>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [socket, setSocket] = useState<SocketState>("connecting");
  const [lastMessageAt, setLast] = useState<number>();
  const [openAlerts, setOpenAlerts] = useState<Alert[]>([]);
  const [toast, setToast] = useState<LiveCtx["toast"]>();
  const pending = useRef<Map<string, Vehicle>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const r = await api.liveSnapshot();
      setById(new Map(r.data.map((v) => [v.id, v])));
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const r = await api.alerts({ status: "open", limit: 500 });
      setOpenAlerts(r.data);
    } catch { /* non-fatal: map still works */ }
  }, []);

  // Fallback for hosts that can't proxy WebSockets (e.g. Vercel/Netlify rewrites):
  // while the socket isn't open, poll the snapshot so the map still updates.
  useEffect(() => {
    if (socket === "open") return;
    const id = setInterval(() => { refresh(); refreshAlerts(); }, 5000);
    return () => clearInterval(id);
  }, [socket, refresh, refreshAlerts]);

  // Batch position deltas so 20+ trucks don't re-render the tree per message.
  useEffect(() => {
    const id = setInterval(() => {
      if (pending.current.size === 0) return;
      const batch = pending.current;
      pending.current = new Map();
      setById((prev) => {
        const next = new Map(prev);
        batch.forEach((v, k) => next.set(k, v));
        return next;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | undefined;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let toastId = 0;

    const onMessage = (m: LiveMessage) => {
      setLast(Date.now());
      if (m.type === "position") {
        setById((prev) => {
          // WS ids may be the vehicle id or its external id (IMEI); accept either.
          let key = m.vehicle_id;
          let base = pending.current.get(key) ?? prev.get(key);
          if (!base) {
            for (const v of prev.values()) if (v.external_id === m.vehicle_id) { base = v; key = v.id; break; }
          }
          if (!base) return prev;
          pending.current.set(key, { ...base, lat: m.lat, lon: m.lon, recorded_at: m.recorded_at, online: true, last_seen_at: m.recorded_at });
          return prev;
        });
      } else if (m.type === "alert") {
        refreshAlerts();
        const a = m.alert as unknown as Record<string, string>;
        // Only interrupt for urgent alerts; routine ones just update the count.
        if (a.severity && a.severity !== "high" && a.severity !== "critical") return;
        const what = a.type ?? (a.event_type ? `geofence ${a.event_type}` : "alert");
        toastId += 1;
        setToast({ id: toastId, text: `${m.vehicle_id}: ${what.replace(/_/g, " ")}${a.geofence_name ? ` · ${a.geofence_name}` : ""}` });
      }
    };

    const connect = () => {
      if (closed) return;
      setSocket(attempt === 0 ? "connecting" : "reconnecting");
      ws = api.connectLive(onMessage);
      ws.addEventListener("open", () => {
        setSocket("open");
        if (attempt > 0) { refresh(); refreshAlerts(); } // no sequence numbers: resync after a gap
        attempt = 0;
      });
      ws.addEventListener("close", () => {
        if (closed) return;
        setSocket("reconnecting");
        attempt += 1;
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
      });
      ws.addEventListener("error", () => ws?.close());
    };

    refresh();
    refreshAlerts();
    connect();
    return () => { closed = true; clearTimeout(timer); ws?.close(); };
  }, [refresh, refreshAlerts]);

  const value = useMemo<LiveCtx>(() => ({
    vehicles: Array.from(byId.values()),
    loading, error, socket, lastMessageAt, openAlerts,
    alertVehicleIds: new Set(openAlerts.filter((a) => a.severity === "high" || a.severity === "critical").map((a) => a.vehicle_id)),
    toast, refresh, refreshAlerts,
  }), [byId, loading, error, socket, lastMessageAt, openAlerts, toast, refresh, refreshAlerts]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
