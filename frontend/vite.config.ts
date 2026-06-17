import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pyodide はブラウザで CDN から読み込む（render-worker.js）。
// 本構成は SharedArrayBuffer 不要 = COOP/COEP ヘッダ不要。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // ローカル開発: /api を gateway(wrangler dev, 8787) へ転送
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
  build: { target: "es2022" },
});
