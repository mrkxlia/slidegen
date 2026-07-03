# slidegen 仕様書（spec）

> 本書は「**どう動くか**」を定義する。要件（なぜ/何を）は [requirements.md](requirements.md)。
> 深掘りは各 docs にリンクし、本書は**索引兼サマリ**として薄く保つ。
> 最終更新: 2026-06-28

---

## 1. DSL（記法）仕様 — `slidegen/parser.py`

- **構造**: 1行目 `slide <型>` で型宣言。インデントは**半角スペース2つ**で階層を表す。
- **プロパティ**: `key "値"`。多値は `key "v1" "v2" …` → `key` に先頭、`key_list` に全体を保持。
- **要素ブロック**: `col "タイトル" [highlight]`。配下に `ラベル "値"`（→ rows）または `"値"`（→ lines、箇条書き）。
- **区切り/コメント**: 単独行 `---` で複数スライドを分割。行頭 `#` はコメント。
- **強調**: 手段は **2つだけ** — col の `highlight` と、本文中の `{語句}`（→ accent 色＋太字）。
  座標・色・フォント・サイズは**書けない／書かない**（デザイン制約を構造的に担保）。
- **主なプロパティ**: `kicker` / `headline` / `foot` / `title` / `subtitle` / `source` / `categories` / `unit` / `columns` ほか。
- **型カタログ**: 9基底 × variant × 中身。一覧は [docs/type_catalog.md](docs/type_catalog.md)、
  網羅の**単一情報源は `slidegen/render.py` の `RENDERERS`（計 100 型）**。
- **チャート型**: 専用の型名（`bar_chart`/`line_chart`/`stacked_bar`/`stacked_100_bar`/`bar_horizontal`/`clustered_bar`）を
  slide の型に使う。`categories`（横軸）＋ `col`（=系列名）配下に**数値だけの行**。詳細は
  [docs/system_prompt.md](docs/system_prompt.md)（設計参照）／ ライブ定義は `frontend/src/prompts.ts`。

## 2. ライブラリ public API — `slidegen/api.py`

| 関数 | 返り値 | 用途 |
|---|---|---|
| `render_text(text, *, theme=DEFAULT_THEME, template=None)` | `Presentation` | python-pptx オブジェクト |
| `render_to_bytes(text, *, theme, template)` | `bytes` | メモリ完結。HTTP レスポンスにそのまま載せられる |
| `render_file(input_path, output_path, *, theme, template)` | `Path` | ファイル入出力 |

- `theme`: `slidegen/theme.py` の `Theme`（配色3カテゴリ 70:25:5、フォント1種、pt サイズ群）。
  既定 `DEFAULT_THEME` は青系（main `1F3A5F`）＋赤アクセント（`E2483D`）。**※ Web UI のテーマとは別物**。
- `template` 指定時は potx/pptx を土台にする（未指定時は 16:9 白紙）。

## 3. CLI — `slidegen/__main__.py`（`slidegen` コマンド）

```
slidegen build <input.slide> -o <out.pptx> [--template <company.potx>]
slidegen sync  <original.slide> <edited.pptx> [--apply] [-o <updated.slide>]
```
- `build` は `api.render_file` を、`sync` は `slidegen/sync.py` を利用。
- 後方互換: `python -m slidegen.cli` / `python -m slidegen.sync` も動く。

## 4. レンダリング規約 — `slidegen/render.py`（必達要件 R0 の実装）

- 白紙レイアウト `slide_layouts[6]` を使い、継承プレースホルダを除去（全ページ透け対策）。
- 16:9（13.333×7.5 inch）、座標は Inches/Pt、すべて**ネイティブ要素**（テキストフレーム/シェイプ/`add_table`）。
- 色・フォントは **`theme` 経由のみ**、影なし、強調は accent のみ。新型は `render_<type>()` を足し `register` する。

## 5. Web アプリのフロー — `frontend/src/`（会話起点ワークスペース）

- **2ペイン構成**: 左＝壁打ち（会話）、右＝デッキ（**構成プレビュー / DSL / AIレビュー** のタブ）。両者は常時表示で同時に育つ
  （モバイルは「会話／デッキ」セグメントで切替）。設定（目的/添付/会社テンプレ/リセット）は上部のモデル選択＋⚙ ポップオーバーに
  オンデマンド集約（常設サイドバーは廃止）。
- **進行**: `phase`（`hearing`/`outline`/`dsl`/`review`/`revise`）は上部の**進行ステッパー**に反映。**手動進行**
  （AI は自動で次へ進まない。「流れを作る」「今ある情報で生成」をユーザーが押す）。各フェーズの system prompt は `frontend/src/prompts.ts`。
- **生成 → 自動プレビュー**: 「今ある情報で生成」で DSL を生成し、成功時に構成プレビュー（Pyodide パース）を自動表示。
- **DSL 生成の堅牢化**（`frontend/src/phases.ts`）: `stripToDsl`（思考過程/前置きを捨て本体抽出）・
  `hasValidDsl`（`slide <型>` 検出ガード）。無効時は信頼モデルへ 1 回だけ自動リトライ（`App.tsx` `dslFallbackModel`）。

## 6. ゲートウェイ API — `gateway/src/index.ts`

| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api/health` | `{ok:true}`（※本番は Access がエッジで保護） |
| GET | `/api/models` | `{models:[{id,label,tier,reliableForDsl,vision}]}`。secret の有無で利用可能なものだけ返す |
| POST | `/api/chat` | **SSE 専用**。LLM へ中継（鍵注入）。クライアントは `?stream=1` を付与（`frontend/src/api.ts`） |

- **`/api/chat` リクエスト**: `{ modelId, system?, messages[], allowFallback? }`。入力上限 `MAX_INPUT_BYTES`（**UTF-8 バイト**、既定 1000000）超で 413。
  `messages[].images?`（base64・mimeType）で添付画像を運べる（jpeg/png/webp、1枚 base64 30万字以内、1リクエスト最大4枚。違反は 400）。
  画像は vision 対応モデル（`/api/models` の `vision:true`）にのみ送られ、非 vision モデルへのフォールバック時はエンコーダが黙って剥がす。
- **SSE イベント**（`data: <json>\n\n`）:
  - `{"delta":"…"}` 逐次トークン / `{"switch":"<id>"}` モデル切替 /
    `{"done":true,"model":"<id>"}` 完了 / `{"error":"…","status":n}` 失敗。
- **フォールバック**: 既定で同 tier の別モデルへ順に試行。途中まで出力(`acc`)があれば**部分出力を引き継いで継続**。
  `allowFallback:false` で primary のみ。

## 7. LLM プロバイダ — `gateway/src/providers.ts` / `stream.ts`

- provider 列挙: `gemini` / `openrouter` / `workers_ai` / `openai` / `anthropic`。tier: `free`（要無料鍵）/ `prod`（要本番鍵）。
- **SSRF 不変条件**: エンドポイント URL は本ファイル内に固定。フロントからは provider(列挙)/model/system/messages のみ受ける。
- `stream.ts` が各社の SSE/チャンク形式を**テキスト delta の AsyncGenerator** に正規化。
  Gemma 等 `systemInstruction` 非対応モデルは system を先頭 user に畳む（`noSystemInstruction`）。

## 8. 認証 — `gateway/src/auth.ts`

- Cloudflare Access の JWT を検証。`Cf-Access-Jwt-Assertion` ヘッダ、無ければ `CF_Authorization` Cookie。
- `issuer = https://<team>.cloudflareaccess.com`、`audience = ACCESS_AUD` を**完全一致で必須検証**。
- `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` 未設定なら**フェイルクローズ（500・全拒否）**。`DEV_BYPASS_AUTH=1` でローカルバイパス。
- 失効時はフロント(`api.ts`)が HTML/redirect を検知し `AuthExpiredError` → 再ログイン導線。

## 9. レート制限・入力上限 — `gateway/src/ratelimit.ts` / `index.ts`

- 固定窓カウンタ。KV(`RL`) があれば isolate 横断、無ければメモリでベストエフォート。
- 既定: `RATE_WINDOW_SEC=60` / `RATE_MAX_REQUESTS=30`。超過で 429（`Retry-After` 付き）。
- 入力上限 `MAX_INPUT_BYTES` 既定 1000000（UTF-8。添付画像 base64 を含むため。テキストのみ時代は 200000）。

## 10. レンダリングパイプライン（ブラウザ） — `frontend/src/render/`

- `renderClient.ts` ↔ `public/render-worker.js`（classic worker）。
- Pyodide を CDN から取得（`VITE_PYODIDE_URL`、既定 v0.28.3）。`micropip` で wheel を導入（`VITE_WHEEL_URL`）。
- **wheel basename は正規名 `slidegen-0.1.0-py3-none-any.whl`**（micropip はファイル名を解釈）。内容ハッシュは親ディレクトリ名に持たせる（`tools/build_wheel.sh`）。
- API: `renderDsl(dsl, template?) → Uint8Array` / `previewDsl(dsl) → SlidePreview[]` / `downloadPptx(bytes)`。

## 11. 添付取込 — `frontend/src/ingest.ts`

- xlsx/xls/csv/tsv → 表要約＋数値統計（件数/合計/最小/最大/平均）＋**チャート化ヒント**（SheetJS、動的 import）。
- pptx → 各スライドのテキスト抜粋（JSZip）。画像 → メタのみ。txt/md → 先頭抜粋。

## 12. 配信構成（本番）

- **Cloudflare Pages 一本**。`/api/*` は Pages Functions（`frontend/functions/api/[[path]].ts` →
  `gateway/src/pages.ts` の `handle(app)`）で**同一オリジン**配信。→ [ADR 0001](docs/adr/0001-same-origin-pages-functions.md)。
- CI/CD は frontend だけでなく **gateway でも `npm ci`** が必須（Functions バンドルが gateway/node_modules を要する）。
- 手順詳細は [docs/deployment.md](docs/deployment.md)。
