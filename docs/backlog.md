# slidegen 課題・ネクストアクション（backlog）

> 立て直しエンゲージメントで洗い出した技術的負債・課題を**優先度順**にまとめる。
> 個人/学習プロジェクトのスコープに合わせ、過剰な作り込みは避ける方針。
> 関連: [requirements.md](../requirements.md) / [spec.md](../spec.md) / [docs/adr/](adr/)
> 最終更新: 2026-07-02（#4 全型ビジュアル回帰の自動化を実施。#5 の potx連携・はみ出し物理検出＋DSL静的バリデーション = `current-improvements-for-another.md` の要否判定。P3 7c/7d/7e = PR #17。P1＋一部 quick-win = PR #14）

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
| 1 | **高** | モデルカタログの陳腐化 | ✅ 完了 (PR #14) |
| 2 | **高** | DSL 解説と実装のドリフト（chart 以外は未ガード） | ✅ 完了 (PR #14) |
| 3 | 中 | ビュー回帰の自動ガードが無い（e2e が CI 外） | 🟡 一部 (PR #14: component+gitignore。e2e の CI 化は見送り) |
| 4 | 中 | 100型のビジュアル回帰が目視のみ | ✅ 完了（図形ツリースナップショット・全型） |
| 5 | 中 | 未実装の機能バックログ | 🟡 一部（potx連携・はみ出し検出 完了。下記） |
| 6 | 中 | フロントのビュー層にテストが無い | ✅ 完了 (PR #14) |
| 7 | 低 | 軽微な負債（雛形TODO・古いコメント・wheel名 等） | 🟡 大半 (PR #14: 7b / PR #17: 7c・7d・7e。残: 7a は温存) |

---

## P1（高）

### 1. モデルカタログの陳腐化対策 — ✅ 完了 (PR #14)
- **実施 (PR #14)**: `reliableForDsl` フラグを `providers.ts` に追加し `/api/models` で配信、frontend は純関数 `pickDslFallback`（カタログ順＋フラグ）で選ぶよう一般化し特定ID依存を撤去。残: カタログの ID/日付は手書き（動的探索は未対応）。
- **何**: `gateway/src/providers.ts` の `CATALOG` がモデルID・シャットダウン日をハードコード（例: 「gemini-2.0-flash は 2026-06-01 シャットダウン済」）。無料枠モデルは入れ替わりが激しく、放置すると**稼働中アプリが静かに壊れる**。`frontend/src/App.tsx` の `dslFallbackModel` も特定ID `gemini-3.1-flash-lite` に依存（軟結合）。
- **なぜ高**: 既に本番稼働しており、モデル鮮度が運用品質に直結。
- **対応案**: (a) カタログを設定/データ化し更新を一箇所に。(b) frontend のフォールバックを「特定ID」でなく **tier/能力**で選ぶ（`/api/models` の結果から）よう一般化（ADR 0005 の責務分界は維持）。(c) 起動時にモデル存在を軽く検証。

### 2. DSL 解説（人間向け）と実装のドリフト検知 — ✅ 完了 (PR #14)
- **実施 (PR #14)**: (b) を採用。`test_chart_dsl.py` に「`prompts.ts` が教える全型 ⊆ RENDERERS」を追加（slide 例＋スラッシュ列のクリーン token・43型）。残: docs(system_prompt/type_catalog) 全文の生成/ガードは未対応。
- **何**: DSL の単一情報源は宣言済み（`docs/system_prompt.md` 冒頭＝「ライブは prompts.ts、全型の真実は RENDERERS」）。ただし `tests/test_chart_dsl.py` が機械ガードするのは **chart 型の一致＋全 examples の parse/render** のみ。**chart 以外の型一覧・記法ルールの解説**（`system_prompt.md` / `type_catalog.md` / `prompts.ts`）は `RENDERERS` と乖離しても検知されない → AI に誤った型/記法を教える事故になりうる。
- **対応案**: (a) `RENDERERS` から型一覧/リファレンスを**生成**して docs/prompts に流す。または (b) 「`prompts.ts`・`type_catalog.md` が教える型 ⊆ `RENDERERS`」を `test_chart_dsl.py` と同様に全型へ拡張するドリフト検知テストを追加。

---

## P2（中）

### 3. ビュー回帰の自動ガード（e2e を CI に） — 🟡 一部完了 (PR #14)
- **実施 (PR #14)**: `@testing-library`+jsdom の `components.test.tsx` で一次ガード＋`.gitignore` 追加。残: e2e の CI 化は CI 軽量維持のため見送り（opt-in 据え置き）。
- **何**: Playwright e2e はオプトイン（`@playwright/test` を devDependencies に入れず、CI 対象外）。今回 `e2e/smoke.spec.ts` の見出しセレクタが陳腐化して壊れていた（実証済み）。UI 刷新直後で、回帰を防ぐ価値が高い。
- **対応案**: 任意 job として e2e を CI に追加（chromium キャッシュ活用）か、`@testing-library` でビューの最小結合テストを `frontend/test/` に追加。あわせて `frontend/test-results/` を `.gitignore` へ（現在未登録）。

### 4. 100型のビジュアル回帰の自動化 — ✅ 完了
- **実施**: 案B（図形ツリースナップショット）で**全100型**を自動ガード。`tests/test_visual_regression.py` が各型を最小入力でレンダし、正規化した図形ツリー（種別・座標・塗り/線色・テキスト・フォント、表/チャート構造）を golden `tests/__snapshots__/visual_regression.json` と型ごとに比較。純Python・LibreOffice 不要・環境非依存。golden はコミット済みで Git diff で差分が読める。更新は `make snapshot-update`（=`SLIDEGEN_UPDATE_SNAPSHOTS=1`）。CI は `pytest tests/` 全体を回すため自動でガードに入る。`test_snapshot_covers_all_renderers` が golden⇔RENDERERS の増減を強制検知。
- **案Aへのフォールバック**: 図形ツリー不変でも崩れる回帰（描画順の重なり等）を取りこぼす場合は画像スナップショット（`tests/visual.py` の LibreOffice 経路）へ移行する旨をテスト先頭 docstring に明記。
- **何（元の課題）**: 第1層 `tests/test_invariants.py`（構造）はあったが、見た目の回帰は `tests/visual.py` のモンタージュ**目視**のみだった。

### 5. 未実装の機能バックログ
- ✅ potx 本連携（`slidegen/theme.py` の直値 → potx テーマ色参照。ADR 0004 ルール3の本実装）。
  → **完了**: `theme.py` に `theme_from_potx()` を追加（accent1→main / accent2→main_2 / accent6→accent の一般 OOXML マッピング、読めなければ DEFAULT_THEME にフェイルセーフ）。`build()`/`api.py` の `theme` を None センチネル化し、template 提供かつ theme 未指定なら自動抽出（CLI・ブラウザ Pyodide 両経路で有効）。
- pptx → DSL シリアライザ（編集の双方向化。現状 `sync` は**文言差分のみ**）。
  → 🟡 **スコープ判断 (2026-07-03)**: 決定的な逆変換はレンダラが出所情報を残さない現状では不可能なため、
  **任意 pptx の「デザイン取り込み」（LLM インポート）を採用**（`inspect_pptx.inspect_compact` で構造抽出 →
  Pyodide worker `inspect` → `IMPORT_DECK_SYSTEM` で DSL 再構成。ヒーローの「既存の pptx から作り直す」）。
  自アプリ生成 pptx の**決定的双方向化**は、生成時に DSL ソースを埋め込む（スライドノート等の
  プロベナンス方式）+ 全100型ラウンドトリップ検証（`_shape_dict` 比較器を流用）として将来項に残す。
- 技術図 **Mermaid** 連携（設計の MNP 構想にあるが未実装）。
- 本物のサムネイル（サーバ側 LibreOffice 等。ブラウザ単体では pptx→画像 不可のため別ホスト。ADR 0003 の代替案）。
- ✅ テキストはみ出しの物理検出を第1層へ（現状は境界 overflow まで）。
  → **完了**: `tests/test_invariants.py` に `S3`（TEXT_BOX の水平/垂直はみ出しヒューリスティック）を追加。word_wrap=False は横幅、折り返しは高さで判定（code_block 等の意図的 no-wrap を誤検知しない）。
- 会社テンプレ/設定の **IndexedDB 永続化**（現状は容量/プライバシー配慮でセッション限り）。
- i18n（現状 日本語のみ）。
- 添付画像の**マルチモーダル**活用（現状 `frontend/src/ingest.ts` は画像をメタ情報のみで LLM に渡さない）。

> 補足: 上記 potx連携 / はみ出し検出と、新規の **DSL 静的バリデーション**（`slidegen/dsl_validator.py`：未知型を build 前に検出し CLI を exit 1、誤記法/空スライドは警告）は、別レポ由来の指示書 `current-improvements-for-another.md` を当repo向けに要否判定して取り込んだもの。ハードコード型カタログ版の validator や内部リファクタ（render_common 等）は当repoの方針（真実は RENDERERS・過剰作り込み回避）に合わないため不採用。

### 6. フロントのビュー層テスト — ✅ 完了 (PR #14)
- **実施 (PR #14)**: `frontend/test/components.test.tsx` で TopBar/ConversationPane/DeckPane を prop 駆動検証（+7、jsdom 局所化）。
- **何**: `frontend/test/` の vitest は **ロジック層**（ingest/md/phases/storage）のみ。`App.tsx`/`components.tsx` は型検査と e2e 任せ。
- **対応案**: 主要分岐（オンボーディング/生成中/無効DSL回復/タブ切替）の軽いコンポーネントテスト。

---

## P3（低・軽微）

- **7a.** `slidegen/scaffold_type.py` の `# TODO: レイアウト(...)に従って配置を実装`（雛形のレイアウト未実装）。 → 🔵 温存（新型を起こす際に人間が埋める**生成テンプレート内のガイド用プレースホルダ**であり本体の未実装ではない。消すとガイドが失われるため意図的に残す）。
- **7b.** 移植元 python（`slidegen_app.py` / `agent_prompts.py` / `ingest.py` / `llm_providers.py`）を指すコメントが各 TS に残る（既に不在で、新規参加者に紛らわしい）。文言を「移植済み」等へ。 → ✅ 完了 (PR #14)
- **7c.** wheel 名 `slidegen-0.1.0-py3-none-any.whl` が `frontend/src/render/renderClient.ts` の既定値と `tools/build_wheel.sh` に分散。version bump 時に複数箇所更新が要る（micropip の basename 解釈制約も絡む）。 → ✅ 完了 (PR #17: `tests/test_version_sync.py` で `renderClient.ts` の既定版 ⇔ `pyproject.toml` version 一致を CI ガード。build_wheel.sh は元々動的抽出で drift せず)。
- **7d.** `Makefile` は bare `python3` 前提（要 venv 有効化。README に注記済み）。`uv run` ラッパに寄せると事故が減る。 → ✅ 完了 (PR #17: 全ターゲットを `uv run --extra dev python` 化＝ADR 0002 統一。README の venv 注記も解消)。
- **7e.** `build-system` は setuptools（`pyproject.toml`）。ADR 0002 は uv 統一だが、これはビルド**フロント**の話で整合（`uv build` がこの backend を呼ぶ）。誤解防止に一言コメントしてもよい。 → ✅ 完了 (PR #17: `[build-system]` に 1 行コメント追記)。
