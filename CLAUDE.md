# CLAUDE.md — プロジェクト状態と設計メモ

slidegen ＝ DSL から **編集可能な PowerPoint(.pptx)** を生成する純Python ライブラリ。
本ブランチでは、それを **AIで壁打ちしてスライドを作る Web アプリ**化し、
**Cloudflare 無料枠だけ**で動く構成を追加した。

## 現在の状態（2026-06）
- 実装・検証は完了。**残るは実デプロイ（Cloudflare アカウント所有者の操作）のみ**。
- PR: #3（ブランチ `claude/cloudflare-fullstack-free-3817ja` → `main`）。
- 検証状況:
  - Python 105 passed / gateway vitest 20（API E2E 7 含む）/ frontend vitest 21、各 tsc clean・build 成功。
  - **STEP0（ブラウザ相当 Pyodide での pptx 生成）実機検証済み**（Node の Pyodide 0.28.3、
    `tools/pyodide_spike.mjs`）。render / 会社テンプレ / 構成プレビューの3経路ともPASS。

## アーキテクチャ（全無料CF・案A）
- **重い pptx 生成(`python-pptx`)はブラウザ内 Pyodide で実行** → 無料 Worker の CPU 10ms 制限を回避。
- **gateway(Worker)は LLM 中継のみ**（I/O 中心で CPU ほぼ消費なし）。APIキーは secret に秘匿。
- 認証は **Cloudflare Access**（エッジ）＋ Worker 内 JWT 検証（`aud` 必須・フェイルクローズ）の多層防御。

```
ブラウザ(Pages, React+Vite+TS)
  ├─ ingest: 添付解析(JS: SheetJS/JSZip)
  ├─ render: Web Worker 内 Pyodide で slidegen.render_to_bytes → pptx DL
  └─ /api → gateway(Worker, Hono/TS): Access検証 → LLM中継(Gemini/OpenRouter/Workers AI/本番)
```

## ディレクトリ
- `slidegen/` … 既存ライブラリ（**不変**）。chart は `render_charts.py`(複数形)が正
  （`bar_chart`/`line_chart`/`stacked_bar`/`stacked_100_bar`/`bar_horizontal`/`clustered_bar`、
  DSL は `categories` + `col` + 数値行）。
- `gateway/` … Hono/TS Worker。`providers.ts`(LLM抽象/async fetch), `auth.ts`(Access JWT),
  `stream.ts`(SSE正規化), `ratelimit.ts`, `index.ts`(ルート/CORS/入力上限/レート制限)。`test/`=vitest。
- `frontend/` … React+Vite+TS。`App.tsx`(フェーズ駆動), `prompts.ts`/`phases.ts`(agent移植),
  `ingest.ts`(動的import), `render/`(Pyodide worker クライアント), `md.ts`, `storage.ts`,
  `public/render-worker.js`(Pyodide本体)。`test/`=vitest, `e2e/`=Playwright(オプトイン)。
- `tools/build_wheel.sh` … wheel を内容ハッシュ付きディレクトリへ配置し `.env.local` に URL を出力。
- `tools/pyodide_spike.mjs` … STEP0 関門（要 CDN 到達 or オフライン dist）。
- `tests/test_chart_dsl.py` … prompts↔renderer の chart 型一致・全 examples parse/render を CI ガード。
- `docs/deployment.md` … デプロイ/ローカル開発/機能制約/セキュリティ/可搬性。

## ローカル開発（要点）
詳細は `docs/deployment.md`。
```bash
bash tools/build_wheel.sh
cd gateway && npm i && cp .dev.vars.example .dev.vars && npx wrangler dev     # :8787
cd frontend && npm i && npm run dev                                          # :5173
```
- ローカルは `gateway/wrangler.toml` の `DEV_BYPASS_AUTH="1"` で認証バイパス（本番は `"0"`）。
- シークレットは `gateway/.dev.vars`（gitignore 済み）。

## 重要な設計上の制約・注意
- micropip は wheel の **basename をファイル名解釈**する → 配信URLは正規名
  `slidegen-0.1.0-py3-none-any.whl`（ハッシュは親ディレクトリ名に持たせる）。
- 構成プレビューは **画素サムネイルではない**（pptx→画像はブラウザ単体で不可）。
- 会社テンプレ(.potx/.pptx)は `slide_layouts[6]` 前提と合わないと失敗しうる（エラー表示でフォールバック）。
- 可搬性: render=純Python(ホスト非依存)、gateway=Hono(Node/Bun/Deno可)。CF固有は
  `auth(Access)` と `providers.workers_ai` の2点に局所化。移植時は workers_ai を catalog から外す。

## 次にやること
1. **実デプロイ**（`docs/deployment.md`）: wheel→gateway(`wrangler deploy`)→frontend(`pages deploy`)→Access(AUD設定)。
2. PR #3 のマージ。
3. 任意: 本物サムネイル（サーバ側 LibreOffice 設計）、テンプレの IndexedDB 永続化、i18n。
