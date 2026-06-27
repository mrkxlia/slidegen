import { defineConfig } from "vitest/config";

// ユニット/結合テストは test/ のみ。e2e/（Playwright）は別ランナーなので除外。
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
