# slidegen Web — デプロイ / 運用ガイド（Cloudflare 無料枠）

AIで壁打ちしながら **編集可能な PowerPoint** を作る Web アプリを、Cloudflare の
無料枠だけで動かすための手順。**Cloudflare Pages 一本**（静的フロント ＋ `/api` を担う
Pages Functions）＋ Cloudflare Access。

> 設計判断の背景は [ADR 0001（同一オリジン Pages Functions）](adr/0001-same-origin-pages-functions.md)
> と [ADR 0002（uv 統一）](adr/0002-uv-for-python-packaging.md) を参照。

## 全体構成

| 層 | 実体 | 無料枠 | 役割 |
|---|---|---|---|
| フロント | `frontend/`（React+Vite+TS）→ Cloudflare **Pages** | ◯ | UI ＋ **ブラウザ内Pyodideでpptx生成** |
| API | `frontend/functions/api/*`（= `gateway/` の Hono を Pages Functions 化）| ◯ | 認証付き **LLM中継**（鍵を秘匿） |
| 認証 | **Cloudflare Access**（Zero Trust、Pages プロジェクトに付与） | ◯(〜50人) | 本人のみ通す |
| LLM(テスト) | Gemini / OpenRouter / Workers AI | ◯ | 無料枠で開発 |
| LLM(本番) | OpenAI / Anthropic 等 | 従量 | secret 設定時のみ有効化 |

**設計のキモ**:
1. 重いpptx生成(`python-pptx`)はブラウザの Pyodide で実行 → 無料枠の **CPU 制限を一切受けない**。
2. LLM 中継は **Pages Functions** として静的配信と**同一オリジン**で提供 → Access の Cookie /
   `Cf-Access-Jwt-Assertion` が `/api` にも届き、`gateway/src/auth.ts` がそのまま機能する
   （独立 Worker のクロスオリジンでは Cookie が届かず認証不成立。詳細は ADR 0001）。

```
Cloudflare Pages（単一オリジン）
  ├─ 静的(dist): React UI ＋ Web Worker 内 Pyodide で slidegen.render_to_bytes → pptx DL
  └─ functions/api/[[path]].ts → gateway/src/pages(handle(app))
        = Hono ゲートウェイ: Access検証 → LLM中継(Gemini/OpenRouter/Workers AI/本番)
```

---

## 0. 前提
- Cloudflare アカウント（無料）、Node 20+、**uv**（Python は uv が管理）。
- `wrangler` は `npx wrangler`（frontend の devDependency に固定）で使用。
- リポジトリを clone 済み。`wrangler login` 済み（アカウント単位でグローバル保存）。

## 1. STEP0 関門（最初に必ず）
ブラウザ相当でpptx生成が通るか検証する（CDN到達が必要）。
```bash
bash tools/build_wheel.sh          # uv build で wheel 化（hash付きdir + frontend/.env.local）
cd tools && npm i pyodide@0.28.3 && node pyodide_spike.mjs
# → "✔ STEP0 PASS: ... slides" が出れば合格
```
> ✅ 検証済み: Node 上の Pyodide 0.28.3 で render_to_bytes でき、45KB / 4枚の pptx を生成
> （python-pptx + XlsxWriter は PyPI、lxml + Pillow は Pyodide から解決）。ブラウザでも同一パッケージ群。
> 注: micropip は wheel の basename をファイル名解釈するため、配信URLは正規名
> `…/slidegen-0.1.0-py3-none-any.whl`（ハッシュは親ディレクトリ名）であること。`build_wheel.sh` が担保。

## 2. Pages 設定（bindings / vars）
`frontend/wrangler.toml` を確認・編集する（コミット対象。秘密は置かない）:
- `[ai] binding = "AI"` … Workers AI（Pages Functions でも利用可）。
- `ALLOWED_ORIGIN` … 実際の Pages URL（同一オリジンなので CORS 判定には実質効かないが Hono cors に渡る）。
- `ACCESS_TEAM_DOMAIN` … 例 `myteam`（→ `https://myteam.cloudflareaccess.com`）。手順4で設定。
- `ACCESS_AUD` … 手順4で発行される Application Audience(AUD)。**未設定だと auth はフェイルクローズ（全リクエスト500）**。
- `DEV_BYPASS_AUTH` は **`wrangler.toml` には置かない**（本番デプロイ設定にバイパスが紛れ込む事故を防ぐため）。
  ローカル開発は `gateway/.dev.vars` 側でのみ `DEV_BYPASS_AUTH=1` を設定する。
- レート制限を複数isolate横断にするなら KV を作成し `[[kv_namespaces]]` を有効化:
  `npx wrangler kv namespace create RL`

## 3. デプロイ（Cloudflare Pages 一本）
LLM 中継(Functions)のバンドルは `gateway/src` 由来の hono/jose を **`gateway/node_modules`** から
解決する。手元では Phase A で `gateway && npm i` 済みなら OK（CI/CD は deploy job で `gateway` も `npm ci`）。
```bash
# wheel を frontend/public/wheels/<hash>/ へ配置
bash tools/build_wheel.sh

cd frontend
npm install
npm run build                                          # dist/ 生成（functions/ は別途自動検出）
npx wrangler pages project create slidegen 2>/dev/null || true   # 初回のみ
npx wrangler pages deploy dist --project-name slidegen # → https://slidegen.pages.dev（URL 控える）

# LLM キーは Pages プロジェクトの secret として投入（使うものだけ）
npx wrangler pages secret put GEMINI_API_KEY --project-name slidegen
npx wrangler pages secret put OPENROUTER_API_KEY --project-name slidegen
# 本番を使うなら:
# npx wrangler pages secret put OPENAI_API_KEY --project-name slidegen
# npx wrangler pages secret put ANTHROPIC_API_KEY --project-name slidegen
```
> `functions/api/[[path]].ts` は `wrangler pages deploy` 実行時に cwd(frontend) 直下から自動検出され、
> `/api/*` を担う。`dist` 内に置く必要はない。Pages プロジェクト名はグローバル一意のため、
> `slidegen` が取得済みなら別名になり、`ALLOWED_ORIGIN`・Access 対象・`wrangler.toml` を実 URL に合わせる。

## 4. 認証（Cloudflare Access を Pages プロジェクトに付与）
Zero Trust ダッシュボード → Access → Applications：
1. **アプリ追加**（Pages 連携 or Self-hosted）。ドメインに **`slidegen.pages.dev`** を指定
   （プレビューURLも保護するなら `*.slidegen.pages.dev`）。静的も `/api`(Function) も同一ホストなので**1アプリで両方保護**。
2. ポリシー：**Emails = 自分のアドレスのみ Allow**（Google等のIdPでログイン）。
3. 発行された **Application Audience (AUD)** と **チーム名** を控える。
4. `frontend/wrangler.toml` の `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` を設定して再デプロイ:
   ```bash
   cd frontend && npm run build && npx wrangler pages deploy dist --project-name slidegen
   ```

## 5. 動作確認
- ブラウザで Pages URL → Access ログイン → 壁打ち→流れ→DSL→「生成」でpptxがDLされる。
- 初回はPyodideロードに数秒（以後キャッシュ）。`/api/models` に secret 設定済みモデルが出る。
- 未ログイン・別経路では Access に遮断されることを確認。

## 6. CD（git push → 自動デプロイ、main 限定）
`.github/workflows/ci.yml` の `deploy` job が **main への push 時のみ**（`build-and-test` 成功後）
`wrangler pages deploy` を実行する。必要な **GitHub Secrets**:
- `CLOUDFLARE_API_TOKEN` … スコープ: Account › Cloudflare Pages:Edit（KV 利用時 Workers KV Storage:Edit、
  Workers AI 利用時 Workers AI:Read）。CI ではローカル OAuth を使えないため専用トークン必須。
- `CLOUDFLARE_ACCOUNT_ID` … 対象アカウントの ID。

LLM 秘密(`GEMINI_API_KEY` 等)は **CI に入れない**。手順3の Pages secret として保持され `pages deploy` で消えない。
`ACCESS_AUD`/vars は追跡 `wrangler.toml` から反映される。初回のプロジェクト作成・secret 投入・Access 設定は
手動（手順3〜4）。CD は2回目以降の更新用。任意で `workflow_dispatch` 併用や GitHub Environments 承認ゲートを足すと誤デプロイ防止になる。

---

## ローカル開発（PC でクローン後）
前提: Node 20+ / uv / `npx wrangler`。ローカルは gateway を独立 `wrangler dev`(:8787) で起動し、
vite proxy(`/api`→:8787) でブラウザから見て同一オリジンにする（Pages Functions 化は本番配信用の薄いシムで、
ローカル dev/test には不要）。
```bash
# wheel 生成（frontend/public/wheels/<hash>/ と frontend/.env.local を作る）
bash tools/build_wheel.sh        # uv build

# ターミナルA: gateway（:8787）
cd gateway && npm i
cp .dev.vars.example .dev.vars   # GEMINI_API_KEY 等を記入
printf '\nDEV_BYPASS_AUTH=1\n' >> .dev.vars   # 認証バイパスは .dev.vars(gitignore) 側で。wrangler.toml には置かない
npx wrangler dev

# ターミナルB: frontend（:5173 → /api を :8787 へ proxy）
cd frontend && npm i && npm run dev
```
ローカルの要点:
- 認証バイパスは **`gateway/.dev.vars` の `DEV_BYPASS_AUTH=1`**（追跡ファイルを汚さない）。
  `wrangler.toml`（本番・ローカル dev 共通設定ファイル）には置かない。
- `wrangler dev` のシークレットは `gateway/.dev.vars`（gitignore 済み）。Gemini/OpenRouter が確実
  （`env.AI`=Workers AI はローカルで使えないことがある）。
- 初回 pptx 生成は Pyodide ロードに数秒（要ネット、以後キャッシュ）。

テスト:
```bash
uv run --extra dev pytest tests/ -q        # 本体 + chart-DSL ガード（uv が slidegen を導入）
cd gateway && npm test                     # vitest（API E2E 含む）
cd frontend && npm test                    # vitest（e2e/ は対象外）
cd frontend && npm run typecheck:functions # Pages Functions 専用 tsconfig の型検査
```

## 機能と制約（追加分）
- **会社テンプレート(.potx/.pptx)**: サイドバーから添付すると、それを土台に生成
  （`render_to_bytes(dsl, template=…)`）。ブラウザ FS に書き込んで Pyodide へ渡す。
  注: テンプレ側のレイアウト構成によっては `slide_layouts[6]` 前提と合わず生成に失敗しうる
  （その場合はエラー表示・テンプレ解除で既定生成にフォールバック）。
- **構成プレビュー**: DSL をパースし各スライドを型・主張・要素のカードで一覧表示。
  **pptx の画素レンダリング（サムネイル画像）ではない**（pptx→画像はブラウザ単体で不可。無料CFでは
  サーバ側 LibreOffice 等が要るため非対応）。
- **設定の永続化**: モデル選択・目的を localStorage に保存し次回復元（`storage.ts`）。
  添付/テンプレートのバイナリは保存しない（容量・プライバシーのためセッション限り）。
- **E2E(Playwright)**: `frontend/e2e/`（オプトイン）。gateway を route mock して UI フローを検証。

## セキュリティ要点
- API キーは **Pages secret のみ**。フロント・リポジトリ・会話履歴に出さない。
- 多層防御：Access(エッジ) ＋ ゲートウェイ内 JWT 検証（`aud` 完全一致・フェイルクローズ）。
  Pages に Access を付けるため `/api/*` も `/api/health` もエッジで認証必須（health の app 層免除はエッジでは効かない）。
- 入力サイズ上限とレート制限をサーバ側で強制（Cookie流出時の本番キー暴走課金を抑止）。
- LLM呼び出し先URLは `providers.ts` 内に固定（フロントからURLを受けない＝SSRF回避）。

## 可搬性（Cloudflare 以外へ）
- **pptx生成**はブラウザ内の純Python slidegen＝ホスト非依存（任意の静的ホストで動く）。
- **ゲートウェイ**は Hono＝Node/Bun/Deno へ移植可。CF 固有は `auth(Access)`、`providers.workers_ai`、
  Pages Functions アダプタ(`gateway/src/pages.ts`)の3点に局所化。移植時は workers_ai を catalog から外し、
  認証を自前 IdP(OIDC) に差し替え、**静的配信側にも認証ゲート**（Access はフロント到達制御も兼ねる）と
  SPA ルートガード/401処理を用意する。
- 独自ドメインを Cloudflare に登録すれば、Pages Functions ではなく「カスタムドメインに独立 Worker を
  `/api/*` ルート」でも同一オリジン化できる（その場合は ADR 0001 を Superseded として更新）。
- フロントの API 先は `VITE_API_BASE` で切替（既定は空＝同一オリジン `/api`）。
