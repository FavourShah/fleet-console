import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    try { await login(email.trim(), password); }
    catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429 ? "Too many attempts. Wait a minute and try again." :
          err.status === 401 ? "Wrong email or password." : err.message);
      } else setError("Can't reach the server. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">Fleet Console</h1>
          <p className="text-sm text-ink-3">Sign in to continue</p>
        </div>
        {error && <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</div>}
        <label className="block"><span className="label">Email</span>
          <input className="input" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="label">Password</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
