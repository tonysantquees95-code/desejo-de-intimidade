import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "publico",
  build: {
    outDir: "dist",
    assetsDir: "_assets",
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: { external: ["cloudflare:workers"] },
  },
});
