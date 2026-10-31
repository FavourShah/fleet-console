import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev: proxy /api (incl. the WebSocket) to the backend so cookies stay same-origin.
// Override with VITE_API_TARGET, e.g. http://localhost:8081 or the mock (http://localhost:8787).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_TARGET || "https://fleet-demo.165-232-96-216.sslip.io";
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target, changeOrigin: true, ws: true, secure: true,
          // The backend checks the WebSocket Origin (WS_ALLOWED_ORIGINS); present the target's own origin.
          configure: (proxy) => {
            proxy.on("proxyReqWs", (proxyReq) => proxyReq.setHeader("origin", target));
          },
        },
      },
    },
  };
});
