# slidegen — 記法(DSL)から編集可能なpptxを生成する仕組み

中間記法パターン（MNP）の考え方で、**AIにはスライドの内容（記法）だけを書かせ**、
レイアウト・配色・フォントは「型カタログ」「デザイン制約」「会社テンプレ(potx)」で固定する。
出力は **PowerPointで自由に編集できるネイティブ .pptx**（画像化しない）。

slidegen は **アプリのバックエンド**（import して使うライブラリ）としても、
**単一CLI**（`slidegen` コマンド）としても使える。

## Web アプリ（Cloudflare 無料枠）

AIと壁打ちしてスライドを作る Web フロント＋ゲートウェイを `frontend/` と `gateway/` に同梱。
**全て Cloudflare 無料枠**で動く構成（pptx生成はブラウザ内Pyodideで実行＝サーバCPU制限なし）。

- `frontend/` … React+Vite+TS（Cloudflare Pages）。チャット/DSLエディタ/ブラウザpptx生成。
- `gateway/` … Hono/TS（Cloudflare Workers）。Cloudflare Access 認証付きの LLM 中継。
- LLM … テストは Gemini/OpenRouter/Workers AI（無料枠）、本番は API キーを secret 設定。

デプロイと運用は **[docs/deployment.md](docs/deployment.md)** を参照。
最初に STEP0 関門（`bash tools/build_wheel.sh && node tools/pyodide_spike.mjs`）で
ブラウザ相当のpptx生成が通ることを確認すること。

### 現在の状態
- 実装・検証は完了。**残るは実デプロイ（Cloudflare アカウント所有者の操作）のみ**（PR #3）。
- Python 105 / gateway vitest 20（API E2E 含む）/ frontend vitest 21、各 tsc clean・build 成功。
- STEP0（ブラウザ相当 Pyodide での pptx 生成）実機検証済み。
- 機能: 壁打ち（SSE ストリーミング）→ 流れ → DSL 編集 → pptx 生成/DL、添付(xlsx/csv/pptx)取込、
  会社テンプレ(.potx)適用、構成プレビュー、AIレビュー、設定の永続化。
- アーキテクチャ/設計メモ・ローカル開発手順は **[CLAUDE.md](CLAUDE.md)** に集約。

## インストール

```bash
pip install -e ".[dev]"   # 開発用（pytest/pillow 込み）。本番は pip install . で可
```

これで `import slidegen` と `slidegen` コマンドの両方が使えるようになる。
（コア依存は python-pptx のみ。pytest/pillow は dev extra。）

## クイックスタート

```bash
make test        # 第1層: 構造インバリアントの自動テスト
make visual      # 第2層: モンタージュを生成して目視確認
make all         # 両方
```

## 統合CLI

```bash
slidegen build examples/sample.slide -o out.pptx        # 記法 → pptx
slidegen build deck.slide -o deck.pptx --template company.potx
slidegen sync  deck.slide deck.pptx                     # 手編集の差分を表示（dry-run）
slidegen sync  deck.slide deck.pptx --apply             # 手編集を .slide に反映
```

`python -m slidegen build ...` でも同じ。従来の `python -m slidegen.cli` /
`python -m slidegen.sync` も後方互換でそのまま動く。
（`examples/...` を使う例は repo を clone した前提。wheel には examples/docs は
同梱しないため、`pip install` 先には examples は無い。）

## ライブラリとして使う（アプリのバックエンド）

ディスクを介さず、メモリで pptx の bytes を得られる。Webバックエンドの
レスポンスとしてそのまま返せる。

```python
import slidegen

# 記法テキスト → pptx の bytes（HTTPレスポンスにそのまま載せられる）
data = slidegen.render_to_bytes(open("deck.slide").read())

# その他の入口
prs  = slidegen.render_text(text)            # python-pptx の Presentation を返す
path = slidegen.render_file("in.slide", "out.pptx")
```

> **将来のホスティング構成**：最終的には Cloudflare Pages（静的フロント）から
> この Python バックエンドを呼ぶ想定。python-pptx は lxml/Pillow（Cネイティブ拡張）に
> 依存し Cloudflare Workers では動かないため、バックエンドはコンテナ等で別途動かす。
> （サーバー実装・Dockerfile は本リポジトリのスコープ外。今回はライブラリAPIのみ。）

## 構成

```
slidegen/
  Makefile                          ★ 頻出コマンドのショートカット
  slidegen/
    theme.py                        デザイン制約をコードで固定
    parser.py                       記法 → 内部データ構造
    render.py                       共通ヘルパー + 基本3型
    render_more.py                  構成型 (title/section/agenda/quote/bullets/cards/pros_cons/table)
    render_relations.py             39パターン由来 (matrix/cycle/pyramid/tree/formula/timeline/image_left)
    inspect_pptx.py                 既存pptx → 型スペック抽出
    scaffold_type.py                型スペック → render関数雛形
    cli.py
  tests/                            ★ テスト駆動の中核
    test_invariants.py              第1層: 構造インバリアントの自動テスト (pytest)
    visual.py                       第2層: モンタージュ生成 + 目視チェックリスト
    new_type.py                     新型追加ワークフロー（1コマンド）
  examples/                         サンプル記法
  docs/
    ppt_design_doc.md               設計の全体像・背景思想・要件
    system_prompt.md                AIに記法を書かせるためのシステムプロンプト
    type_authoring.md               Web/画像/pptx → 記法 or 新型 のワークフロー
    test_driven_workflow.md         ★ テスト駆動の作業フロー
  type_specs/                       型スペックJSON（type_authoring.md 参照）
  out/                              モンタージュ出力（自動生成）
```

## 全18型

### A. ベース構成
title / section / agenda / quote / bullets

### B. 内容パターン
compare / cards / kpi / process / pros_cons / table

### C. 関係図（Cone社の39パターンから取り込み）
matrix / cycle / pyramid / tree / formula / timeline / image_left

## テスト駆動で型を増やす（社内Claude Code向け）

詳細は `docs/test_driven_workflow.md`。要点だけ：

```bash
# 1. 新型の雛形を生成
make new TYPE=mytype INTENT="この型の意図" LAYOUT=grid COUNT="3..6"

# 2. examples/mytype.slide のサンプル記法を仕上げる
# 3. slidegen/render_mytype.py のTODOを埋める
#    規約：色はtheme経由のみ、強調はaccentのみ、座標は int(...) で包む

# 4. 検証（第1層pytest + 第2層モンタージュ生成）
make check TYPE=mytype

# 5. モンタージュ out/mytype.jpg を開いて目視（第3層・人間の判断）
# 6. system_prompt.md に新型を追記
```

## 設計の3層（責任分界）

| 層 | 担当 | 実装箇所 |
|---|---|---|
| コンテンツ（記法） | AIが書く | docs/system_prompt.md |
| 構造（どう配置） | 型カタログ | render*.py の render_<type>() |
| 見せ方（何を禁じるか） | デザイン制約 | theme.py + テスト第1層が常時監視 |
| ブランド書式 | potx | build(..., template=...) |

## 未実装（社内Claude Codeでやること）

1. **potx連携の本実装**：theme.pyの色をpotxテーマカラー参照に差し替え
2. **inspect_pptxの強化**：レイアウトマスター読み取り、面積比のwarning
3. **技術図(Mermaid)連携**：画像挿入 or 図形変換
4. **シリアライザー**：pptx → 記法
5. **テキストはみ出し検出を第1層に追加**：現状は境界overflowまで。テキスト量の物理測定は別途
