# slidegen Web — デプロイ / 運用ガイド（Cloudflare 無料枠）

AIで壁打ちしながら **編集可能な PowerPoint** を作る Web アプリを、Cloudflare の
無料枠だけで動かすための手順。フロント(Pages)＋ゲートウェイ(Workers)＋認証(Access)。

## 全体構成

| 層 | 実体 | 無料枠 | 役割 |
|---|---|---|---|
| フロント | `frontend/`（React+Vite+TS）→ Cloudflare **Pages** | ◯ | UI ＋ **ブラウザ内Pyodideでpptx生成** |
| API | `gateway/`（Hono / TS）→ Cloudflare **Workers** | ◯ | 認証付き **LLM中継**（鍵を秘匿） |
| 認証 | **Cloudflare Access**（Zero Trust） | ◯(〜50人) | 本人のみ通す |
| LLM(テスト) | Gemini / OpenRouter / Workers AI | ◯ | 無料枠で開発 |
| LLM(本番) | OpenAI / Anthropic 等 | 従量 | secret 設定時のみ有効化 |

**設計のキモ**: 重いpptx生成(`python-pptx`)はブラウザのPyodideで実行するため、
無料Workerの **CPU 10ms 制限**を一切受けない。Workerはネットワーク中継のみ。

---

## 0. 前提
- Cloudflare アカウント（無料）、`npm i -g wrangler`、Node 20+、Python 3.10+。
- リポジトリを clone 済み。

## 1. STEP0 関門（最初に必ず）
ブラウザ相当でpptx生成が通るか検証する（CDN到達が必要）。
```bash
bash tools/build_wheel.sh          # slidegen を wheel 化（hash付きdir + .env.local）
cd tools && npm i pyodide@0.28.3 && node pyodide_spike.mjs
# → "✔ STEP0 PASS: ... slides" が出れば合格
```
> ✅ 検証済み: Node 上の Pyodide 0.28.3 で `charts_frameworks_demo.slide` が
> render_to_bytes でき、45KB / 4枚の pptx を生成（python-pptx 1.0.2 + XlsxWriter は
> PyPI、lxml 6.0.0 + Pillow 11.3.0 は Pyodide から解決）。ブラウザでも同一パッケージ群。
> 注: micropip は wheel の basename をファイル名として解釈するため、配信URLは必ず
> `…/slidegen-0.1.0-py3-none-any.whl`（正規名）であること（本リポジトリの hash付き
> ディレクトリ配信はこれを満たす）。

## 2. ゲートウェイ（Workers）
```bash
cd gateway && npm install
# 無料LLMキーを secret 投入（使うものだけ）
wrangler secret put GEMINI_API_KEY
wrangler secret put OPENROUTER_API_KEY
# Workers AI はバインディング(env.AI)で鍵不要（wrangler.toml の [ai]）
# 本番を使うなら:
# wrangler secret put OPENAI_API_KEY
# wrangler secret put ANTHROPIC_API_KEY

# レート制限を複数isolate横断にするなら KV を作成し wrangler.toml の [[kv_namespaces]] を有効化:
# wrangler kv namespace create RL
```
`wrangler.toml` の `vars` を設定：
- `ALLOWED_ORIGIN` … Pages の本番URL（例 `https://slidegen.pages.dev`）
- `ACCESS_TEAM_DOMAIN` … 例 `myteam`（→ `https://myteam.cloudflareaccess.com`）
- `ACCESS_AUD` … 手順4で発行される Application Audience(AUD) タグ
  - **未設定だと auth はフェイルクローズ（全リクエスト500）**。本番では必ず設定。

```bash
wrangler deploy            # → https://slidegen-gateway.<acct>.workers.dev
```

## 3. フロント（Pages）
```bash
cd frontend && npm install
bash ../tools/build_wheel.sh          # public/wheels/<hash>/ に wheel を再配置
# 本番の API ベースを指すなら frontend/.env を編集（同一オリジンに揃えるなら空でOK）
npm run build                          # dist/ を生成
wrangler pages deploy dist --project-name slidegen
```
> Pages と Worker を**同一オリジン**に揃える（Pages のカスタムドメインに Worker を
> `/api/*` ルートでマウント）と CORS とCookie伝播が最も簡単。別オリジンなら
> `ALLOWED_ORIGIN` と `VITE_API_BASE` を正しく設定する。

## 4. 認証（Cloudflare Access）
Zero Trust ダッシュボード → Access → Applications：
1. **Self-hosted** アプリを作成し、ドメインに Pages（と `/api/*` の Worker ルート）を含める。
2. ポリシー：**Emails = 自分のアドレスのみ Allow**（Google等のIdPでログイン）。
3. 発行された **Application Audience (AUD)** を `gateway` の `ACCESS_AUD` に設定して再デプロイ。
   - Worker も Access アプリ配下に入れることで、`*.workers.dev` 直叩きをネットワークでも遮断。

## 5. 動作確認
- ブラウザで Pages URL → Access ログイン → 壁打ち→流れ→DSL→「生成」でpptxがDLされる。
- 初回はPyodideロードに数秒（以後キャッシュ）。`/api/models` に secret 設定済みモデルが出る。

---

## セキュリティ要点
- API キーは **Worker secret のみ**。フロント・リポジトリ・会話履歴に出さない。
- 多層防御：Access(エッジ) ＋ Worker内 JWT 検証（`aud` 完全一致・フェイルクローズ）。
- Worker側で **入力サイズ上限**と**レート制限**を強制（Cookie流出時の本番キー暴走課金を抑止）。
- LLM呼び出し先URLは `providers.ts` 内に固定（フロントからURLを受けない＝SSRF回避）。

## 可搬性（Cloudflare 以外へ）
- **pptx生成**はブラウザ内の純Python slidegen＝ホスト非依存（任意の静的ホストで動く）。
- **ゲートウェイ**は Hono＝Node/Bun/Deno へ移植可。`npm run dev` 相当を各ランタイムで起動。
  - 移植時は `providers.ts` の `workers_ai` を catalog から外し Gemini/OpenRouter に倒す
    （Workers AI は CF アカウント依存）。
  - 認証は `auth.ts` を自前 IdP(OIDC) に差し替え。**加えて静的配信側にも認証ゲート**
    （Access はフロント到達制御も兼ねるため）と SPA ルートガード/401処理が必要。
- フロントの API 先は `VITE_API_BASE` で切替。
