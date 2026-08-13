# slidegen

記法(DSL)から **PowerPoint で編集できるネイティブ .pptx** を生成する純 Python ライブラリ ＋ CLI。

中間記法パターン(MNP)の考え方で、**AI にはスライドの内容（記法）だけを書かせ**、
レイアウト・配色・フォントは「型カタログ」「デザイン制約」「会社テンプレ(potx)」で固定する。
出力は画像化しない（**後から編集できる本物の pptx**）。

> 📋 要件 → [requirements.md](requirements.md)　／　🔧 仕様 → [spec.md](spec.md)　／　🧠 背景思想 → [docs/ppt_design_doc.md](docs/ppt_design_doc.md)
> 🏛 設計判断(ADR) → [docs/adr/](docs/adr/)　／　🗺 方針転換ロードマップ → [docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)

---

## 現在の状態

2026-08 に、それまで併設していた Cloudflare 無料枠の「AI と壁打ちする Web アプリ」
（`frontend/`＋`gateway/`）を撤去し、純Python ライブラリ＋ **Agent Skills / プラグイン**
構成への転換を進めている（[ADR 0007](docs/adr/0007-retire-webapp-agent-skills.md)）。
Web アプリが LLM に渡していたプロンプト資産（DSL リファレンス・壁打ちフェーズ・pptx 取り込み）は
`skills/slidegen/references/` へ移設済み。撤去直前の状態は Git タグ
`archive/cloudflare-webapp` から参照できる。詳細な移行計画・進捗は
[docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)。

## エージェントから使う（Agent Skill / プラグイン）

スライド作成ロジックは Agent Skills（オープン仕様）準拠のスキル `skills/slidegen/` として同梱。
Claude Code / Agent Plugins 1.0 対応クライアントの両形式に対応する。

### Claude Code
```
/plugin marketplace add mrkxlia/slidegen
/plugin install slidegen@slidegen
```
ローカル開発中の動作確認は `claude --plugin-dir .`。

### Agent Plugins 1.0 対応クライアント（Codex / Cursor / Copilot / VS Code 等）
```
npx plugins add mrkxlia/slidegen
```

### プラグイン非対応の環境（素の利用）
リポジトリを clone し、エージェントに `skills/slidegen/SKILL.md` を読ませる。
レンダは `uv run slidegen build`（リポジトリ内）または
`uvx --from git+https://github.com/mrkxlia/slidegen slidegen build`（どこからでも）。

## クイックスタート

Python は **uv 統一**（[ADR 0002](docs/adr/0002-uv-for-python-packaging.md)）。

```bash
uv sync                                            # 仮想環境＋依存
uv run --extra dev pytest tests/ -q                # 本体テスト
uv run slidegen build examples/sample.slide -o out.pptx
uv build                                           # wheel 化
```

> 配布済み wheel の**利用者**側は uv 不要（`pip install slidegen-0.1.0-py3-none-any.whl` でも入る）。
> ただし wheel に `examples/` `docs/` は同梱しないため、`pip install` 先にサンプルは無い。

## CLI

```bash
slidegen build deck.slide -o deck.pptx [--template company.potx]   # 記法 → pptx
slidegen sync  deck.slide deck.pptx [--apply]                      # 手編集の文言差分を .slide に反映
```

`python -m slidegen build ...` でも同じ。従来の `python -m slidegen.cli` / `.sync` も後方互換で動く。

## ライブラリとして使う

ディスクを介さず、メモリで pptx の bytes を得られる（HTTP レスポンスにそのまま載せられる）。

```python
import slidegen

data = slidegen.render_to_bytes(open("deck.slide").read())  # → bytes
prs  = slidegen.render_text(text)                           # → python-pptx の Presentation
path = slidegen.render_file("in.slide", "out.pptx")         # → 保存先 Path
```

API 仕様は [spec.md](spec.md) §2。

## ディレクトリ早見

```
slidegen/   コアライブラリ（parser / render*.py / theme / api / cli）。RENDERERS = 100 型
skills/     Agent Skill 本体（SKILL.md・scripts/ レンダラッパー・references/ DSL リファレンス等）
plugin.json / .claude-plugin/   プラグインマニフェスト（Agent Plugins 1.0 / Claude Code。両方 skills/ を共有）
tools/      new_type.py（新型雛形）/ visual.py（ビジュアル回帰用モンタージュ生成）
tests/      第1層 pytest(test_invariants) ＋ DSL リファレンス整合ガード ＋ 第2層 visual.py
examples/   サンプル記法(.slide)
docs/       要件補助・仕様補助・ADR・設計・型カタログ・方針転換ロードマップ
```

## ドキュメント地図

| doc | 内容 |
|---|---|
| [requirements.md](requirements.md) | 要件（何を・なぜ） |
| [spec.md](spec.md) | 仕様（どう動くか）の索引兼サマリ |
| [docs/ppt_design_doc.md](docs/ppt_design_doc.md) | 背景思想（MNP・3層責任分界・デザイン制約・編集可能性 §2-bis） |
| [docs/adr/](docs/adr/) | アーキテクチャ決定記録（ADR） |
| [docs/type_catalog.md](docs/type_catalog.md) | 型カタログ（9基底 × variant の決定版） |
| [docs/system_prompt.md](docs/system_prompt.md) | DSL/記法リファレンス（設計参照。ライブは `skills/slidegen/references/dsl-reference.md`） |
| [docs/type_authoring.md](docs/type_authoring.md) | Web/画像/pptx → 記法 or 新型のワークフロー |
| [docs/test_driven_workflow.md](docs/test_driven_workflow.md) | テスト駆動の作業フロー |
| [docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md) | 方針転換ロードマップ（Web アプリ撤去 → Agent Skills/Plugin 化） |

## 開発・テスト

```bash
make test     # 第1層: 構造インバリアントの pytest（uv run 経由。venv 有効化は不要）
make visual   # 第2層: モンタージュ生成 → 目視
uv run --extra dev pytest tests/ -q                       # 単発はこちらが手軽
```

新しい型を**テスト駆動**で増やす手順は [docs/test_driven_workflow.md](docs/test_driven_workflow.md)。

## 対応する型（計 100 型）

「**9つの基底レイアウト × variant（ラベル/配置/強調位置）× 中身**」の3軸分解で広いカタログを吸収する設計。
個別型を量産しない。網羅の**単一情報源は `RENDERERS`**:

```bash
uv run python -c "import slidegen, slidegen.render as r; print(len(r.RENDERERS))"   # → 100
```

代表例: `title` / `section` / `agenda` / `bullets`・`compare` / `cards` / `kpi` / `process` / `table`・
`matrix` / `cycle` / `pyramid` / `timeline`・`bar_chart` / `line_chart` / `clustered_bar`・`swot` / `venn2` / `bmc`。
一覧と実装ステータスは [docs/type_catalog.md](docs/type_catalog.md)。

## 設計の3層（責任分界）

| 層 | 担当 | 実装箇所 |
|---|---|---|
| コンテンツ（記法） | AI が書く | `docs/system_prompt.md` / `skills/slidegen/references/dsl-reference.md` |
| 構造（どう配置） | 型カタログ | `slidegen/render*.py` の `render_<type>()` |
| 見せ方（何を禁じるか） | デザイン制約 | `slidegen/theme.py` ＋ テスト第1層が常時監視 |
| ブランド書式 | potx | `build(..., template=...)` |

## ロードマップ / 未実装

方針転換の進捗は [docs/plans/2026-08-agent-skills-transition.md](docs/plans/2026-08-agent-skills-transition.md)。
その他の課題・ネクストアクションは [docs/backlog.md](docs/backlog.md) に優先度順で集約。主な項目:
未実装型（🔜5型＋📋約50型）の実装、tsundoku の知見のスキル反映、potx 本連携の拡充、
技術図 Mermaid 連携、pptx → DSL の決定的双方向化（[ADR 0006](docs/adr/0006-provenance-roundtrip.md)）、i18n。
