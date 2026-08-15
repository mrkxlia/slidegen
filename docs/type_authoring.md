# 型を作るワークフロー（Web・画像・PowerPoint → 記法 or 新型）

既存の「わかりやすいスライド」を取り込んで、本システムで再現できるようにする手順。
2つのレベルがある。**まず①を試し、当てはまらないときだけ②に進む。**

```
入力（Web / 画像 / pptx）
   │
   ├─[①記法の逆生成] 既存の型カタログに当てはまる？  → YES: 記法(.slide)を書くだけ
   │
   └─[②新型の追加]   当てはまらない構造だ           → 型スペック(JSON) → render関数
```

---

## レベル①：記法の逆生成（既存型に当てはめる）

ほとんどのスライドはこれで足りる。Claude（ビジョン可）に画像/URL/抽出結果を見せ、
`skills/slidegen/references/dsl-reference.md`（DSL リファレンスの正本）を渡して
「対応する記法を書いて」と頼む。

### 入力別の前処理
- **画像**：そのまま Claude に見せる（ビジョンで構造を読む）。
- **Web**：スクリーンショットを撮るか、`web_fetch` で内容を取り、レイアウトを言語化させる。
- **pptx**：`python -m slidegen.inspect_pptx deck.pptx` で構造JSONを出し、Claudeに渡す。
  （`extract-text deck.pptx` で文字も取れる）

### 当てはめのプロンプト例
```
次のスライドを、添付の dsl-reference.md のルールに従って
記法(.slide)に変換して。新しい色やレイアウトは作らず、一番近い既存typeを選ぶこと。
出力は記法のみ。
[ここに 画像 / inspect結果JSON / 説明 ]
```
→ 出てきた .slide を `python -m slidegen.cli x.slide -o x.pptx` で生成して確認。

---

## レベル②：新型の追加（カタログにない構造のとき）

### Step 1. 型スペック(JSON)を起こす
Claude に、入力を見て下記スキーマの JSON を書かせる。これが中間表現（MNPの記法設計をAIに任せる発想と同じ）。
```json
{
  "name": "feature_grid",
  "intent": "特徴を3〜6個グリッドで見せる",
  "uses_header": true,
  "uses_foot": true,
  "element": "col",
  "count_rule": "3..6",
  "layout": "grid",          // grid | columns | rows | centered | table
  "highlight": "accent",
  "regions": [
    {"role": "title", "size": "col_title"},
    {"role": "desc",  "size": "body"}
  ]
}
```
pptx入力なら `inspect_pptx` の出力（位置%・配色面積比・フォント階層）が根拠になる。
配色面積比が 70:25:5 から大きく外れていたら、**取り込まず**ベース寄りに正規化する
（元スライドの色をそのまま真似ない。デザイン制約を優先する）。

### Step 2. render関数の雛形を生成
```
python -m slidegen.scaffold_type typespec.json -o slidegen/render_feature_grid.py
```

### Step 3. 雛形の TODO を実装
`add_rect / add_text / add_hline` だけで配置を書く。**新色・新フォントを足さない**（theme経由のみ）。
強調は accent のみ。末尾の `R.RENDERERS["feature_grid"] = ...` で自動登録される。

### Step 4. __init__.py で読み込み
`render_more` と同様に `from . import render_feature_grid` を追加（import副作用で登録）。

### Step 5. dsl-reference.md に型の書式を追記
AIがその型の記法を書けるよう、`skills/slidegen/references/dsl-reference.md` に使い方と例を
1ブロック足す（**必須**。`tests/test_dsl_reference.py` が「教える型 ≡ RENDERERS」を CI で
機械保証しており、怠ると CI が落ちる）。

### Step 6. QA
サンプル記法を1枚作り、生成→画像化→目視（pptx skillのVisual QA手順）。
チェック：はみ出し・重なり・余白・配色比・強調が1箇所か。

---

## 役割分担（なぜこの設計か）

- **決定的に読める部分はコード**（inspect_pptx：位置・色・サイズの抽出）
- **意味の解釈はLLM**（これはgrid型だ、3〜6個だ、という判断）
- **雛形生成はコード**（scaffold_type：定型コードを吐く）
- **詰めはLLM**（社内Claude Codeが配置を実装）

この分業により、毎回ゼロからレイアウトを起こさず、既存の安全な部品（theme/共通ヘルパー）の
上に新型を積める。デザイン制約と編集可能性が新型でも自動的に守られる。
