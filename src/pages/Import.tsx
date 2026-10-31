import { useRef, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ErrorState, PageHeader, Pill } from "../components/ui";
import type { ImportResult } from "../lib/api-types";

const HEADERS = "imei, sim_number, device_model, protocol, plate, vehicle_type, make, model, year, colour, chassis_number, depot, department, driver_name, driver_phone, driver_licence";

interface Job extends ImportResult { file: string; at: string }

export default function Import() {
  const { can } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [jobs, setJobs] = useState<Job[]>([]); // the API has no job-list endpoint, so this is this-session only
  const [current, setCurrent] = useState<Job>();

  const pick = (f?: File) => {
    setErr(undefined);
    if (f && !/\.csv$/i.test(f.name)) { setErr("Please choose a .csv file."); return; }
    setFile(f);
  };

  async function upload() {
    if (!file) return;
    setBusy(true); setErr(undefined);
    try {
      const r = await api.importVehicles(file);
      const job = { ...r, file: file.name, at: new Date().toISOString() };
      setCurrent(job); setJobs((j) => [job, ...j]); setFile(undefined);
      if (input.current) input.current.value = "";
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Import vehicles" />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
        <div className="panel p-4 text-sm">
          <div className="mb-1 font-semibold">Expected CSV headers</div>
          <code className="block break-words rounded bg-slate-100 p-2 text-xs">{HEADERS}</code>
          <p className="mt-2 text-ink-3">Only <b>imei</b> is required. Re-uploading the same file is safe.</p>
        </div>
        {!can("mutate") ? <ErrorState message="Your role can't import vehicles." /> : (
          <div className="panel p-4">
            <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center ${over ? "border-accent bg-blue-50" : "border-line"}`}>
              <p className="text-sm">Drag a CSV here, or</p>
              <button className="btn" onClick={() => input.current?.click()}>Choose file</button>
              <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="CSV file" />
              {file && <p className="num text-sm font-medium">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
            </div>
            {err && <ErrorState message={err} />}
            <div className="mt-3 flex justify-end"><button className="btn btn-primary" disabled={!file || busy} onClick={upload}>{busy ? "Uploading… large files can take a while" : "Upload"}</button></div>
          </div>
        )}
        {current && (
          <div className="panel p-4">
            <div className="mb-3 flex items-center gap-3"><h2 className="font-semibold">Result · {current.file}</h2><Pill tone={current.failed ? "warn" : "ok"}>{current.failed ? "Completed with errors" : "Completed"}</Pill></div>
            <div className="flex gap-6 text-sm"><Count l="Total" n={current.total} /><Count l="Imported" n={current.imported} /><Count l="Failed" n={current.failed} bad={current.failed > 0} /></div>
            {!!current.errors?.length && (
              <div className="mt-3 max-h-72 overflow-auto rounded border border-line">
                <table className="w-full"><thead><tr><th className="th w-20">Row</th><th className="th">Error</th></tr></thead>
                  <tbody>{current.errors.map((e, i) => <tr key={i}><td className="td num">{e.row}</td><td className="td">{e.message}</td></tr>)}</tbody></table>
              </div>)}
            {current.failed > (current.errors?.length ?? 0) && <p className="mt-2 text-xs text-ink-3">Showing the first {current.errors?.length} errors.</p>}
          </div>
        )}
        {jobs.length > 1 && (
          <div className="panel p-4"><h2 className="mb-2 font-semibold">Uploads this session</h2>
            <ul className="space-y-1 text-sm">{jobs.map((j) => <li key={j.job_id}><button className="text-accent underline" onClick={() => setCurrent(j)}>{j.file}</button> <span className="num text-ink-3">· {j.imported}/{j.total} imported · {new Date(j.at).toLocaleTimeString()}</span></li>)}</ul></div>)}
      </div>
    </div>
  );
}
function Count({ l, n, bad }: { l: string; n: number; bad?: boolean }) {
  return <div><div className="text-xs uppercase tracking-wide text-ink-3">{l}</div><div className={`num text-2xl font-semibold ${bad ? "text-st-alert" : ""}`}>{n.toLocaleString()}</div></div>;
}
