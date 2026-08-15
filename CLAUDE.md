# CLAUDE.md — プロジェクト状態と設計メモ

slidegen ＝ DSL から **編集可能な PowerPoint(.pptx)** を生成する純Python ライブラリ＋CLI。
スライド作成ロジックは **Agent Skills（オープン仕様）＋プラグイン**として同梱し、
Claude Code に限らず各 AI エージェントから利用できる。

## 現在の状態

- public リポジトリ。`RENDERERS` に**計168型**登録済み（型カタログの📋＝未実装は実質ゼロ）。
- 要件/仕様は [requirements.md](requirements.md) / [spec.md](spec.md)。設計判断は `docs/adr/`
  （0001 uv 統一、0002 編集可能pptx必達、0003 pptx↔DSL 責務分離。
  索引は [docs/adr/README.md](docs/adr/README.md)）。
- 検証状況: Python(pytest) green（テスト総数は増減するため本ファイルには書かない。実数は CI 実行結果を参照）。
  CI は `uv build` + `pytest` 中心（`.github/workflows/ci.yml`）。
- **過去の経緯（旧構成・移行の記録）は [docs/history.md](docs/history.md) に集約**。
  本ファイルを含む現行ドキュメントには経緯を書かない。

## アーキテクチャ

- コアライブラリ（`slidegen/`）が中核。DSL テキストを解析し、`python-pptx` でネイティブに編集可能な
  pptx を生成する。ホスト非依存（同一コードがどの環境でも動く）。
- 「教える型」（AI に渡す DSL リファレンス）と「実装済みの型」（`RENDERERS`）の一致は CI で機械保証する
  （`tests/test_dsl_reference.py` が `skills/slidegen/references/dsl-reference.md` を読み、
  `RENDERERS` との ⊆/⊇＝同値を検証）。

## ディレクトリ

- `slidegen/` … コアライブラリ。型は継続的に追加されるが、
  **レンダ規約（編集可能なネイティブ要素・theme経由・登録は `register`/`register_many`）と public API は不変**。
  型と実装モジュールの対応（主なもの）:
  - ネイティブchart は `render_charts.py`(複数形)が正
    （`bar_chart`/`line_chart`/`stacked_bar`/`stacked_100_bar`/`bar_horizontal`/`clustered_bar`/`area_chart`、
    DSL は `categories` + `col` + 数値行。`scatter`/`bubble` は `col` の各行が x,y 点）。
  - 図形描画チャート型（`bullet`/`funnel`/`football_field`/`harvey_ball_table`/`marimekko`/`treemap`/
    `sankey`/`annotated_chart`）は `render_charts_shapes.py` が正（waterfall/narrative_curve と
    同じ「標準プリセット図形の積み木」方針。`annotated_chart` はネイティブChart APIに
    データ点への注釈コールアウトを正確配置する手段が無いため自前描画）。
    `pictogram_array`/`dot_matrix_chart` も同モジュールの共通実装 `_render_unit_grid`
    （単一値のユニットグリッド。既定20・上限25個にクランプ。100個描くと
    インバリアント S2 の shape 数上限に抵触するため）。
  - ビジネスフレーム型は3モジュール：`render_frameworks.py`（`swot`/`venn2`）、
    `render_frameworks2.py`（`bmc`/`lean_canvas`/`journey_map`/`pricing_tiers`/`roadmap`。
    `lean_canvas` は `bmc` と共通ジオメトリ `_render_canvas9` を共有、`roadmap` は
    journey_map のグリッド様式＋期間をまたぐスパンバー）、`render_frameworks3.py`
    （`vpc`/`five_forces`/`3c`/`bcg_matrix`/`empathy_map`/`persona_card`/`speaker_intro_card`/
    `tam_sam_som`。`tam_sam_som` は下端揃えの入れ子円3つ）。
    `4p`/`pestel` は `render_base_labeled.py` の `labeled_blocks` variant。
  - 技術資料型は `render_tech.py`（`code_block`/`terminal`/`api_endpoint_table`/`code_diff`/
    `sql_result`）と図解系の `render_tech_diagrams.py`（`layered_stack`/`c4_context`/
    `sequence_diagram`/`state_transition`/`er_diagram`。いずれも Mermaid レンダリングではなく
    標準図形合成のみ）。`slo_sli_table`/`incident_severity_table` は `grid_2d`、
    `cloud_architecture` は `nodes_and_connectors` の variant。
  - `labeled_blocks`（`render_base_labeled.py`）variant の型は多数：`houkoku_sodan_irai`/
    `worked_example`/`theorem_proof`/`imrad_overview`/`golden_circle`/`storybrand_sb7`/
    `pixar_story_spine`/`jtbd_statement`/`smart_goal`/`elevator_pitch`/`faq_qa`/
    `mission_vision_values` 等。
  - そのほか：`cta_recruit`＝`hero_canvas` の mode、`flashcard`/`recipe_step`＝`split_layout`
    variant、`travel_itinerary`/`okr`＝`columns_with_header` variant（`lead`がヘッダー帯）、
    `prisma_flow`/`consort_flow`＝`nodes_and_connectors` のレイアウト `vertical_side`
    （縦フロー＋rows由来の除外サイドボックス。labels違いのみの同一実装）、
    `aida_funnel`＝`nodes_and_connectors` の `funnel` レイアウト＋固定ラベル、
    `frayer_model`/`abstract_slide`＝`render_education.py`、`event_timetable`/`maturity_model`＝
    `render_life.py`、`before_after_metric`＝`render_data_support.py`、
    `takeaways_emoji`/`ranking_list`＝`render_more.py`、`org_chart`＝`render_relations.py`
    （既存`tree`の1段限定を rows 経由の上司参照で多段へ拡張）。
- `skills/slidegen/` … Agent Skill 本体。`SKILL.md`（frontmatter はオープン仕様6フィールドのみ。
  **型名は列挙しない** — `tests/test_plugin_manifests.py` が機械ガード）、`scripts/slidegen.sh`
  （リポジトリ内外どちらでも動くレンダラッパー。内: `uv run slidegen`、外: `uvx --from git+...`）、
  `references/`（**DSL リファレンスの正本は `dsl-reference.md`**、CI ガード
  `tests/test_dsl_reference.py` の対象。`import-deck-prompt.md`（pptx 取り込み用プロンプト）、
  `design-guidelines.md`（デザイン原則）・`type-selection-guide.md`（型の逆引き）も同居。
  後2者が SKILL.md から参照されていることと、`type-selection-guide.md` の型名 ⊆ `RENDERERS` は
  `tests/test_plugin_manifests.py` が機械ガードする）。
- ルート `plugin.json`（Agent Plugins 1.0）・`.claude-plugin/plugin.json` +
  `marketplace.json`（Claude Code）… プラグインマニフェスト。version は `pyproject.toml` と
  `tests/test_plugin_manifests.py` で同期保証。
- `tests/` … `test_invariants.py`（構造インバリアント）、`test_dsl_reference.py`
  （dsl-reference.md ≡ RENDERERS の同値ガード）、`test_examples.py`（examples/*.slide の parse/render 回帰）、
  `test_visual_regression.py`（全型の図形ツリースナップショット）、`test_docs_drift.py`
  （system_prompt.md/type_catalog.md のドリフト検知）等。
- `tools/` … `new_type.py`（新型の雛形生成）、`visual.py`（ビジュアル回帰用モンタージュ生成）。
- `docs/` … 要件補助・仕様補助・ADR・設計・型カタログ・開発の経緯（`history.md`）。

## ローカル開発（要点）

Python は **uv に統一**（`uv build` / `uv run`、`pip`/`python -m build` は使わない。ADR 0001）。
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
- Python は **uv 統一**（`build` をランタイム依存に入れない。ADR 0001）。
- public API（`render_text` / `render_to_bytes` / `render_file`）とレンダ規約は不変。
- 過去の経緯は [docs/history.md](docs/history.md) だけに書く。現行ドキュメントには
  「以前は〜だった」形式の記述を持ち込まない。

## 次にやること

課題・ロードマップは [docs/backlog.md](docs/backlog.md) に集約。
