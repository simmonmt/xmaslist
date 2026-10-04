import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // The app is a single bundle (as it was under Bazel/rollup).
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      onwarn(warning, warn) {
        // google-protobuf uses eval; nothing we can fix upstream.
        if (
          warning.code === "EVAL" &&
          warning.id?.includes("google-protobuf")
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
  optimizeDeps: {
    // The generated protobuf/grpc-web code (client/gen, see `make gen`) is
    // CommonJS. It's a linked local package, which Vite doesn't pre-bundle
    // by default, so the dev server would serve it untransformed. Force it
    // through the dependency optimizer so it's converted to ESM.
    include: ["xmaslist-proto/proto/*.js"],
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
