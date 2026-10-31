import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { Role, User } from "./api-types";

interface AuthCtx {
  user?: User;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (action: "mutate" | "ack" | "audit") => boolean;
}

const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

const PERMS: Record<"mutate" | "ack" | "audit", Role[]> = {
  mutate: ["admin", "dispatcher"],
  ack: ["admin", "dispatcher", "security"],
  audit: ["admin", "security"],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>();
  const [booting, setBooting] = useState(true);

  // Restore session (and CSRF token) on reload.
  useEffect(() => {
    api.me()
      .then((r) => setUser(r.user))
      .catch((e) => { if (!(e instanceof ApiError) || e.status !== 401) console.warn(e); })
      .finally(() => setBooting(false));
  }, []);

  // Any 401 later on drops back to login.
  useEffect(() => {
    const h = () => setUser(undefined);
    window.addEventListener("fleet:unauthorized", h);
    return () => window.removeEventListener("fleet:unauthorized", h);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* session may already be gone */ }
    setUser(undefined);
  }, []);

  const can = useCallback((a: "mutate" | "ack" | "audit") => !!user && PERMS[a].includes(user.role), [user]);

  return <Ctx.Provider value={{ user, booting, login, logout, can }}>{children}</Ctx.Provider>;
}
