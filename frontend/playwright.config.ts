import { defineConfig, devices } from "@playwright/test";

// Playwright E2E（オプトイン）。実行手順は e2e/README.md を参照。
// gateway は route mock するため不要。Pyodide は CDN 到達が必要（pptx生成系のテスト時のみ）。
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:5173", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
