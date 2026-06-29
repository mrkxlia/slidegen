# slidegen 要件定義（requirements）

> 本書は「**何を・なぜ**」を定義する。具体的な記法・API・プロトコルなど「**どう動くか**」は
> [spec.md](spec.md) を参照。設計の背景思想は [docs/ppt_design_doc.md](docs/ppt_design_doc.md) が正。
>
> 方針: 個人プロジェクト/学習スコープ。記述は**コード参照を主体に薄く**保ち、詳細は実装（コード）と
> 既存 docs を単一情報源として指す（転記による乖離を避ける）。
> 最終更新: 2026-06-28

---

## 1. 概要

slidegen は **2つの成果物**からなる。両者は同等に重要。

| 成果物 | 役割 | 実装 |
|---|---|---|
| **コアライブラリ（Python）** | 独自の中間記法(DSL)から、PowerPoint で**編集可能なネイティブ `.pptx`** を生成する純 Python ライブラリ＋CLI | `slidegen/` |
| **Web アプリ（Cloudflare 無料枠）** | AI と壁打ちしながらスライドを作るブラウザアプリ。pptx 生成はブラウザ内 Pyodide で上のライブラリを実行 | `frontend/`（React/Pages）＋ `gateway/`（Hono/LLM 中継） |

中核思想は**中間記法パターン(MNP)** と**3層の責任分界**（AIは内容＝記法だけ書き、レイアウト/配色/フォントは
型カタログ・デザイン制約・potx が固定する）。詳細は [docs/ppt_design_doc.md](docs/ppt_design_doc.md)。

## 2. スコープ / 非スコープ

- **スコープ**: 個人/学習用途。日本語 UI・日本語の報告/提案/技術資料が前提。社内報告・提案資料および技術資料の作成。
- **非スコープ（現時点）**: マルチテナント/課金/SLA/組織管理、サーバ側 pptx 生成（本リポジトリの範囲外）、
  本物の画素サムネイル（pptx→画像）、pptx→DSL の完全な逆変換（sync は文言差分のみ）、i18n。
  これらは将来課題として [docs/backlog.md](docs/backlog.md) 側で管理する。

## 3. 共通の必達要件

- **R0（編集可能性・最重要）**: 出力 pptx は PowerPoint でテキスト・図形・色を**自由に編集できるネイティブ要素**で
  なければならない。画像化・1枚絵は禁止。→ [ADR 0004](docs/adr/0004-editable-native-pptx.md) /
  [ppt_design_doc §2-bis](docs/ppt_design_doc.md) / 実装 `slidegen/render.py`
- **R1（デザイン制約）**: 「足し算を禁じ引き算を強制」。配色3カテゴリ(70:25:5)・フォント1種・強調は原則1箇所。
  コードで強制する（`slidegen/theme.py` ＋ テスト第1層 `tests/test_invariants.py`）。
- **R2（言語）**: 日本語前提（UI・ドキュメント・プロンプト）。

## 4. コアライブラリの要件

### 4-1. 機能要件（FR-LIB）
- **FR-LIB-1** DSL テキスト → pptx を3経路で返す（`bytes` / `Presentation` / ファイル）。→ spec §2, `slidegen/api.py`
- **FR-LIB-2** 「型 ＋ 要素N個」を書くと、要素数からレイアウトを自動選択。計 **100 型**（9基底×variant×中身）。
  → `docs/type_catalog.md`、網羅の真実は `slidegen/render.py` の `RENDERERS`
- **FR-LIB-3** 会社テンプレ(.potx/.pptx)を土台に生成できる（`build(..., template=...)`）。
- **FR-LIB-4** CLI: `slidegen build` / `slidegen sync`（＋後方互換の `python -m slidegen.cli|sync`）。→ spec §3
- **FR-LIB-5** 手編集 pptx の**文言差分**を元の `.slide` に同期（`sync`、dry-run / `--apply`）。

### 4-2. 非機能要件（NFR-LIB）
- **NFR-LIB-1** 純 Python・**ホスト非依存**（同一コードがサーバでもブラウザ Pyodide でも動く）。コア依存は `python-pptx` のみ。
- **NFR-LIB-2** **public API 不変**（`render_text` / `render_to_bytes` / `render_file`）。レンダ規約（ネイティブ要素・theme 経由・`register`/`register_many`）も不変。
- **NFR-LIB-3** ビルド/実行は **uv 統一**（→ [ADR 0002](docs/adr/0002-uv-for-python-packaging.md)）。
- **NFR-LIB-4** 構造インバリアントを自動テストで常時監視（座標 int 包み・色は theme 経由・境界 overflow 等）。

## 5. Web アプリの要件

> 機能は**能力ベース**で定義する（現行の hearing/outline/dsl/review/revise というフェーズ順序は
> 1つの実現手段であり、Step 3 の UI/UX 刷新で順序・進行方法を変える可能性があるため、要件は順序に縛らない）。

### 5-1. 機能要件（FR-APP）
- **FR-APP-1（壁打ち）** 目的・聞き手・結論などを対話で引き出す（応答は SSE ストリーミング）。
- **FR-APP-2（構成提案）** 流れ（章立て）を提案する。
- **FR-APP-3（DSL 生成）** 会話・添付から DSL を生成。無効出力時は信頼できる別モデルで自動リトライ。
- **FR-APP-4（AI レビュー）** DSL を 3 観点（Content/Design/Coherence、PPTEval 由来）でレビューし改善案を反映できる。
- **FR-APP-5（修正）** 既存 DSL をベースに、指示・追記・新規添付を反映して更新する。
- **FR-APP-6（添付取込）** xlsx/csv/tsv/pptx/画像/テキストを取り込み、要約を文脈化。数値はチャート化を促す。
- **FR-APP-7（会社テンプレ）** .potx/.pptx を適用して生成できる。
- **FR-APP-8（構成プレビュー）** 型・主張・要素のカード一覧を表示（**画素サムネイルではない**点に留意）。
- **FR-APP-9（生成・DL）** ブラウザ内 Pyodide で pptx を生成しダウンロードする。
- **FR-APP-10（永続化）** 設定（モデル/目的）をローカルに保存。
- **FR-APP-11（モデル選択）** 利用可能なモデルだけを提示（secret の有無で決まる）。
- **FR-APP-12（再認証）** 認証失効を検知し再ログインへ誘導する。

### 5-2. 非機能要件（NFR-APP）
- **NFR-APP-1（無料枠）** 全 Cloudflare 無料枠で動作。重い pptx 生成はブラウザ側へ退避し Worker の CPU 制限(≈10ms)を回避。→ [ADR 0003](docs/adr/0003-browser-pyodide-rendering.md)
- **NFR-APP-2（同一オリジン）** フロントと API を同一オリジン配信（Pages ＋ Pages Functions）。→ [ADR 0001](docs/adr/0001-same-origin-pages-functions.md)
- **NFR-APP-3（認証）** Cloudflare Access（エッジ）＋ ゲートウェイ内 JWT 検証（`aud` 完全一致必須・**フェイルクローズ**）の多層防御。→ spec §8, `gateway/src/auth.ts`
- **NFR-APP-4（濫用防止）** レート制限・入力サイズ上限で本番鍵の暴走課金を防ぐ。→ spec §9
- **NFR-APP-5（鍵秘匿・SSRF）** API キーは Pages secret に秘匿。フロント/リクエストから上流 URL・鍵を一切受け取らない（受けるのは provider 列挙・model・system・messages のみ）。→ `gateway/src/providers.ts`
- **NFR-APP-6（UI）** **レスポンシブ（PC＋モバイル）**、アクセシビリティ（focus-visible / prefers-reduced-motion）。
- **NFR-APP-7（可搬性）** render=純 Python、gateway=Hono（Node/Bun/Deno 可）。Cloudflare 固有は `auth(Access)` /
  `providers.workers_ai` / Pages Functions アダプタ `gateway/src/pages.ts` の **3点に局所化**。

## 6. 制約・前提

- **デプロイ状態**: 既に **Cloudflare 無料枠で稼働中**（Cloudflare 制約は「現行の確定要件」として扱う）。
- LLM: テストは無料枠（Gemini / OpenRouter / Workers AI）、本番は secret 設定の API キー（OpenAI / Anthropic）。
- ブラウザ単体では pptx→画像が不可能なため、プレビューは「構成（型・主張・要素）」で代替する。

## 7. 用語

- **DSL / 記法 / .slide**: スライド内容を表す独自テキスト記法（`slide <型>` から始まる）。
- **型 (type)**: レイアウトの種類。要素数から具体的な配置が決まる。
- **MNP（中間記法パターン）**: AI に座標でなく DSL を操作させる設計思想。
- **壁打ち**: AI と対話して要件・構成を固める工程。
- **3層責任分界**: 内容(AI) / 構造(型カタログ) / 見せ方(デザイン制約) ＋ ブランド書式(potx)。
