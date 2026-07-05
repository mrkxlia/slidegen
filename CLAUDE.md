# CLAUDE.md — プロジェクト状態と設計メモ

slidegen ＝ DSL から **編集可能な PowerPoint(.pptx)** を生成する純Python ライブラリ。
本ブランチでは、それを **AIで壁打ちしてスライドを作る Web アプリ**化し、
**Cloudflare 無料枠だけ**で動く構成を追加した。

## 現在の状態（2026-07）
- 実装・検証完了し、**Cloudflare 無料枠で稼働中**（デプロイ／CD 済み。手順は `docs/deployment.md`、CD は `.github/workflows/ci.yml` の deploy job）。
- 要件/仕様は [requirements.md](requirements.md) / [spec.md](spec.md)。設計判断は `docs/adr/`
  （0001 同一オリジン Pages Functions、0002 uv 統一、0003 ブラウザ Pyodide 生成、0004 編集可能pptx必達、
  0005 マルチプロバイダ+SSE+フォールバック。索引は [docs/adr/README.md](docs/adr/README.md)）。
- 検証状況: Python(pytest) / gateway・frontend(vitest) / 各 tsc（functions 専用 tsconfig 含む）/ build いずれも
  green（テスト総数は増減するため本ファイルには書かない。実数は CI 実行結果を参照）。Pages Functions バンドルも実機で成功。
  **STEP0（ブラウザ相当 Pyodide での pptx 生成）実機検証済み**（Node の Pyodide 0.28.3、
  `tools/pyodide_spike.mjs`）。render / 会社テンプレ / 構成プレビューの3経路ともPASS。
- 直近の主な変更: モデルカタログ 2026-07 棚卸し（PR #20）／既存 pptx のデザイン取り込み（PR #21）／
  docs-drift の CI ガード追加（PR #22）／添付画像マルチモーダル対応（PR #23）／
  リポジトリ総点検（gateway のフェイルオープン・ストリームエラー誤判定・frontend の worker ハング・
  parser の記法乖離 等の修正、CLAUDE.md/メモリ整備、リファクタ、テスト・CI 強化）。

## アーキテクチャ（全無料CF）
- **重い pptx 生成(`python-pptx`)はブラウザ内 Pyodide で実行** → 無料枠の CPU 制限を回避。
- **LLM 中継は Pages Functions**（`frontend/functions/api/*` → `gateway` の Hono を `handle()` で委譲）。
  独立 Worker ではなく**フロントと同一オリジン**で配信する（クロスオリジンだと Access の Cookie が届かず
  認証不成立。理由は ADR 0001）。本番は **Pages 一本**に集約され、APIキーは Pages secret に秘匿。
- 認証は **Cloudflare Access**（Pages プロジェクトに付与・エッジ）＋ ゲートウェイ内 JWT 検証
  （`aud` 必須・フェイルクローズ）の多層防御。

```
Cloudflare Pages（単一オリジン, React+Vite+TS）
  ├─ ingest: 添付解析(JS: SheetJS/JSZip)
  ├─ render: Web Worker 内 Pyodide で slidegen.render_to_bytes → pptx DL
  ├─ import: 同 worker の inspect で既存 pptx を構造抽出(inspect_compact) → LLM が DSL 再構成
  └─ functions/api/[[path]].ts → gateway/src/pages(handle(app))
        = Hono ゲートウェイ: Access検証 → LLM中継(Gemini/OpenRouter/Workers AI/本番)
```

## ディレクトリ
- `slidegen/` … コアライブラリ。型は継続的に追加され現在 `RENDERERS` に**計100型**登録済みだが、
  **レンダ規約（編集可能なネイティブ要素・theme経由・登録は `register`/`register_many`）と public API は不変**。
  chart は `render_charts.py`(複数形)が正
  （`bar_chart`/`line_chart`/`stacked_bar`/`stacked_100_bar`/`bar_horizontal`/`clustered_bar`、
  DSL は `categories` + `col` + 数値行）。
- `gateway/` … Hono/TS。`providers.ts`(LLM抽象/カタログ・フォールバック・`buildGeminiPayload`),
  `stream.ts`(SSE 正規化＋全プロバイダのストリーミング = `/api/chat` の唯一の経路。**非ストリームは廃止**),
  `auth.ts`(Access JWT), `ratelimit.ts`, `index.ts`(ルート/CORS/入力上限/レート制限・SSE専用),
  **`pages.ts`(Pages Functions アダプタ: `handle(app)`)**。`test/`=vitest。ロジックは本番でも無改変で再利用。
- `frontend/` … React+Vite+TS。`App.tsx`(フェーズ駆動), `prompts.ts`/`phases.ts`(agent移植),
  `ingest.ts`(動的import), `render/`(Pyodide worker クライアント), `md.ts`, `storage.ts`,
  `public/render-worker.js`(Pyodide本体)。`test/`=vitest, `e2e/`=Playwright(オプトイン)。
  本番配信用に **`functions/api/[[path]].ts`(gateway/src/pages を再エクスポート)**、
  **`wrangler.toml`(Pages: AI binding/vars)**、**`functions/tsconfig.json`(workers-types で個別型検査)**。
- `tools/build_wheel.sh` … `uv build` で wheel 化し内容ハッシュ付きディレクトリへ配置、`.env.local` に URL を出力。
- `tools/pyodide_spike.mjs` … STEP0 関門（要 CDN 到達 or オフライン dist）。
- `tests/test_chart_dsl.py` … prompts↔renderer の chart 型一致・全 examples parse/render を CI ガード。
- `docs/deployment.md` … デプロイ/ローカル開発/機能制約/セキュリティ/可搬性。

## ローカル開発（要点）
詳細は `docs/deployment.md`。Python は **uv に統一**（`uv build` / `uv run`、`pip`/`python -m build` は使わない。ADR 0002）。
```bash
bash tools/build_wheel.sh                 # uv build
uv run --extra dev pytest tests/ -q       # 本体テスト
cd gateway && npm i && cp .dev.vars.example .dev.vars && npx wrangler dev     # :8787
cd frontend && npm i && npm run dev                                          # :5173 (/api→:8787 proxy)
```
- ローカルは **`gateway/.dev.vars` の `DEV_BYPASS_AUTH=1`** で認証バイパス（追跡ファイルを汚さない）。
  `wrangler.toml`（本番・ローカル dev 共通設定ファイル）には置かない（誤って本番に紛れ込む事故を防ぐため）。
- シークレットは `gateway/.dev.vars`（gitignore 済み）。
- ローカルは gateway を独立 `wrangler dev` で動かす（Pages Functions 化は本番配信用の薄いシムで dev/test に不要）。

## 重要な設計上の制約・注意
- micropip は wheel の **basename をファイル名解釈**する → 配信URLは正規名
  `slidegen-0.1.0-py3-none-any.whl`（ハッシュは親ディレクトリ名に持たせる）。
- 構成プレビューは **画素サムネイルではない**（pptx→画像はブラウザ単体で不可）。
- 会社テンプレ(.potx/.pptx)は `slide_layouts[6]` 前提と合わないと失敗しうる（エラー表示でフォールバック）。
- **Pages Functions のバンドル依存**: `functions` は `gateway/src` 由来の bare import(hono/jose) を
  `gateway/node_modules` から解決する。CI/CD は frontend だけでなく **`gateway` でも `npm ci`** が必須
  （忘れると「ローカルは通るが CD だけバンドル失敗」）。型検査も functions 専用 tsconfig で分離。
- Python は **uv 統一**（`build` をランタイム依存に入れない。ADR 0002）。
- 可搬性: render=純Python(ホスト非依存)、gateway=Hono(Node/Bun/Deno可)。CF固有は
  `auth(Access)`・`providers.workers_ai`・Pages Functions アダプタ(`gateway/src/pages.ts`)の3点に局所化。

## 次にやること
- デプロイ／CD は稼働済み（`docs/deployment.md` / `.github/workflows/ci.yml` の deploy job）。
- 課題・ロードマップは [docs/backlog.md](docs/backlog.md) に集約。DSL 解説のドリフト対策は完了済み
  （`tests/test_chart_dsl.py` / `tests/test_docs_drift.py`）。残るのは例えば本物サムネイル（サーバ側
  LibreOffice）、テンプレの IndexedDB 永続化、i18n、Mermaid 連携（いずれも backlog.md #5 参照）。
- モデルカタログ（`gateway/src/providers.ts` の `CATALOG`）の棚卸し手順は [docs/model-catalog.md](docs/model-catalog.md)。
  **2026-10-16 までに gemini-2.5 系 2 モデルの削除が必要**（同 doc の「既知の期日」参照）。
