import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    try {
      const u = await login(email.trim(), password);
      // Security reviews incidents first; everyone else starts on the map.
      navigate(u.role === "security" ? "/alerts" : "/", { replace: true });
    }
    catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429 ? "Too many attempts. Wait a minute and try again." :
          err.status === 401 ? "Wrong email or password." : err.message);
      } else setError("Can't reach the server. Check your connection, or that the backend is switched on.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-full md:grid-cols-[1fr_28rem]">
      <div className="hidden flex-col justify-between bg-chrome p-10 text-white md:flex">
        <div className="flex items-center gap-2">
          <span className="plate" style={{ ["--c" as string]: "#0b5fff" }}><i /><b>FLEET</b></span>
          <span className="font-display text-xl font-semibold tracking-wide">Console</span>
        </div>
        <div className="max-w-md">
          <p className="font-display text-5xl font-semibold leading-[1.05]">Every truck, every trip, every alert.</p>
          <p className="mt-4 text-slate-300">Live positions, dispatch and incident review for your fleet, in one place.</p>
        </div>
        <div aria-hidden />
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="text-sm text-ink-2">Use the account your administrator gave you.</p>
          </div>
          {error && <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</div>}
          <label className="block"><span className="label">Email</span>
            <input className="input" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block"><span className="label">Password</span>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
