---
name: slidegen
description: >-
  DSL(記法)から編集可能な PowerPoint (.pptx) を生成する。ユーザーがスライド・プレゼン資料・
  デッキ・パワポの作成/生成/修正を依頼したとき、または既存 pptx を DSL に取り込みたいときに使う。
  ヒアリング(壁打ち)→構成提案→DSL記述→レンダ→レビューの流れで進める。
  Create and edit native, editable PowerPoint slides / presentation decks (pptx) from a simple
  DSL. Use for requests like "make slides", "create a presentation", "generate pptx",
  スライド作成, プレゼン資料, 資料作成, パワポ.
license: MIT
compatibility: >-
  Requires Python 3.10+ and uv (uvx). Network access to github.com is required when rendering
  outside the slidegen repository (uvx resolves the package from a git URL).
metadata:
  repository: https://github.com/mrkxlia/slidegen
---

# slidegen — 記法から編集可能な pptx を生成する

slidegen は DSL（記法）から **編集可能なネイティブ PowerPoint (.pptx)** を生成するライブラリです。
AI は座標・色・フォントを一切書きません。書くのは「内容（見出し・本文・数値）」だけで、配置や配色は
型ごとに決まったレンダラが処理します。出力は画像ではなく、PowerPoint で開いて普通に編集できる本物の
pptx です。

## 進め方（全体フロー）

依頼を受けたら、原則として次の5段階で進めます。

1. **ヒアリング** — 何を作りたいか壁打ちで引き出す
2. **構成提案** — 章立て（スライドごとの型と一言メッセージ）を提案
3. **DSL 記述** — `.slide` ファイルとして DSL を書く
4. **レンダ** — DSL から実際の pptx を生成
5. **レビュー/修正** — 出来上がりを講評し、必要なら修正

**各段階から次の段階へ進む前に、必ずユーザーの承諾を確認してください**（「この構成でよければ
DSL を書きます」「この内容でレンダしてよいですか」等）。ただし、依頼内容がすでに具体的
（「この Excel の数値で棒グラフのスライドを1枚作って」等）なら、ヒアリングや構成提案を省いて
DSL 記述から直接入って構いません。壁打ちの途中で急に「今の内容でスライドにして」と言われた場合も、
不足は常識的な前提で補い、拒否せずに作ってください。

## 1. ヒアリング

プレゼン資料づくりのプロコンサルタントのつもりで、スライド作成に必要な情報を漏れなく引き出します。

- 質問は一度に1〜3個まで。相手が答えやすいよう具体的な選択肢や例を添える。
- 次の6観点を網羅するまで続ける:
  1. 目的（意思決定・報告・提案・教育など。下記の目的例から選んでもらってもよい）
  2. 聞き手（誰に／その人の前提知識・関心）
  3. 一番伝えたい結論（1スライド1メッセージの核）
  4. 使いたい根拠・データ（添付ファイルがあればその使い方）
  5. 長さ（おおよその枚数）とトーン（堅い/カジュアル）
  6. 必須で入れたい要素・避けたいこと
- 添付ファイル（Excel/CSV 等）があれば、「この数字はグラフにしますか？」等を確認する。
- 情報が一通り揃ったら「この内容で構成案を出しますが、よろしいですか」と確認する。

目的の選択肢の例（迷ったら提示する）: 社内報告・進捗共有／意思決定・承認を得る提案／
顧客・社外向けの提案・営業／教育・研修・勉強会／技術解説・設計共有／イベント・LT・登壇／
振り返り・KPT／その他。

口調は丁寧で簡潔に。長文の説明より、良い質問を優先してください。

## 2. 構成提案

ヒアリング内容をもとに、スライドの流れ（章立て）を提案します。DSL はまだ書きません。

- 各スライドを「番号. 型 — 一言メッセージ」の箇条書きで示す。
  例: `1. title — 表紙` / `2. section — 背景` / `3. kpi — 現状の課題を数値で` /
  `4. bar_chart — 売上推移（添付Excel）`
- 全体で何を達成する流れかを2〜3文で添える。
- 型は数値データがあれば bar_chart/line_chart/kpi のようなチャート・指標型を積極的に使う。
  内容がフレームワーク的（比較・分解・対比・時系列・関係図など）に当てはまるときは、
  bullets/cards だけに寄せず、対応する専用の型（対比なら before_after、分解なら waterfall、
  関係図なら matrix/cycle/pyramid など）を積極的に選ぶ。**具体的にどの型があるかは、
  この段階で [references/dsl-reference.md](references/dsl-reference.md) を読んで判断すること**
  （型カタログの正本はそちらにあり、ここには型名を列挙しない）。
- 内容から型を逆引きしたいときは
  [references/type-selection-guide.md](references/type-selection-guide.md)（「したいこと→型名」の索引）
  も使う。型の詳しい書き方は dsl-reference.md が正本のまま変わらない。
- 何をどう見せるか（配色・グラフの選び方・構成の作法）で迷ったら
  [references/design-guidelines.md](references/design-guidelines.md)（デザイン原則。資料作成ノウハウの
  知見から抽出）を参照する。
- 末尾に「この流れでよければ DSL を作成します。修正点があれば教えてください」と添える。

## 3. DSL 記述

**DSL を書き始める前に、必ず [references/dsl-reference.md](references/dsl-reference.md) を
全文読んでください。** 絶対ルール・記法の基本形・型カタログ・チャート型やテーブル型など個別の
書き方がすべてそこにまとまっています。このファイル自体には型名や記法の詳細を書きません
（正本を二重管理しないため）。

書き終えたら会話・添付データをもとに DSL を **`<わかりやすい名前>.slide`** ファイルとして
保存してください。厳守事項（dsl-reference.md にも詳細あり）:

- 出力は必ず行頭 `slide <型名>`（例: `slide title`）から始める。
- 複数スライドは単独行 `---` で区切る。インデントは半角スペース2つ。値は `"..."` で囲む。
- 座標・色・フォント・サイズは書かない。
- 添付 Excel/CSV の数値は bar_chart / line_chart 等のネイティブチャート型で実データを反映する
  （数値の捏造・丸め直しは禁止）。
- 1スライド1メッセージ、強調は原則1箇所。
- 情報が薄いときも、最低限 表紙(title) + 本編数枚 + まとめ の構成で形にする。

## 4. レンダ（pptx 生成）

DSL ファイルができたら [scripts/slidegen.sh](scripts/slidegen.sh) でレンダします。このスクリプトは
リポジトリ内外どちらでも動く自己完結ラッパーです。

```bash
scripts/slidegen.sh build deck.slide -o deck.pptx [--template company.potx]
```

ラッパーが使えない環境では、状況に応じて次のどちらかを直接実行してください。

- slidegen リポジトリの中で作業している場合: `uv run slidegen build deck.slide -o deck.pptx`
- リポジトリの外（このスキルだけが手元にある場合）:
  `uvx --from git+https://github.com/mrkxlia/slidegen slidegen build deck.slide -o deck.pptx`

コマンドが `Warning:` や `Error:` を出したら、DSL の記法ミス（未知の型・必須プロパティ漏れ等）です。
dsl-reference.md を見直して修正し、再実行してください。`Error:` は exit 1 になり pptx は生成されません。

## 5. レビューと修正

生成した DSL を、研究で使われる3観点（PPTEval 由来）でレビューします。

1. **Content（内容）**: 1スライド1メッセージか／主張が言い切りか／冗長や重複はないか／数値は根拠付きか
2. **Design（体裁）**: 型の選択が内容に合っているか（比較=compare/grid、数値=kpi/bar_chart、
   流れ=process/timeline 等。迷ったら references/type-selection-guide.md、判断基準は
   references/design-guidelines.md を参照）／強調が1スライド1箇所に収まっているか／要素数が多すぎないか
3. **Coherence（流れ）**: 表紙→本編→まとめの一貫性／章立ての論理／重複スライドがないか

講評をユーザーに示し、必要な修正を DSL に反映します。修正時の方針:

- ユーザーが触れていない部分は原則そのまま保持する（ゼロから作り直さない）。
- 「○枚目を直して」「△△のスライドを追加」「この数字をグラフに」等の指示に的確に対応する。
- 矛盾する指示があれば、最後の指示を優先する。
- 修正後は必ず更新後の DSL 全文をファイルに保存し、レンダ（4.）をやり直す。

生成した pptx を人がパワポで直接編集した場合、文言差分だけを DSL 側に反映したいことがあります。
その際は次を使います（構造変更は同期対象外。文言変更のみ）。

```bash
scripts/slidegen.sh sync deck.slide edited.pptx --apply
```

## 既存 pptx の取り込み

「このパワポを DSL に取り込みたい」という依頼には、まず構造スペックを抽出します。

```bash
scripts/slidegen.sh inspect deck.pptx
```

出力される構造スペック（図形種別・配置・色・テキスト等の機械抽出結果）を、
[references/import-deck-prompt.md](references/import-deck-prompt.md) の指示に従って DSL に
再構成してください。数値（chart/table のセル値）は抽出結果をそのまま使い、捏造や丸め直しは
しないこと。再構成した DSL は 4.（レンダ）に進めます。

## トラブルシュート

- `uv: command not found` 等が出る場合、uv が未導入です。
  https://docs.astral.sh/uv/getting-started/installation/ を案内してください。
- リポジトリが private の環境で `uvx --from git+...` が認証エラーになる場合、
  実行環境の git に GitHub 認証（`gh auth setup-git` 等）が必要です。
- Windows では `scripts/slidegen.sh` の実行に bash（git-bash 等）が必要です。使えない場合は
  上記「直接実行」の `uv run` / `uvx` コマンドを PowerShell 等から直接叩いてください。
- 未知の型やプロパティでエラーになったら、type 名の綴りを疑い dsl-reference.md を再読してください。
  型の正本は常に dsl-reference.md（＝実装 `RENDERERS` と CI で同値保証）です。
