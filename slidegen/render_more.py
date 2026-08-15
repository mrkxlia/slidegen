"""
render_more.py — 追加の型レンダラ群。

Web調査（プレゼン55パターン等）で頻出かつ「レイアウト構造として」価値のあるものを実装。
55パターンの多くは "内容の役割"（表紙/会社紹介/料金…）であり、レイアウトとしては
少数の汎用構造に集約できる。ここではその汎用構造を型として用意する。

すべて render.py の共通ヘルパー（add_rect/add_text/add_hline/render_header/render_foot）を再利用し、
§2-bis（編集可能・ネイティブ要素のみ）と §3（デザイン制約・強調はaccentのみ）を厳守する。
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis
from .render_util import columns_geometry


# ---------------------------------------------------------------------------
# title（表紙）— タイトル中央。装飾は最小（accent lineは使わない / skill準拠）
# ---------------------------------------------------------------------------
def render_title(slide, data: Slide, theme):
    # 背景をメイン色のベタにして表紙らしく（sandwich構造の表紙側）
    add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme, "main")
    title = data.props.get("headline") or data.props.get("title") or ""
    sub = data.props.get("subtitle") or data.props.get("kicker") or ""
    add_text(slide, MARGIN, SLIDE_H/2 - Inches(1.0), CONTENT_W, Inches(1.4), theme,
             split_emphasis(title), size=40, color_name="on_main", bold=True,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
    if sub:
        add_text(slide, MARGIN, SLIDE_H/2 + Inches(0.4), CONTENT_W, Inches(0.6), theme,
                 sub, size=18, color_name="on_main", align=PP_ALIGN.LEFT)
    foot = data.props.get("foot")
    if foot:
        add_text(slide, MARGIN, SLIDE_H - Inches(0.9), CONTENT_W, Inches(0.4), theme,
                 foot, size=12, color_name="on_main", align=PP_ALIGN.LEFT)


# ---------------------------------------------------------------------------
# section（セクション／ブリッジ／中表紙）— 番号＋見出しのみ。箸休め
# ---------------------------------------------------------------------------
def render_section(slide, data: Slide, theme):
    add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme, "base_2")
    # 左に太いメインの帯（ribbon ではなく区切りの意味づけ）
    add_rect(slide, 0, 0, Inches(0.25), SLIDE_H, theme, "main")
    num = data.props.get("kicker", "")
    title = data.props.get("headline") or data.props.get("title") or ""
    if num:
        add_text(slide, MARGIN, SLIDE_H/2 - Inches(1.2), CONTENT_W, Inches(0.7), theme,
                 num, size=20, color_name="muted", bold=True, anchor=MSO_ANCHOR.MIDDLE)
    add_text(slide, MARGIN, SLIDE_H/2 - Inches(0.5), CONTENT_W, Inches(1.2), theme,
             split_emphasis(title), size=34, color_name="ink", bold=True,
             anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# bullets（箇条書き / ポイント / 概要）— 左にメッセージ、項目を縦に。番号バッジ付き
# ---------------------------------------------------------------------------
def render_bullets(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    # blocks の各 col を1項目として扱う（title=見出し, lines=説明）
    items = data.blocks
    if not items:
        return
    bottom = SLIDE_H - Inches(0.7)
    gap = Inches(0.2)
    row_h = columns_geometry(bottom - top, len(items), gap)
    for i, blk in enumerate(items):
        y = top + i*(row_h+gap)
        # 番号バッジ
        b = min(row_h*0.55, Inches(0.55))
        color = "accent" if blk.highlight else "main"
        add_rect(slide, MARGIN, y + (row_h-b)/2, b, b, theme, color, rounded=True)
        add_text(slide, MARGIN, y + (row_h-b)/2, b, b, theme, str(i+1),
                 size=16, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 見出し＋説明
        tx = MARGIN + b + Inches(0.3)
        tw = CONTENT_W - b - Inches(0.3)
        add_text(slide, tx, y, tw, row_h*0.5, theme, split_emphasis(blk.title),
                 size=theme.sz_col_title, color_name="ink", bold=True, anchor=MSO_ANCHOR.MIDDLE)
        if blk.lines:
            add_text(slide, tx, y + row_h*0.48, tw, row_h*0.5, theme, " ".join(blk.lines),
                     size=13, color_name="muted", anchor=MSO_ANCHOR.TOP)


# ---------------------------------------------------------------------------
# cards（カードグリッド / 特徴・機能）— 2〜6個を 2列 or 3列グリッドに
# ---------------------------------------------------------------------------
def render_cards(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    n = len(data.blocks)
    if n == 0:
        return
    cols = 2 if n <= 4 else 3
    rows = (n + cols - 1) // cols
    gap = Inches(0.3)
    cell_w = columns_geometry(CONTENT_W, cols, gap)
    bottom = SLIDE_H - Inches(0.7)
    cell_h = columns_geometry(bottom - top, rows, gap)
    for i, blk in enumerate(data.blocks):
        r, c = divmod(i, cols)
        x = MARGIN + c*(cell_w+gap)
        y = top + r*(cell_h+gap)
        add_rect(slide, x, y, cell_w, cell_h, theme, "base_2", rounded=True)
        # 左に小さなメイン/accentのアクセント四角（アイコン代わり・控えめ）
        chip = Inches(0.35)
        color = "accent" if blk.highlight else "main"
        add_rect(slide, x + Inches(0.3), y + Inches(0.3), chip, chip, theme, color, rounded=True)
        add_text(slide, x + Inches(0.3), y + Inches(0.75), cell_w - Inches(0.6), Inches(0.5), theme,
                 split_emphasis(blk.title), size=16, color_name="ink", bold=True)
        if blk.lines:
            add_text(slide, x + Inches(0.3), y + Inches(1.25), cell_w - Inches(0.6), cell_h - Inches(1.4),
                     theme, " ".join(blk.lines), size=12, color_name="muted")


# ---------------------------------------------------------------------------
# takeaways_emoji（絵文字+短文のグリッド）— cards と同じグリッド計算。chip四角の代わりに
#   col.title の絵文字を大きく中央表示する。highlightは絵文字の文字色をaccent化で表現
#   （セル塗りにすると面積が大きくP2を超過しやすいため。S5cで確立した判断を踏襲）。
# ---------------------------------------------------------------------------
def render_takeaways_emoji(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    n = len(data.blocks)
    if n == 0:
        return
    cols = 2 if n <= 4 else 3
    rows = (n + cols - 1) // cols
    gap = Inches(0.3)
    cell_w = columns_geometry(CONTENT_W, cols, gap)
    bottom = SLIDE_H - Inches(0.7)
    cell_h = columns_geometry(bottom - top, rows, gap)
    for i, blk in enumerate(data.blocks):
        r, c = divmod(i, cols)
        x = MARGIN + c * (cell_w + gap)
        y = top + r * (cell_h + gap)
        add_rect(slide, x, y, cell_w, cell_h, theme, "base_2", rounded=True)
        emoji = blk.title or "・"
        add_text(slide, x, y + Inches(0.15), cell_w, Inches(0.7), theme, emoji,
                 size=32, color_name=("accent" if blk.highlight else "ink"),
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if blk.lines:
            add_text(slide, x + Inches(0.25), y + Inches(0.95), cell_w - Inches(0.5),
                     cell_h - Inches(1.1), theme, " ".join(blk.lines), size=13,
                     color_name="ink", align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)


# ---------------------------------------------------------------------------
# pros_cons（メリット・デメリット）— 2カラム、左メリット(main)/右デメリット(muted)
# ---------------------------------------------------------------------------
def render_pros_cons(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:2]
    if not blocks:
        return
    gap = Inches(0.4)
    col_w = columns_geometry(CONTENT_W, 2, gap)
    bottom = SLIDE_H - Inches(0.7)
    col_h = bottom - top
    head_colors = ["main", "muted"]
    for i, blk in enumerate(blocks):
        x = MARGIN + i*(col_w+gap)
        add_rect(slide, x, top, col_w, col_h, theme, "base_2", rounded=True)
        hh = Inches(0.55)
        hc = "accent" if blk.highlight else head_colors[min(i, 1)]
        add_rect(slide, x, top, col_w, hh, theme, hc, rounded=True)
        add_text(slide, x, top, col_w, hh, theme, blk.title, size=theme.sz_col_title,
                 color_name="on_main", bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 箇条書き（lines）
        items = blk.lines if blk.lines else [v for _, v in blk.rows]
        if items:
            iy = top + hh + Inches(0.3)
            ih = (col_h - hh - Inches(0.5)) / len(items)
            for j, it in enumerate(items):
                add_text(slide, x + Inches(0.4), iy + j*ih, col_w - Inches(0.7), ih, theme,
                         "・" + it, size=14, color_name="ink", anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# table（早見表 / 比較表）— ★本物の PowerPoint テーブル（§2-bis ルール5）
# 記法：col を「行」とみなし、各 col の rows を列セルにする。最初の col をヘッダ行に。
# よりシンプルに：行を lines、ヘッダを props["columns"] で受ける設計にする。
# ---------------------------------------------------------------------------
def render_table(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    # blocks: 各 block.title = 行ラベル, block.lines = その行のセル値
    rows_data = data.blocks
    if not rows_data:
        return
    # 列数 = ヘッダ行のセル数（最初の行）。+1 は行ラベル列。
    ncol = 1 + max(len(b.lines) for b in rows_data)
    nrow = len(rows_data)
    bottom = SLIDE_H - Inches(0.8)
    tbl_h = bottom - top
    gfx = slide.shapes.add_table(nrow, ncol, MARGIN, top, CONTENT_W, tbl_h)
    table = gfx.table
    # スタイル：罫線は薄く、ヘッダ行のみmain地（python-pptxの既定スタイルを上書き）
    for ri, blk in enumerate(rows_data):
        cells = [blk.title] + list(blk.lines)
        for ci in range(ncol):
            cell = table.cell(ri, ci)
            cell.text = cells[ci] if ci < len(cells) else ""
            para = cell.text_frame.paragraphs[0]
            para.alignment = PP_ALIGN.LEFT if ci == 0 else PP_ALIGN.CENTER
            for run in para.runs:
                run.font.name = theme.font
                run.font.size = Pt(13)
                run.font.bold = (ri == 0) or (ci == 0)
                run.font.color.rgb = theme.rgb("on_main") if ri == 0 else theme.rgb("ink")
            # 塗り
            cell.fill.solid()
            if ri == 0:
                cell.fill.fore_color.rgb = theme.rgb("main")
            elif blk.highlight:
                cell.fill.fore_color.rgb = theme.rgb("main_3")
            else:
                cell.fill.fore_color.rgb = theme.rgb("base") if ri % 2 else theme.rgb("base_2")


# ---------------------------------------------------------------------------
# quote（想い / 問いかけ / コンセプト）— 大きな一文を中央に。装飾最小
# ---------------------------------------------------------------------------
def render_quote(slide, data: Slide, theme):
    add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme, "base_2")
    text = data.props.get("headline") or data.props.get("title") or ""
    add_text(slide, MARGIN*1.5, SLIDE_H/2 - Inches(1.2), CONTENT_W - MARGIN, Inches(2.4), theme,
             split_emphasis(text), size=30, color_name="ink", bold=True,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    sub = data.props.get("foot") or data.props.get("kicker")
    if sub:
        add_text(slide, MARGIN*1.5, SLIDE_H - Inches(1.3), CONTENT_W - MARGIN, Inches(0.5), theme,
                 sub, size=14, color_name="muted", align=PP_ALIGN.CENTER)


# ---------------------------------------------------------------------------
# agenda（目次）— 番号＋項目を縦に。シンプル
# ---------------------------------------------------------------------------
def render_agenda(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    items = data.blocks
    if not items:
        return
    bottom = SLIDE_H - Inches(0.8)
    row_h = (bottom - top) / len(items)
    for i, blk in enumerate(items):
        y = top + i*row_h
        color = "accent" if blk.highlight else "main"
        # 大きな番号
        add_text(slide, MARGIN, y, Inches(1.0), row_h, theme, f"{i+1:02d}",
                 size=24, color_name=color, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        add_text(slide, MARGIN + Inches(1.1), y, CONTENT_W - Inches(1.1), row_h, theme,
                 blk.title, size=18, color_name="ink", anchor=MSO_ANCHOR.MIDDLE)
        if i < len(items) - 1:
            add_hline(slide, MARGIN, y + row_h, CONTENT_W, theme, "rule", 1.0)


# 追加型を登録（render.RENDERERS にマージ）
R.register("title", render_title)
R.register("section", render_section)
R.register("bullets", render_bullets)
R.register("cards", render_cards)
R.register("takeaways_emoji", render_takeaways_emoji)
R.register("pros_cons", render_pros_cons)
R.register("table", render_table)
R.register("quote", render_quote)
R.register("agenda", render_agenda)
