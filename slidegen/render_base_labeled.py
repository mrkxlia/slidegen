"""
render_base_labeled.py — 基底レイアウト `labeled_blocks` と、その薄いラッパー型群。

3軸分解(基底 × variant × 中身)の実証実装。
- 基底 render_labeled_blocks() がレイアウト計算(座標)を全部引き受ける。
- variant 辞書がラベル文字列・配置・強調位置を供給する。
- 個別型(prep / kishotenketsu / retro_kpt ...) は variant を渡すだけの薄いラッパー。

これにより：
  * Sonnetは「中身(各ブロックの本文)」だけ書けばよい。ラベルも配置も座標も書かない。
  * 新型追加は VARIANTS 辞書への数行追記で済む。

記法例(prep):
  slide prep
    headline "新システム導入を提案する"
    col
      "現行システムは保守不能でSLA未達"
    col
      "競合は導入後に障害を80%削減"
    ...
  → variant は型名から自動解決(prep)。ラベル "Point/Reason/Example/Point" は辞書から。

記法例(汎用 labeled_blocks):
  slide labeled_blocks
    headline "..."
    variant "kpt"
    col ...
"""
from __future__ import annotations
from pptx.util import Inches
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import add_rect, add_text, render_header, render_foot, SLIDE_H, MARGIN, CONTENT_W
from .parser import Slide
from .render_util import variant_name, block_items, add_items_text


# ---------------------------------------------------------------------------
# variant 辞書：型/バリアント名 → ラベル列・配置・強調位置
#   labels    : 各ブロックのラベル(Noneなら col のtitleを使う)
#   layout    : "row"(横一列) | "col"(縦積み) | "grid"(2列折返し)
#   accent_idx: アクセント色にするブロック番号(0始まり / Noneなら強調なし)
#   bilingual : ラベルに英日併記する場合の補助(任意)
# ---------------------------------------------------------------------------
VARIANTS = {
    # ストーリー/話法フレーム ---------------------------------------------
    "prep": {
        "labels": ["Point｜結論", "Reason｜理由", "Example｜具体例", "Point｜結論"],
        "layout": "col", "accent_idx": 0,
    },
    "sds": {
        "labels": ["Summary｜要点", "Details｜詳細", "Summary｜まとめ"],
        "layout": "col", "accent_idx": 0,
    },
    "desc": {
        "labels": ["Describe｜描写", "Express｜表明", "Suggest｜提案", "Choose｜選択"],
        "layout": "col", "accent_idx": 2,
    },
    "kishotenketsu": {
        "labels": ["起", "承", "転", "結"],
        "layout": "row", "accent_idx": 2,   # 「転」を強調
    },
    "johakyu": {
        "labels": ["序", "破", "急"],
        "layout": "row", "accent_idx": 2,
    },
    # 分析/コンサル -------------------------------------------------------
    "feia": {
        "labels": ["Finding｜事実", "Evidence｜根拠", "Implication｜示唆", "Action｜打ち手"],
        "layout": "col", "accent_idx": 3,
    },
    "haikei": {  # 日本の提案標準：背景→課題→解決策→効果
        "labels": ["背景", "課題", "解決策", "効果"],
        "layout": "row", "accent_idx": 3,
    },
    # 振り返り(レトロ) ----------------------------------------------------
    "kpt": {
        "labels": ["Keep｜続ける", "Problem｜課題", "Try｜試す"],
        "layout": "row", "accent_idx": 2,
    },
    "ssc": {
        "labels": ["Start｜始める", "Stop｜やめる", "Continue｜続ける"],
        "layout": "row", "accent_idx": 0,
    },
    "fourls": {
        "labels": ["Liked｜良かった", "Learned｜学び", "Lacked｜不足", "Longed for｜欲しかった"],
        "layout": "grid", "accent_idx": None,
    },
    # フレームワーク ------------------------------------------------------
    "brand_pillars": {
        "labels": None,   # ラベルは col のtitleを使う
        "layout": "row", "accent_idx": None,
    },
    "sipoc": {
        "labels": ["Suppliers", "Inputs", "Process", "Outputs", "Customers"],
        "layout": "row", "accent_idx": 2,
    },
    "what_sowhat_nowwhat": {
        "labels": ["What｜何が", "So What｜だから何", "Now What｜次に何を"],
        "layout": "row", "accent_idx": 1,
    },
    # 教育 ---------------------------------------------------------------
    "5e": {
        "labels": ["Engage", "Explore", "Explain", "Elaborate", "Evaluate"],
        "layout": "row", "accent_idx": None,
    },
    "kwl": {
        "labels": ["K｜知っている", "W｜知りたい", "L｜学んだ"],
        "layout": "row", "accent_idx": None,
    },
}


def _resolve_variant(data: Slide) -> dict:
    """型名 or props['variant'] から variant 定義を引く。無ければ汎用デフォルト。"""
    v = VARIANTS.get(variant_name(data))
    if v:
        return v
    # 未知 → ブロック数から配置を自動決定、ラベルは col のtitle
    n = len(data.blocks)
    layout = "row" if n <= 4 else "grid"
    return {"labels": None, "layout": layout, "accent_idx": None}


def _block_label(variant: dict, i: int, blk) -> str:
    labels = variant.get("labels")
    if labels and i < len(labels):
        return labels[i]
    return blk.title  # ラベル未定義なら col のtitle


# ---------------------------------------------------------------------------
# 基底レンダラ：labeled_blocks
# ---------------------------------------------------------------------------
def render_labeled_blocks(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    variant = _resolve_variant(data)
    blocks = data.blocks
    n = len(blocks)
    if n == 0:
        return

    # variant でラベルが定義されていて、ブロック数が足りない場合に空ブロックは作らない
    # (Sonnet が4つ書くべきところ3つでも落ちないように、ある分だけ描く)
    accent_idx = variant.get("accent_idx")
    layout = variant.get("layout", "row")

    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    gap = Inches(0.28)

    # ---- 配置の決定 ----
    if layout == "col":
        # 縦積み：横幅いっぱいの帯を縦に並べる
        block_h = (avail_h - gap * (n - 1)) / n
        for i, blk in enumerate(blocks):
            y = top + i * (block_h + gap)
            _draw_block(slide, theme, MARGIN, y, CONTENT_W, block_h,
                        _block_label(variant, i, blk),
                        block_items(blk),
                        accent=(i == accent_idx) or blk.highlight,
                        label_side="left")
    elif layout == "grid":
        # 2列グリッド(2x2 等)
        cols = 2
        rows = (n + cols - 1) // cols
        cw = (CONTENT_W - gap * (cols - 1)) / cols
        ch = (avail_h - gap * (rows - 1)) / rows
        for i, blk in enumerate(blocks):
            r, c = divmod(i, cols)
            x = MARGIN + c * (cw + gap)
            y = top + r * (ch + gap)
            _draw_block(slide, theme, x, y, cw, ch,
                        _block_label(variant, i, blk),
                        block_items(blk),
                        accent=(i == accent_idx) or blk.highlight,
                        label_side="top")
    else:
        # 横一列(row)：カード高さは内容量に応じて抑える（縦間延び防止）
        cw = (CONTENT_W - gap * (n - 1)) / n
        # 全カード中の最大行数からカード高さを推定
        head_h = Inches(0.5)
        chars_per_line = max(6, int(cw / Inches(0.12)))  # 1行あたり概算文字数
        max_lines = 1
        for blk in blocks:
            max_lines = max(max_lines, _estimate_lines(block_items(blk), chars_per_line))
        line_h = Inches(0.30)
        content_h = head_h + Inches(0.3) + line_h * max_lines
        # スライドに収まる範囲でキャップ。最小1.6"、最大は利用可能高
        card_h = max(Inches(1.6), min(content_h, avail_h))
        for i, blk in enumerate(blocks):
            x = MARGIN + i * (cw + gap)
            _draw_block(slide, theme, x, top, cw, card_h,
                        _block_label(variant, i, blk),
                        block_items(blk),
                        accent=(i == accent_idx) or blk.highlight,
                        label_side="top")


def _estimate_lines(items, chars_per_line):
    """項目群がおよそ何行になるか概算（高さ抑制用）。"""
    total = 0
    for it in items:
        total += max(1, -(-len(it) // max(1, chars_per_line)))  # 切り上げ
    return max(total, len(items))


def _draw_block(slide, theme, x, y, w, h, label, items, *, accent, label_side):
    """1ブロックを描く。標準角丸長方形のみ使用。
    ヘッダー帯とカード地を小さな隙間で分離し、角丸の衝突を構造的に回避する。"""
    head_color = "accent" if accent else "main"
    multi = len(items) > 1
    sep = Inches(0.08)   # 帯とカード地の間の隙間（衝突回避＋視覚的な区切り）

    if label_side == "top":
        head_h = Inches(0.5)
        # ヘッダー帯（角丸長方形・単体）
        add_rect(slide, x, y, w, head_h, theme, head_color, rounded=True)
        add_text(slide, x, y, w, head_h, theme, label,
                 size=14, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # カード地（角丸長方形・単体・帯の下に隙間を空けて配置）
        body_y = y + head_h + sep
        body_h = h - head_h - sep
        add_rect(slide, x, body_y, w, body_h, theme, "base_2", rounded=True)
        if items:
            add_items_text(slide, x + Inches(0.18), body_y + Inches(0.1),
                            w - Inches(0.36), body_h - Inches(0.2), theme,
                            items, size=13, anchor=MSO_ANCHOR.TOP, bullet=multi)
    else:  # 左ラベル帯
        label_w = Inches(2.3)
        # ラベル帯（角丸長方形・単体）
        add_rect(slide, x, y, label_w, h, theme, head_color, rounded=True)
        add_text(slide, x + Inches(0.15), y, label_w - Inches(0.3), h, theme, label,
                 size=15, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # カード地（角丸長方形・単体・帯の右に隙間を空けて配置）
        body_x = x + label_w + sep
        body_w = w - label_w - sep
        add_rect(slide, body_x, y, body_w, h, theme, "base_2", rounded=True)
        if items:
            add_items_text(slide, body_x + Inches(0.25), y,
                            body_w - Inches(0.45), h, theme,
                            items, size=14, anchor=MSO_ANCHOR.MIDDLE, bullet=multi)


# 基底 + 全ラッパーを登録
R.register_many(["labeled_blocks", *VARIANTS], render_labeled_blocks)
