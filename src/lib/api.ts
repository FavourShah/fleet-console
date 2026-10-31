import { FleetApi, ApiError } from "./api-client";

// Same-origin by default (Vite proxy in dev, reverse proxy in prod).
const fetcher: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 401 && !String(input).includes("/auth/login") && !String(input).endsWith("/me")) {
    window.dispatchEvent(new Event("fleet:unauthorized"));
  }
  return res;
};

export const api = new FleetApi(import.meta.env.VITE_API_BASE ?? "", fetcher);
export { ApiError };

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
