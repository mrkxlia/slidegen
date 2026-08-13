# slidegen 課題・ネクストアクション（backlog）

> 立て直しエンゲージメントで洗い出した技術的負債・課題を**優先度順**にまとめる。
> 個人/学習プロジェクトのスコープに合わせ、過剰な作り込みは避ける方針。
> 関連: [requirements.md](../requirements.md) / [spec.md](../spec.md) / [docs/adr/](adr/)
> 最終更新: 2026-08-13（**方針転換ロードマップ S1（CF撤去＋DSLリファレンス移設）完了**に伴い、
> Web アプリ前提だった既存項目を Closed 化）

## 🔴 最優先: 方針転換（Web アプリ撤去 → Agent Skills/Plugin 化）

**実行計画（正）**: [docs/plans/2026-08-agent-skills-transition.md](plans/2026-08-agent-skills-transition.md)

Cloudflare 構成（`frontend/` `gateway/` と CD）を撤去し、純Python ライブラリ＋**Agent Skills（オープン仕様）＋
Claude Code / Agent Plugins 1.0 両対応プラグイン**の構成へ転換する。あわせて未実装型（🔜5型＋📋約50型）の
実装を進め、[tsundoku](https://github.com/mrkxlia/tsundoku) の知見をスキルに反映する。
S1（CF撤去＋DSLリファレンス移設）→ S2（Skill/Plugin化）→ S3（tsundoku知識抽出）→ S4（🔜5型）→
S5系列（📋約50型・分野別バッチ）の順で、1セッション=1PRを目安に進める。詳細・各セッションの完了条件は
上記ロードマップ参照。

- **S1: ✅ 完了**（[ADR 0007](adr/0007-retire-webapp-agent-skills.md)、`frontend/`/`gateway/` 削除、
  DSL リファレンス等を `skills/slidegen/references/` へ移設、CI 縮小）。これに伴い下記 #1 の Web 前提部分・
  #3・#6・7c、#5 の Web 専用項目を Closed 化した。
  - **S1 後片付け（リポジトリ外・Cloudflare 側リソース）(2026-08-13)**: 完了条件にリポジトリ外リソースの
    削除が含まれておらず追跡漏れだったところ、ユーザー指摘で発覚・対応。
    Pages プロジェクト `slidegen`（slidegen-ezt.pages.dev）と GitHub secrets
    `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` は**削除済み**。Worker/KV は元々未作成と確認。
    残作業は下記「🟡 ユーザー作業（Cloudflare ダッシュボード）」を参照。
- S2 以降: 未着手。

**🟡 ユーザー作業（Cloudflare ダッシュボード。Claude からは操作不可・未実施）:**
- Zero Trust チーム `mrxlia`（`mrxlia.cloudflareaccess.com`）の Access アプリ削除
  （旧 Pages プロジェクト向け、AUD `5ac4a021…17c03`）とそのポリシー。
- 旧 GitHub secrets に入れていた Cloudflare API トークン本体の失効
  （dash.cloudflare.com → My Profile → API Tokens。Pages:Edit スコープ）。
- LLM API キー（GEMINI_API_KEY / OPENROUTER_API_KEY、任意で OPENAI/ANTHROPIC）のローテーション検討
  （Pages プロジェクト削除で環境変数としては消滅済みだが、キー自体の失効は別途要判断）。

## このエンゲージメントで解消済み

- 要件/仕様の不在 → [requirements.md](../requirements.md) / [spec.md](../spec.md) を新設。
- 全体像の把握しづらさ → [README.md](../README.md) を再編（アーキ図・2成果物・ドキュメント地図）。
- 設計判断の未記録 → ADR [0003](adr/0003-browser-pyodide-rendering.md)/[0004](adr/0004-editable-native-pptx.md)/[0005](adr/0005-multi-provider-sse-fallback.md) を追加。
- ドキュメント乖離（「残るは実デプロイ」だが稼働中／旧「コンテナ backend」記述）→ README・CLAUDE を修正。
- Streamlit 風 UI → 会話起点ワークスペースに刷新（[ADR 直下のビュー層]、`frontend/src/{App,components,styles}`）。

---

## 優先度サマリ

| # | 優先 | 課題 | 状況 |
|---|---|---|---|
| 1 | **高** | モデルカタログの陳腐化 | 🔵 Closed（S1: gateway 撤去により対象消滅。[ADR 0007](adr/0007-retire-webapp-agent-skills.md)） |
| 2 | **高** | DSL 解説と実装のドリフト（chart 以外は未ガード） | ✅ 完了 (PR #14。S1 で読み取り先を dsl-reference.md へ付け替え) |
| 3 | 中 | ビュー回帰の自動ガードが無い（e2e が CI 外） | 🔵 Closed（S1: frontend 撤去により対象消滅） |
| 4 | 中 | 100型のビジュアル回帰が目視のみ | ✅ 完了（図形ツリースナップショット・全型） |
| 5 | 中 | 未実装の機能バックログ | 🟡 一部（potx連携・はみ出し検出 完了。Web専用項目は S1 で Closed。下記） |
| 6 | 中 | フロントのビュー層にテストが無い | 🔵 Closed（S1: frontend 撤去により対象消滅） |
| 7 | 低 | 軽微な負債（雛形TODO・古いコメント・wheel名 等） | 🟡 大半 (PR #14: 7b / PR #17: 7c・7d・7e。7c は S1 で対象消滅・Closed。残: 7a は温存) |

---

## P1（高）

### 1. モデルカタログの陳腐化対策 — 🔵 Closed（S1: 対象消滅）
- **Closed (S1, 2026-08-13)**: `gateway/` を含む Cloudflare Web アプリを撤去したため、`gateway/src/providers.ts` の
  `CATALOG` 自体が存在しなくなった。2026-10-16 期日で予定していた gemini-2.5 系モデルの削除タスク、
  `docs/model-catalog.md`（更新手順書）は対象ごと不要になり削除した。詳細は
  [ADR 0007](adr/0007-retire-webapp-agent-skills.md)。
- 以下は撤去前の実施記録（履歴として保持）:
  - **実施 (PR #14)**: `reliableForDsl` フラグを `providers.ts` に追加し `/api/models` で配信、frontend は純関数 `pickDslFallback`（カタログ順＋フラグ）で選ぶよう一般化し特定ID依存を撤去。
  - **実施 (2026-07-03)**: カタログを棚卸し（`or-deepseek-r1` は OpenRouter から消滅していたため `openai/gpt-oss-120b:free` に置換）。

### 2. DSL 解説（人間向け）と実装のドリフト検知 — ✅ 完了 (PR #14 + docs ガード)
- **実施 (PR #14)**: (b) を採用。`test_chart_dsl.py` に「`prompts.ts` が教える全型 ⊆ RENDERERS」を追加（slide 例＋スラッシュ列のクリーン token・43型）。
- **実施 (2026-07-03)**: 残っていた docs 側も `tests/test_docs_drift.py` で CI ガード。
  `system_prompt.md`（型一覧＋判断テーブル・18型）は素直に ⊆ RENDERERS、
  `type_catalog.md` はロードマップ文書のため **✅ マーク付きセグメントのみ**抽出（行内の ✅/📋 混在に対応・70型）して ⊆ RENDERERS。
  🔜/📋/❌ は設計上未実装なので対象外。これで backlog #2 は全面完了。
- **何**: DSL の単一情報源は宣言済み（`docs/system_prompt.md` 冒頭＝「ライブは prompts.ts、全型の真実は RENDERERS」）。ただし `tests/test_chart_dsl.py` が機械ガードするのは **chart 型の一致＋全 examples の parse/render** のみ。**chart 以外の型一覧・記法ルールの解説**（`system_prompt.md` / `type_catalog.md` / `prompts.ts`）は `RENDERERS` と乖離しても検知されない → AI に誤った型/記法を教える事故になりうる。
- **対応案**: (a) `RENDERERS` から型一覧/リファレンスを**生成**して docs/prompts に流す。または (b) 「`prompts.ts`・`type_catalog.md` が教える型 ⊆ `RENDERERS`」を `test_chart_dsl.py` と同様に全型へ拡張するドリフト検知テストを追加。

---

## P2（中）

### 3. ビュー回帰の自動ガード（e2e を CI に） — 🔵 Closed（S1: 対象消滅）
- **Closed (S1, 2026-08-13)**: 課題の対象だった `frontend/e2e/` `frontend/test/` ごと Web アプリを撤去したため
  消滅。[ADR 0007](adr/0007-retire-webapp-agent-skills.md)。
- 以下は撤去前の実施記録（履歴として保持）:
  - **実施 (PR #14)**: `@testing-library`+jsdom の `components.test.tsx` で一次ガード＋`.gitignore` 追加。

### 4. 100型のビジュアル回帰の自動化 — ✅ 完了
- **実施**: 案B（図形ツリースナップショット）で**全100型**を自動ガード。`tests/test_visual_regression.py` が各型を最小入力でレンダし、正規化した図形ツリー（種別・座標・塗り/線色・テキスト・フォント、表/チャート構造）を golden `tests/__snapshots__/visual_regression.json` と型ごとに比較。純Python・LibreOffice 不要・環境非依存。golden はコミット済みで Git diff で差分が読める。更新は `make snapshot-update`（=`SLIDEGEN_UPDATE_SNAPSHOTS=1`）。CI は `pytest tests/` 全体を回すため自動でガードに入る。`test_snapshot_covers_all_renderers` が golden⇔RENDERERS の増減を強制検知。
- **案Aへのフォールバック**: 図形ツリー不変でも崩れる回帰（描画順の重なり等）を取りこぼす場合は画像スナップショット（`tools/visual.py` の LibreOffice 経路）へ移行する旨をテスト先頭 docstring に明記。
- **何（元の課題）**: 第1層 `tests/test_invariants.py`（構造）はあったが、見た目の回帰は `tools/visual.py` のモンタージュ**目視**のみだった。

### 5. 未実装の機能バックログ

**現役（純Python ライブラリのスコープ内）:**
- ✅ potx 本連携（`slidegen/theme.py` の直値 → potx テーマ色参照。ADR 0004 ルール3の本実装）。
  → **完了**: `theme.py` に `theme_from_potx()` を追加（accent1→main / accent2→main_2 / accent6→accent の一般 OOXML マッピング、読めなければ DEFAULT_THEME にフェイルセーフ）。`build()`/`api.py` の `theme` を None センチネル化し、template 提供かつ theme 未指定なら自動抽出。
- pptx → DSL シリアライザ（編集の双方向化。現状 `sync` は**文言差分のみ**）。
  → 🟡 **スコープ判断 (2026-07-03) → ADR化 (2026-07-05)**: 責務分離の方針を
  **[ADR 0006](adr/0006-provenance-roundtrip.md)** として正式化。
  任意 pptx は「デザイン取り込み」（LLM インポート、実装済み。`inspect_pptx.inspect_compact` で
  構造抽出 → `IMPORT_DECK_SYSTEM`（S1 で `skills/slidegen/references/import-deck-prompt.md` へ移設）
  で DSL 再構成。Step2/3 で TABLE/CHART/GROUP 抽出とプロンプトの型カタログを強化）。
  自アプリ生成 pptx の**決定的双方向化**（プロベナンス方式：生成時に DSL ソースを埋め込み、
  `test_visual_regression.py` の図形ツリー比較器を流用して差分反映 + 全100型ラウンドトリップ検証）は
  ADR 0006 に記載の将来項として引き続き未実装。
- 技術図 **Mermaid** 連携（設計の MNP 構想にあるが未実装）。
- ✅ テキストはみ出しの物理検出を第1層へ（現状は境界 overflow まで）。
  → **完了**: `tests/test_invariants.py` に `S3`（TEXT_BOX の水平/垂直はみ出しヒューリスティック）を追加。word_wrap=False は横幅、折り返しは高さで判定（code_block 等の意図的 no-wrap を誤検知しない）。
- i18n（現状 日本語のみ）。

**🔵 Closed（S1, 2026-08-13）— Web アプリ前提のため対象消滅（[ADR 0007](adr/0007-retire-webapp-agent-skills.md)）:**
- 本物のサムネイル（サーバ側 LibreOffice 等でブラウザの pptx→画像 不可を補う想定だった。ADR 0003 の代替案）。
- 会社テンプレ/設定の **IndexedDB 永続化**（ブラウザのセッション限り保存を補う想定だった）。
- ✅ 添付画像のマルチモーダル活用（`frontend/src/image.ts`・`gateway` のプロバイダ別変換。実装ごと撤去）。

> 補足: 上記 potx連携 / はみ出し検出と、新規の **DSL 静的バリデーション**（`slidegen/dsl_validator.py`：未知型を build 前に検出し CLI を exit 1、誤記法/空スライドは警告）は、別レポ由来の指示書 `current-improvements-for-another.md` を当repo向けに要否判定して取り込んだもの。ハードコード型カタログ版の validator や内部リファクタ（render_common 等）は当repoの方針（真実は RENDERERS・過剰作り込み回避）に合わないため不採用。

### 6. フロントのビュー層テスト — 🔵 Closed（S1: 対象消滅）
- **Closed (S1, 2026-08-13)**: 課題の対象だった `frontend/` ごと Web アプリを撤去したため消滅。
  [ADR 0007](adr/0007-retire-webapp-agent-skills.md)。
- 以下は撤去前の実施記録（履歴として保持）:
  - **実施 (PR #14)**: `frontend/test/components.test.tsx` で TopBar/ConversationPane/DeckPane を prop 駆動検証（+7、jsdom 局所化）。

---

## P3（低・軽微）

- **7a.** `slidegen/scaffold_type.py` の `# TODO: レイアウト(...)に従って配置を実装`（雛形のレイアウト未実装）。 → 🔵 温存（新型を起こす際に人間が埋める**生成テンプレート内のガイド用プレースホルダ**であり本体の未実装ではない。消すとガイドが失われるため意図的に残す）。
- **7b.** 移植元 python（`slidegen_app.py` / `agent_prompts.py` / `ingest.py` / `llm_providers.py`）を指すコメントが各 TS に残る（既に不在で、新規参加者に紛らわしい）。文言を「移植済み」等へ。 → ✅ 完了 (PR #14)
- **7c.** wheel 名 `slidegen-0.1.0-py3-none-any.whl` が `frontend/src/render/renderClient.ts` の既定値と `tools/build_wheel.sh` に分散。version bump 時に複数箇所更新が要る（micropip の basename 解釈制約も絡む）。 → 🔵 Closed（S1, 2026-08-13）: `frontend/` `tools/build_wheel.sh` `tests/test_version_sync.py` を Web アプリごと撤去したため対象消滅（[ADR 0007](adr/0007-retire-webapp-agent-skills.md)）。撤去前は PR #17 で `test_version_sync.py` による CI ガードを実施していた。
- **7d.** `Makefile` は bare `python3` 前提（要 venv 有効化。README に注記済み）。`uv run` ラッパに寄せると事故が減る。 → ✅ 完了 (PR #17: 全ターゲットを `uv run --extra dev python` 化＝ADR 0002 統一。README の venv 注記も解消)。
- **7e.** `build-system` は setuptools（`pyproject.toml`）。ADR 0002 は uv 統一だが、これはビルド**フロント**の話で整合（`uv build` がこの backend を呼ぶ）。誤解防止に一言コメントしてもよい。 → ✅ 完了 (PR #17: `[build-system]` に 1 行コメント追記)。
