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
    port: 8083,
    strictPort: true,
    // Listen on all interfaces, and accept any Host header, so the dev server
    // can be used from other machines by whatever name or address reaches
    // this one. Note that allowedHosts: true turns off Vite's DNS rebinding
    // protection.
    host: true,
    allowedHosts: true,
    // RPCs (POST /xmaslist.<Service>/<Method>) go to the backend (see
    // `make run-backend`).
    proxy: {
      "/xmaslist.": {
        target: process.env.XMASLIST_BACKEND ?? "http://localhost:8082",
      },
    },
  },
});
