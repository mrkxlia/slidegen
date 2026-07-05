# E2E (Playwright) — オプトイン

ユニット/結合テスト（`npm test` = vitest）とは別ランナー。CI を軽く保つため
Playwright は既定の devDependencies に含めていない。実行する場合のみ導入する。

```bash
cd frontend
npm i -D @playwright/test
npx playwright install chromium
npm run test:e2e        # package.json の "test:e2e": "playwright test" を使用（追加済み）
```

- `smoke.spec.ts` は gateway を route mock するため **LLM キー/認証なし**で動く。
- pptx 生成（Pyodide）は CDN 到達が必要なため、本 smoke では DSL エディタ表示までを検証し、
  実生成はカバーしない（実生成の関門は `tools/pyodide_spike.mjs` で別途検証済み）。
