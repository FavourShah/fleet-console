import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AlertSeverity } from "../lib/api-types";
import { SEV_CLASS, STATUS_COLOR, label, type VStatus } from "../lib/format";

export function Loading({ text = "Loading…" }: { text?: string }) {
  return <div className="p-6 text-sm text-ink-3" role="status">{text}</div>;
}
export function Empty({ text }: { text: string }) {
  return <div className="p-6 text-sm text-ink-3">{text}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 flex items-center justify-between gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function SeverityBadge({ s }: { s: AlertSeverity }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${SEV_CLASS[s]}`}>{label(s)}</span>;
}

export function StatusDot({ s }: { s: VStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} aria-hidden />
      {label(s)}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const c = { neutral: "bg-slate-100 text-slate-700", ok: "bg-green-50 text-green-800", warn: "bg-amber-50 text-amber-800", bad: "bg-red-50 text-red-800" }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-5 py-3">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel max-h-[90vh] w-full max-w-lg overflow-auto p-5" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label: l, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="label">{l}</span>{children}</label>;
}

export function Stat({ label: l, value, tone, to }: { label: string; value: ReactNode; tone?: "bad"; to?: string }) {
  const body = (
    <>
      <div className="text-xs font-medium text-ink-2">{l}</div>
      <div className={`num font-display text-2xl font-semibold leading-none ${tone === "bad" ? "text-st-alert" : ""}`}>{value}</div>
    </>
  );
  return to
    ? <Link to={to} className="block px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" title={`Open ${l.toLowerCase()}`}>{body}</Link>
    : <div className="px-3 py-1.5">{body}</div>;
}
