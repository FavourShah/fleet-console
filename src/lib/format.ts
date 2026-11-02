import type { Vehicle, AlertSeverity } from "./api-types";

export function ago(iso?: string, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function dt(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function label(s: string): string {
  return s.replace(/[_.]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export type VStatus = "moving" | "idle" | "offline" | "alert";

export function vehicleStatus(v: Vehicle, alertIds: Set<string>): VStatus {
  if (alertIds.has(v.id)) return "alert";
  if (!v.online) return "offline";
  return (v.speed_kph ?? 0) > 2 ? "moving" : "idle";
}

export const STATUS_COLOR: Record<VStatus, string> = {
  moving: "#15803d",
  idle: "#b45309",
  offline: "#6b7280",
  alert: "#c01f2f",
};

export const SEV_CLASS: Record<AlertSeverity, string> = {
  low: "bg-slate-100 text-slate-700 border-slate-300",
  medium: "bg-amber-50 text-amber-800 border-amber-300",
  high: "bg-orange-50 text-orange-800 border-orange-400",
  critical: "bg-red-50 text-red-800 border-red-400",
};

export const SEV_BAR: Record<AlertSeverity, string> = { low: "#94a3b8", medium: "#d97706", high: "#ea580c", critical: "#c01f2f" };

export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
