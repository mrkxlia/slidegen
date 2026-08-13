# slidegen 仕様書（spec）

> 本書は「**どう動くか**」を定義する。要件（なぜ/何を）は [requirements.md](requirements.md)。
> 深掘りは各 docs にリンクし、本書は**索引兼サマリ**として薄く保つ。
> 最終更新: 2026-08-13

---

## 1. DSL（記法）仕様 — `slidegen/parser.py`

- **構造**: 1行目 `slide <型>` で型宣言。インデントは**半角スペース2つ**で階層を表す。
- **プロパティ**: `key "値"`。多値は `key "v1" "v2" …` → `key` に先頭、`key_list` に全体を保持。
- **要素ブロック**: `col "タイトル" [highlight]`。配下に `ラベル "値"`（→ rows）または `"値"`（→ lines、箇条書き）。
- **区切り/コメント**: 単独行 `---` で複数スライドを分割。行頭 `#` はコメント。
- **強調**: 手段は **2つだけ** — col の `highlight` と、本文中の `{語句}`（→ accent 色＋太字）。
  座標・色・フォント・サイズは**書けない／書かない**（デザイン制約を構造的に担保）。
- **主なプロパティ**: `kicker` / `headline` / `foot` / `title` / `subtitle` / `source` / `categories` / `unit` / `columns` ほか。
- **型カタログ**: 9基底 × variant × 中身。一覧は [docs/type_catalog.md](docs/type_catalog.md)、
  網羅の**単一情報源は `slidegen/render.py` の `RENDERERS`（計 100 型）**。
- **チャート型**: 専用の型名（`bar_chart`/`line_chart`/`stacked_bar`/`stacked_100_bar`/`bar_horizontal`/`clustered_bar`）を
  slide の型に使う。`categories`（横軸）＋ `col`（=系列名）配下に**数値だけの行**。詳細は
  [docs/system_prompt.md](docs/system_prompt.md)（設計参照）／ ライブ定義は
  `skills/slidegen/references/dsl-reference.md`。

## 2. ライブラリ public API — `slidegen/api.py`

| 関数 | 返り値 | 用途 |
|---|---|---|
| `render_text(text, *, theme=DEFAULT_THEME, template=None)` | `Presentation` | python-pptx オブジェクト |
| `render_to_bytes(text, *, theme, template)` | `bytes` | メモリ完結。HTTP レスポンスにそのまま載せられる |
| `render_file(input_path, output_path, *, theme, template)` | `Path` | ファイル入出力 |

- `theme`: `slidegen/theme.py` の `Theme`（配色3カテゴリ 70:25:5、フォント1種、pt サイズ群）。
  既定 `DEFAULT_THEME` は青系（main `1F3A5F`）＋赤アクセント（`E2483D`）。**※ Web UI のテーマとは別物**。
- `template` 指定時は potx/pptx を土台にする（未指定時は 16:9 白紙）。

## 3. CLI — `slidegen/__main__.py`（`slidegen` コマンド）

```
slidegen build <input.slide> -o <out.pptx> [--template <company.potx>]
slidegen sync  <original.slide> <edited.pptx> [--apply] [-o <updated.slide>]
```
- `build` は `api.render_file` を、`sync` は `slidegen/sync.py` を利用。
- 後方互換: `python -m slidegen.cli` / `python -m slidegen.sync` も動く。

## 4. レンダリング規約 — `slidegen/render.py`（必達要件 R0 の実装）

- 白紙レイアウト `slide_layouts[6]` を使い、継承プレースホルダを除去（全ページ透け対策）。
- 16:9（13.333×7.5 inch）、座標は Inches/Pt、すべて**ネイティブ要素**（テキストフレーム/シェイプ/`add_table`）。
- 色・フォントは **`theme` 経由のみ**、影なし、強調は accent のみ。新型は `render_<type>()` を足し `register` する。
