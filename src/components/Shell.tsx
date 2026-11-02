import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLive } from "../lib/live";

const NAV = [
  { to: "/", label: "Map" },
  { to: "/alerts", label: "Alerts", badge: true },
  { to: "/trips", label: "Trips" },
  { to: "/playback", label: "Playback" },
  { to: "/geofences", label: "Geofences" },
  { to: "/drivers", label: "Drivers" },
  { to: "/import", label: "Import" },
  { to: "/reports", label: "Reports" },
  { to: "/system", label: "System" },
  { to: "/audit", label: "Audit", perm: "audit" as const },
];

export default function Shell({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();
  const { openAlerts, toast } = useLive();
  const [shown, setShown] = useState<typeof toast>();

  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown(undefined), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto bg-chrome px-2 py-1 md:w-48 md:flex-col md:items-stretch md:gap-0.5 md:px-2 md:py-4" aria-label="Main">
        <div className="hidden items-center gap-2 px-2 pb-4 md:flex"><span className="plate" style={{ ["--c" as string]: "#0b5fff" }}><i /><b>FLEET</b></span><span className="font-display text-lg font-semibold tracking-wide text-white">Console</span></div>
        {NAV.filter((n) => !n.perm || can(n.perm)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}
            className={({ isActive }) => `flex items-center justify-between whitespace-nowrap rounded px-2.5 py-1.5 text-sm font-medium ${isActive ? "bg-white/[0.14] font-semibold text-white" : "text-slate-300 hover:bg-white/[0.08] hover:text-white"}`}>
            {n.label}
            {n.badge && openAlerts.length > 0 && <span className="num ml-2 rounded-full bg-st-alert px-1.5 text-[11px] font-semibold text-white" aria-label={`${openAlerts.length} open alerts`}>{openAlerts.length}</span>}
          </NavLink>
        ))}
        <div className="ml-auto hidden border-t border-white/15 pt-3 text-xs md:ml-0 md:mt-auto md:block">
          <div className="px-2 font-medium text-white">{user?.name}</div>
          <div className="px-2 pb-2 text-slate-400">{user?.role}</div>
          <button className="btn w-full justify-center" onClick={logout}>Sign out</button>
        </div>
        <button className="btn ml-auto md:hidden" onClick={logout}>Sign out</button>
      </nav>
      <main className="relative min-h-0 min-w-0 flex-1">{children}</main>
      {shown && (
        <div className="fixed bottom-4 right-4 z-[3000] max-w-sm rounded border border-red-300 bg-white px-3 py-2 text-sm shadow-lg" role="status">
          <span className="mr-1 font-semibold text-st-alert">New alert</span>{shown.text}
        </div>
      )}
    </div>
  );
}
