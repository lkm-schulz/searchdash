import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the launcher passes the API port via env so /api proxies to uvicorn.
const apiPort = process.env.API_PORT ?? "8123";

/**
 * Close idle keep-alive sockets almost immediately instead of node's 5s default.
 *
 * Otherwise, after a dev-server stop/restart, the browser reuses now-dead pooled
 * sockets that still occupy its per-server connection slots, so the next page load
 * sits Blocked ~30s until they time out before retrying on a fresh connection.
 * A tiny timeout (not 0, which node treats as "never close") drops sockets between
 * requests so a restart leaves nothing stale to reuse; HMR's websocket is upgraded,
 * not a keep-alive idle socket, so it is unaffected.
 */
const closeIdleConnections: PluginOption = {
  name: "close-idle-connections",
  configureServer(server) {
    server.httpServer?.once("listening", () => {
      if (server.httpServer) server.httpServer.keepAliveTimeout = 1;
    });
  },
};

export default defineConfig({
  plugins: [react(), closeIdleConnections],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
