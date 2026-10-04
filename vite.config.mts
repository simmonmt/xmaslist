import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // The app is a single bundle
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // Envoy's dev config (docker/envoy.yaml) routes / to port 8083, and
    // connects from the Docker network, so listen on all interfaces.
    port: 8083,
    strictPort: true,
    host: true,
    // Envoy forwards the browser's Host header (e.g. myhost:8080) and its
    // health check sends "Host: frontend"; Vite's host check would 403 them.
    allowedHosts: true,
    // Envoy doesn't proxy websockets, so have the HMR client connect to the
    // dev server directly even when the page is loaded through Envoy.
    hmr: { clientPort: 8083 },
  },
});
