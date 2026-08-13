# slidegen 要件定義（requirements）

> 本書は「**何を・なぜ**」を定義する。具体的な記法・API・プロトコルなど「**どう動くか**」は
> [spec.md](spec.md) を参照。設計の背景思想は [docs/ppt_design_doc.md](docs/ppt_design_doc.md) が正。
>
> 方針: 個人プロジェクト/学習スコープ。記述は**コード参照を主体に薄く**保ち、詳細は実装（コード）と
> 既存 docs を単一情報源として指す（転記による乖離を避ける）。
> 最終更新: 2026-08-13

---

## 1. 概要

slidegen は、独自の中間記法(DSL)から、PowerPoint で**編集可能なネイティブ `.pptx`** を生成する
純 Python ライブラリ＋CLI である（`slidegen/`）。

中核思想は**中間記法パターン(MNP)** と**3層の責任分界**（AIは内容＝記法だけ書き、レイアウト/配色/フォントは
型カタログ・デザイン制約・potx が固定する）。詳細は [docs/ppt_design_doc.md](docs/ppt_design_doc.md)。

> 2026-08 まではこれに加えて Cloudflare 無料枠上の Web アプリ（AI と壁打ちしてスライドを作る）を
> 併設していたが撤去した（[ADR 0007](docs/adr/0007-retire-webapp-agent-skills.md)）。撤去後は
> **Agent Skills / プラグイン構成（`skills/slidegen/`）へ転換済み**（S2 完了。
> [docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)）。
> スライド作成ロジックは Claude Code / Agent Plugins 1.0 対応クライアントの両方から利用できる。

## 2. スコープ / 非スコープ

- **スコープ**: 個人/学習用途。日本語 UI・日本語の報告/提案/技術資料が前提。社内報告・提案資料および技術資料の作成。
- **非スコープ（現時点）**: マルチテナント/課金/SLA/組織管理、サーバ側 pptx 生成（本リポジトリの範囲外）、
  本物の画素サムネイル（pptx→画像）、pptx→DSL の完全な逆変換（sync は文言差分のみ）、i18n、
  自前 Web UI（2026-08 撤去。[ADR 0007](docs/adr/0007-retire-webapp-agent-skills.md)）。
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
- **NFR-LIB-1** 純 Python・**ホスト非依存**（同一コードがどのホスト環境でも動く）。コア依存は `python-pptx` のみ。
- **NFR-LIB-2** **public API 不変**（`render_text` / `render_to_bytes` / `render_file`）。レンダ規約（ネイティブ要素・theme 経由・`register`/`register_many`）も不変。
- **NFR-LIB-3** ビルド/実行は **uv 統一**（→ [ADR 0002](docs/adr/0002-uv-for-python-packaging.md)）。
- **NFR-LIB-4** 構造インバリアントを自動テストで常時監視（座標 int 包み・色は theme 経由・境界 overflow 等）。

## 5. 用語

- **DSL / 記法 / .slide**: スライド内容を表す独自テキスト記法（`slide <型>` から始まる）。
- **型 (type)**: レイアウトの種類。要素数から具体的な配置が決まる。
- **MNP（中間記法パターン）**: AI に座標でなく DSL を操作させる設計思想。
- **壁打ち**: AI と対話して要件・構成を固める工程（Web アプリでの実現手段は撤去済み。
  現在は `skills/slidegen/SKILL.md` に従うエージェントとの対話がこれを担う）。
- **3層責任分界**: 内容(AI) / 構造(型カタログ) / 見せ方(デザイン制約) ＋ ブランド書式(potx)。
