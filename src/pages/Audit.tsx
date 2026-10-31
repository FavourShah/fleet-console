import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { dt, label } from "../lib/format";
import { Empty, ErrorState, Loading, PageHeader } from "../components/ui";

type Row = Record<string, unknown>;
const pick = (r: Row, keys: string[]) => { for (const k of keys) if (r[k] != null && r[k] !== "") return String(r[k]); return ""; };

export default function Audit() {
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  const PAGE = 100;
  // The audit response shape isn't typed in the contract, so read it defensively.
  const list = useAsync(async () => {
    const res = await api.audit({ limit: PAGE, offset });
    return res.data ?? [];
  }, [offset]);
  const rows = (list.data ?? []).filter((r) => !action || pick(r, ["action"]).toLowerCase().includes(action.toLowerCase()));
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Audit log">
        <input className="input w-48" placeholder="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" />
        <button className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</button>
        <button className="btn" disabled={(list.data?.length ?? 0) < PAGE} onClick={() => setOffset(offset + PAGE)}>Older</button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Loading /> :
          !rows.length ? <Empty text="No audit entries." /> : (
          <table className="w-full"><thead><tr><th className="th">Time</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Entity</th></tr></thead>
            <tbody>{rows.map((r, i) => {
              const t = pick(r, ["created_at", "at", "occurred_at", "time", "timestamp"]);
              const ent = [pick(r, ["entity", "entity_type", "resource"]), pick(r, ["entity_id", "resource_id"])].filter(Boolean).join(" · ");
              return <tr key={i} className="hover:bg-slate-50"><td className="td num">{t ? dt(t) : "—"}</td><td className="td">{pick(r, ["actor", "actor_email", "user_email", "user", "email", "actor_name"]) || "—"}</td><td className="td font-medium">{label(pick(r, ["action"]) || "—")}</td><td className="td">{ent || "—"}</td></tr>;
            })}</tbody></table>)}
      </div>
    </div>
  );
}
