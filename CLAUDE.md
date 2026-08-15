# CLAUDE.md — プロジェクト状態と設計メモ

slidegen ＝ DSL から **編集可能な PowerPoint(.pptx)** を生成する純Python ライブラリ＋CLI。

## 現在の状態（2026-08）

2026-08 まで、これに加えて Cloudflare 無料枠で動く「AI と壁打ちしてスライドを作る Web アプリ」
（`frontend/`＋`gateway/`）を併設していたが、**撤去した**（[ADR 0007](docs/adr/0007-retire-webapp-agent-skills.md)）。
撤去後は、スライド作成ロジックを **Agent Skills（オープン仕様）＋プラグイン**として一般化し、
Claude Code に限らず各 AI エージェントから利用可能にする方針転換を進めている。
正となる実行計画は [docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)
（S1: Cloudflare 撤去＋DSLリファレンス移設＝**完了**。S2: Agent Skill＋両対応プラグイン化＝**完了**。
S3: tsundoku 知識抽出＋デザインガイドライン＝**完了**。S4: 5型実装（grid_2d variant）＝**完了**。
S5a: チャート系10型実装＝**完了**。S5b: ビジネスフレーム9型実装＝**完了**。
S5c: 技術資料10型実装＝**完了**。S5d: 日本の登壇文化4型実装＝**完了**。S5e以降＝未着手）。
**リポジトリは S2 で public 化した**（履歴のシークレット監査済み・クリーン。
詳細は実行計画 S2 セクションの実施時補足）。

- Web アプリが LLM に渡していたプロンプト資産（DSL リファレンス・壁打ちフェーズの各システムプロンプト・
  pptx 取り込み用プロンプト）は `skills/slidegen/references/` へ移設済み（`dsl-reference.md` /
  `phase-prompts.md` / `import-deck-prompt.md`）。壁打ちフローの要点は `skills/slidegen/SKILL.md`
  本文に編み込み済み（`phase-prompts.md` は出自保存用に残置、SKILL.md からは参照しない）。
- S3 で tsundoku（記事クリップ Vault）のノウハウ記事から知識抽出した
  `references/design-guidelines.md`（デザイン原則）・`references/type-selection-guide.md`
  （内容に応じた型の逆引き）を追加済み。SKILL.md から参照している。
- `skills/slidegen/` は Agent Skills オープン仕様に準拠したスキル本体（`SKILL.md` /
  `scripts/slidegen.sh` レンダラッパー / `references/`）。ルートの `plugin.json`
  （Agent Plugins 1.0）と `.claude-plugin/plugin.json` + `marketplace.json`（Claude Code）が
  同じ `skills/` を共有する両対応プラグイン構成。
- Web アプリ撤去直前の状態は Git タグ `archive/cloudflare-webapp` から参照・復元できる。
- 要件/仕様は [requirements.md](requirements.md) / [spec.md](spec.md)。設計判断は `docs/adr/`
  （0002 uv 統一、0004 編集可能pptx必達、0006 pptx↔DSL 責務分離、0007 Web アプリ撤去。
  0001/0003/0005 は 0007 により Superseded。索引は [docs/adr/README.md](docs/adr/README.md)）。
- 検証状況: Python(pytest) green（テスト総数は増減するため本ファイルには書かない。実数は CI 実行結果を参照）。
  CI は `uv build` + `pytest` 中心（`.github/workflows/ci.yml`）。

## アーキテクチャ

- コアライブラリ（`slidegen/`）が中核。DSL テキストを解析し、`python-pptx` でネイティブに編集可能な
  pptx を生成する。ホスト非依存（同一コードがどの環境でも動く）。
- 「教える型」（AI に渡す DSL リファレンス）と「実装済みの型」（`RENDERERS`）の一致は CI で機械保証する
  （`tests/test_dsl_reference.py` が `skills/slidegen/references/dsl-reference.md` を読み、
  `RENDERERS` との ⊆/⊇＝同値を検証）。

## ディレクトリ

- `slidegen/` … コアライブラリ。型は継続的に追加され現在 `RENDERERS` に**計138型**登録済みだが、
  **レンダ規約（編集可能なネイティブ要素・theme経由・登録は `register`/`register_many`）と public API は不変**。
  ネイティブchart は `render_charts.py`(複数形)が正
  （`bar_chart`/`line_chart`/`stacked_bar`/`stacked_100_bar`/`bar_horizontal`/`clustered_bar`/`area_chart`、
  DSL は `categories` + `col` + 数値行。`scatter`/`bubble` は `col` の各行が x,y 点）。
  図形描画チャート型（`bullet`/`funnel`/`football_field`/`harvey_ball_table`/`marimekko`/`treemap`/
  `sankey`）は `render_charts_shapes.py` が正（S5a, 2026-08 実装。waterfall/narrative_curve と
  同じ「標準プリセット図形の積み木」方針）。ビジネスフレーム型は3モジュールに分かれる：
  `render_frameworks.py`（`swot`/`venn2`）、`render_frameworks2.py`（`bmc`/`lean_canvas`/
  `journey_map`/`pricing_tiers`。`lean_canvas` は `bmc` と共通ジオメトリ `_render_canvas9`を共有）、
  `render_frameworks3.py`（`vpc`/`five_forces`/`3c`/`bcg_matrix`/`empathy_map`/`persona_card`、
  S5b, 2026-08 実装）。`4p`/`pestel` は `render_base_labeled.py` の `labeled_blocks` variant。
  技術資料型は `render_tech.py`（`code_block`/`terminal`/`api_endpoint_table`/`code_diff`/
  `sql_result`）と、図解系の新規 `render_tech_diagrams.py`（`layered_stack`/`c4_context`/
  `sequence_diagram`/`state_transition`/`er_diagram`。S5c, 2026-08 実装。3型はカタログ上
  「Mermaid流用」と注記されているが実装はMermaidレンダリングではなく標準図形合成のみ）。
  `slo_sli_table`/`incident_severity_table` は `grid_2d`、`cloud_architecture` は
  `nodes_and_connectors` の variant。日本の登壇文化型（S5d, 2026-08）は
  `houkoku_sodan_irai`＝`labeled_blocks` variant、`cta_recruit`＝`hero_canvas` の新mode、
  `takeaways_emoji`＝`render_more.py` に新規関数、`speaker_intro_card`＝
  `render_frameworks3.py` に新規関数（`persona_card` のOVAL写真意匠を単一フォーカスへ簡略化）。
- `skills/slidegen/` … Agent Skill 本体。`SKILL.md`（frontmatter はオープン仕様6フィールドのみ。
  **型名は列挙しない** — `tests/test_plugin_manifests.py` が機械ガード）、`scripts/slidegen.sh`
  （リポジトリ内外どちらでも動くレンダラッパー。内: `uv run slidegen`、外: `uvx --from git+...`）、
  `references/`（**DSL リファレンスの正本は `dsl-reference.md`**、CI ガード
  `tests/test_dsl_reference.py` の対象。`phase-prompts.md`・`import-deck-prompt.md` に加え、
  S3 で追加した `design-guidelines.md`・`type-selection-guide.md` も同居。両ファイルが SKILL.md から
  参照されていることと、`type-selection-guide.md` の型名 ⊆ `RENDERERS` は
  `tests/test_plugin_manifests.py` が機械ガードする）。
- ルート `plugin.json`（Agent Plugins 1.0）・`.claude-plugin/plugin.json` +
  `marketplace.json`（Claude Code）… プラグインマニフェスト。version は `pyproject.toml` と
  `tests/test_plugin_manifests.py` で同期保証。
- `tests/` … `test_invariants.py`（構造インバリアント）、`test_dsl_reference.py`
  （dsl-reference.md ≡ RENDERERS の同値ガード）、`test_examples.py`（examples/*.slide の parse/render 回帰）、
  `test_visual_regression.py`（全138型の図形ツリースナップショット）、`test_docs_drift.py`
  （system_prompt.md/type_catalog.md のドリフト検知）等。
- `tools/` … `new_type.py`（新型の雛形生成）、`visual.py`（ビジュアル回帰用モンタージュ生成）。
- `docs/` … 要件補助・仕様補助・ADR・設計・型カタログ・方針転換ロードマップ（`docs/plans/`）。

## ローカル開発（要点）

Python は **uv に統一**（`uv build` / `uv run`、`pip`/`python -m build` は使わない。ADR 0002）。
```bash
uv sync                                   # 仮想環境＋依存
uv run --extra dev pytest tests/ -q       # 本体テスト
uv run slidegen build examples/sample.slide -o out.pptx
uv build                                  # wheel 化
make test     # 第1層: 構造インバリアントの pytest
make visual   # 第2層: モンタージュ生成 → 目視
make validate-skill   # Agent Skill/プラグインマニフェスト検証（skills-ref + claude plugin validate）
```

## 重要な設計上の制約・注意

- **`skills/slidegen/references/dsl-reference.md` が AI に教える型 ≡ `RENDERERS`** を
  `tests/test_dsl_reference.py` が CI で機械保証する。新型を追加したら dsl-reference.md への
  追記も必須（怠ると CI が落ちる）。
- **`skills/slidegen/SKILL.md` には型名を列挙しない**。型カタログの正本は dsl-reference.md
  一本に保つ（`tests/test_plugin_manifests.py` の `test_skill_md_does_not_enumerate_type_names`
  が `slide <型>` の実例が無いことを機械ガードする）。
- Python は **uv 統一**（`build` をランタイム依存に入れない。ADR 0002）。
- public API（`render_text` / `render_to_bytes` / `render_file`）とレンダ規約は不変。

## 次にやること

課題・ロードマップは [docs/backlog.md](docs/backlog.md) に集約。方針転換の進捗は
[docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)
（S5d: 日本の登壇文化4型実装＝完了。次は S5e: 教育・学術8型）。
