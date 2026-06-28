import { test, expect, type Route } from "@playwright/test";

// gateway を route mock し、LLM/認証なしで UI フローを検証する。
// pptx 生成(Pyodide/CDN)には依存しない（DSL 編集が出るところまで）。
async function mockGateway(route: Route) {
  const url = route.request().url();
  if (url.includes("/api/models")) {
    return route.fulfill({ json: { models: [{ id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (無料)", tier: "free" }] } });
  }
  if (url.includes("/api/chat")) {
    // ストリーミング(SSE)応答をモック。生成時は DSL 本体を返す。
    const body =
      'data: {"delta":"slide title\\n  headline \\"テスト\\""}\n\n' +
      'data: {"done":true,"provider":"gemini","model":"gemini-3.1-flash-lite"}\n\n';
    return route.fulfill({ headers: { "Content-Type": "text/event-stream" }, body });
  }
  return route.continue();
}

test("壁打ち→生成でDSLエディタが表示される", async ({ page }) => {
  await page.route("**/api/**", mockGateway);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /slidegen/ })).toBeVisible();

  // 手動進行: 1メッセージ送信後、「今ある情報で生成」を押して DSL フェーズへ。
  await page.getByPlaceholder(/作りたいスライド/).fill("テスト資料を作りたい");
  await page.getByRole("button", { name: /送信/ }).click();
  await page.getByRole("button", { name: /今ある情報で生成/ }).click();

  // DSL フェーズ。生成・プレビューボタンが出る。
  await expect(page.getByRole("button", { name: /PowerPointを生成/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /構成プレビュー/ })).toBeVisible();
});
