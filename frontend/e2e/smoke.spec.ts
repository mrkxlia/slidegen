import { test, expect, type Route } from "@playwright/test";

// gateway を route mock し、LLM/認証なしで UI フローを検証する。
// pptx 生成/構成プレビュー(Pyodide/CDN)には依存しない（DSL がデッキに入るところまで）。
async function mockGateway(route: Route) {
  const url = route.request().url();
  if (url.includes("/api/models")) {
    return route.fulfill({ json: { models: [{ id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (無料)", tier: "free" }] } });
  }
  if (url.includes("/api/chat")) {
    // DSL生成プロンプト("それだけ"を含む)には DSL を、壁打ちには会話文を返す。
    const isGen = (route.request().postData() || "").includes("それだけ");
    const body =
      "data: " + JSON.stringify({ delta: isGen ? 'slide title\n  headline "テスト"' : "どんな目的のスライドですか？" }) + "\n\n" +
      "data: " + JSON.stringify({ done: true, provider: "gemini", model: "gemini-3.1-flash-lite" }) + "\n\n";
    return route.fulfill({ headers: { "Content-Type": "text/event-stream" }, body });
  }
  return route.continue();
}

test("壁打ち→生成でデッキにDSLが入る（会話起点ワークスペース）", async ({ page }) => {
  await page.route("**/api/**", mockGateway);
  await page.goto("/");

  // オンボーディング（会話ペイン）が出る。
  const composer = page.getByPlaceholder(/作りたいスライド/);
  await expect(composer).toBeVisible();

  // 1メッセージ送信 → 「今ある情報で生成」でデッキを生成。
  await composer.fill("テスト資料を作りたい");
  await page.getByRole("button", { name: /送信/ }).click();
  await page.getByRole("button", { name: /今ある情報で生成/ }).click();

  // デッキに「PowerPoint を生成・DL」が出る（Pyodide 不要）。
  await expect(page.getByRole("button", { name: /PowerPoint を生成/ })).toBeVisible({ timeout: 15_000 });

  // DSL タブ（role=tab）に生成結果が反映される。
  await page.getByRole("tab", { name: "DSL", exact: true }).click();
  await expect(page.locator("textarea.dsl-editor")).toHaveValue(/slide title/);
});
