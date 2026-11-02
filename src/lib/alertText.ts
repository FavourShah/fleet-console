import type { Alert } from "./api-types";

const num = (v: unknown): number | undefined => (typeof v === "number" && isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

function duration(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** One plain sentence for an alert: vehicle, what happened, with detail only when the evidence has it. */
export function alertSummary(a: Alert): string {
  const ev = a.evidence ?? {};
  const zone = str(ev.geofence_name) ?? str(ev.zone);
  switch (a.type) {
    case "geofence_exit": return `${a.plate} left ${zone ?? "a zone"}`;
    case "geofence_enter": return `${a.plate} entered ${zone ?? "a zone"}`;
    case "route_deviation": {
      const m = num(ev.deviation_m);
      return `${a.plate} is off its planned route${m ? ` by ${m >= 1000 ? (m / 1000).toFixed(1) + " km" : Math.round(m) + " m"}` : ""}`;
    }
    case "idle": {
      const s = num(ev.duration_s) ?? (num(ev.duration_min) ? num(ev.duration_min)! * 60 : undefined);
      return `${a.plate} has been idle${s ? ` for ${duration(s)}` : ""}`;
    }
    case "speeding": {
      const sp = num(ev.speed_kph), lim = num(ev.limit_kph);
      return `${a.plate} was speeding${sp ? ` at ${Math.round(sp)} km/h` : ""}${lim ? ` (limit ${Math.round(lim)})` : ""}`;
    }
    case "device_offline": return `${a.plate}'s tracker stopped reporting`;
    case "unplanned_trip": return `${a.plate} is moving without a planned trip`;
    default: return `${a.plate}: ${String(a.type).replace(/_/g, " ")}`;
  }
}

/** Suggested next step, so the list answers "what do I do?". */
export function alertNextStep(a: Alert): string {
  switch (a.type) {
    case "geofence_exit": return a.trip_id ? "Check the trip is on schedule, then acknowledge." : "No trip is linked. Call the driver or replay the last 30 minutes.";
    case "geofence_enter": return "Usually routine. Acknowledge if expected.";
    case "route_deviation": return "Replay the last 30 minutes and contact the driver.";
    case "idle": return "Check whether the stop is planned.";
    case "speeding": return "Review with the driver.";
    case "device_offline": return "Check the tracker power and SIM. The truck may still be moving.";
    case "unplanned_trip": return "Confirm with the driver or create a trip.";
    default: return "Review the details and acknowledge.";
  }
}

export const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 } as const;
