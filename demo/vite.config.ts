import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/demo/",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/demo": {
        target: "http://127.0.0.1:17493",
        changeOrigin: true,
        timeout: 300_000,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
