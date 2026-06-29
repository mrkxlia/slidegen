import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// ユニット/結合テストは test/ のみ。e2e/（Playwright）は別ランナーなので除外。
// グローバル環境は node のまま（既存ロジックテストの前提を変えない）。
// ビュー層テスト(.test.tsx)はファイル先頭の `// @vitest-environment jsdom` で局所的に jsdom 化する。
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
