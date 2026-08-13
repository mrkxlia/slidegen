# CLAUDE.md — プロジェクト状態と設計メモ

slidegen ＝ DSL から **編集可能な PowerPoint(.pptx)** を生成する純Python ライブラリ＋CLI。

## 現在の状態（2026-08）

2026-08 まで、これに加えて Cloudflare 無料枠で動く「AI と壁打ちしてスライドを作る Web アプリ」
（`frontend/`＋`gateway/`）を併設していたが、**撤去した**（[ADR 0007](docs/adr/0007-retire-webapp-agent-skills.md)）。
撤去後は、スライド作成ロジックを **Agent Skills（オープン仕様）＋プラグイン**として一般化し、
Claude Code に限らず各 AI エージェントから利用可能にする方針転換を進めている。
正となる実行計画は [docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)
（S1: Cloudflare 撤去＋DSLリファレンス移設＝**完了**。S2 以降＝未着手）。

- Web アプリが LLM に渡していたプロンプト資産（DSL リファレンス・壁打ちフェーズの各システムプロンプト・
  pptx 取り込み用プロンプト）は `skills/slidegen/references/` へ移設済み（`dsl-reference.md` /
  `phase-prompts.md` / `import-deck-prompt.md`）。
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

- `slidegen/` … コアライブラリ。型は継続的に追加され現在 `RENDERERS` に**計100型**登録済みだが、
  **レンダ規約（編集可能なネイティブ要素・theme経由・登録は `register`/`register_many`）と public API は不変**。
  chart は `render_charts.py`(複数形)が正
  （`bar_chart`/`line_chart`/`stacked_bar`/`stacked_100_bar`/`bar_horizontal`/`clustered_bar`、
  DSL は `categories` + `col` + 数値行）。
- `skills/slidegen/references/` … Agent Skills 資産。**DSL リファレンスの正本は `dsl-reference.md`**
  （CI ガード `tests/test_dsl_reference.py` の対象）。`phase-prompts.md`（壁打ちフェーズの各プロンプト）・
  `import-deck-prompt.md`（pptx 取り込み用プロンプト、ADR 0006 の手段1）も同居。S2 で `SKILL.md` 本文に
  編み込む素材として保存している。
- `tests/` … `test_invariants.py`（構造インバリアント）、`test_dsl_reference.py`
  （dsl-reference.md ≡ RENDERERS の同値ガード）、`test_examples.py`（examples/*.slide の parse/render 回帰）、
  `test_visual_regression.py`（全100型の図形ツリースナップショット）、`test_docs_drift.py`
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
```

## 重要な設計上の制約・注意

- **`skills/slidegen/references/dsl-reference.md` が AI に教える型 ≡ `RENDERERS`** を
  `tests/test_dsl_reference.py` が CI で機械保証する。新型を追加したら dsl-reference.md への
  追記も必須（怠ると CI が落ちる）。
- Python は **uv 統一**（`build` をランタイム依存に入れない。ADR 0002）。
- public API（`render_text` / `render_to_bytes` / `render_file`）とレンダ規約は不変。

## 次にやること

課題・ロードマップは [docs/backlog.md](docs/backlog.md) に集約。方針転換の進捗は
[docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)
（次は S2: Agent Skill ＋ 両対応プラグイン化）。
