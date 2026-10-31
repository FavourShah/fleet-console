import { useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAsync } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { Empty, ErrorState, Field, Loading, Modal, PageHeader, Pill } from "../components/ui";
import type { Driver } from "../lib/api-types";

export default function Drivers() {
  const { can } = useAuth();
  const list = useAsync(() => api.drivers(), []);
  const [edit, setEdit] = useState<Driver | "new">();
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Drivers">{can("mutate") && <button className="btn btn-primary" onClick={() => setEdit("new")}>New driver</button>}</PageHeader>
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Loading /> :
          !list.data?.data.length ? <Empty text="No drivers yet." /> : (
          <table className="w-full"><thead><tr>{["Name", "Phone", "Licence", "Status", "Vehicles"].map((h) => <th key={h} className="th">{h}</th>)}<th className="th" /></tr></thead>
            <tbody>{list.data.data.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50"><td className="td font-semibold">{d.name}</td><td className="td">{d.phone || "—"}</td><td className="td">{d.licence || "—"}</td>
                <td className="td"><Pill tone={d.status === "active" ? "ok" : "neutral"}>{d.status === "active" ? "Active" : "Inactive"}</Pill></td><td className="td num">{d.vehicles}</td>
                <td className="td text-right">{can("mutate") && <button className="btn" onClick={() => setEdit(d)}>Edit</button>}</td></tr>))}</tbody></table>)}
      </div>
      {edit && <DriverForm d={edit === "new" ? undefined : edit} onClose={() => setEdit(undefined)} onDone={() => { setEdit(undefined); list.reload(); }} />}
    </div>
  );
}

function DriverForm({ d, onClose, onDone }: { d?: Driver; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(d?.name ?? ""); const [phone, setPhone] = useState(d?.phone ?? ""); const [licence, setLicence] = useState(d?.licence ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(d?.status ?? "active");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();
  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(undefined);
    try {
      if (d) await api.updateDriver(d.id, { name: name.trim(), phone, licence, status });
      else await api.createDriver({ name: name.trim(), phone, licence });
      onDone();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return (
    <Modal title={d ? "Edit driver" : "New driver"} onClose={onClose}>
      {err && <ErrorState message={err} />}
      <div className="space-y-3">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Phone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Licence"><input className="input" value={licence} onChange={(e) => setLicence(e.target.value)} /></Field>
        {d && <Field label="Status"><select className="input" value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
    </Modal>
  );
}
