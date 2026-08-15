"""
render_life.py — 個人・イベント・ライフの個別型（S5g）。

- event_timetable : イベントのタイムテーブル（時刻バッジ＋内容の行リスト）。式次第
                    （program、framed_canvas variant）と近いが、時刻列を持つ点が差別化。
- maturity_model  : 成熟度モデル（横方向N段階、右ほど成熟＝カードが階段状に高くなる）。
                    既存に「横方向・段階上昇」の表現が無いための新規実装。

設計思想：標準プリセット図形のみ・回転禁止。色は theme 経由。
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

from . import render as R
from .render import (add_rect, add_text, render_header, render_foot,
                     SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide
from .render_util import columns_geometry


def _add_outline_rect(slide, theme, x, y, w, h, color_name, weight=2.5):
    """塗りなし・枠線のみの矩形（marimekko/treemap/layered_stack等と同じ手法。
    線なので P2 accent算入対象外。面積の大きい段のhighlightで使う）。"""
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, int(x), int(y), int(w), int(h))
    shp.fill.background()
    shp.line.color.rgb = theme.rgb(color_name)
    shp.line.width = Pt(weight)
    shp.shadow.inherit = False
    return shp


# ---------------------------------------------------------------------------
# event_timetable（時刻バッジ＋内容の行リスト）
#   col "10:00"        # title=時刻
#     "開会の挨拶"       # lines[0]=項目名
#     "主催: 山田"       # lines[1:]=補足（任意）
# ---------------------------------------------------------------------------
_EVENT_TIMETABLE_MAX = 10


def render_event_timetable(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    rows = data.blocks[:_EVENT_TIMETABLE_MAX]
    n = len(rows)
    if n == 0:
        return

    bottom = SLIDE_H - Inches(0.7)
    y0 = top + Inches(0.1)
    gap = Inches(0.1)
    rh = min(Inches(0.65), (bottom - y0 - gap * (n - 1)) / n)
    time_w = Inches(1.3)

    for i, b in enumerate(rows):
        y = y0 + i * (rh + gap)
        color = "accent" if b.highlight else "main"
        add_rect(slide, int(MARGIN), int(y), int(time_w), int(rh), theme, color, rounded=True)
        add_text(slide, int(MARGIN), int(y), int(time_w), int(rh), theme, b.title,
                 size=14, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        dx = MARGIN + time_w + Inches(0.2)
        dw = CONTENT_W - time_w - Inches(0.2)
        add_rect(slide, int(dx), int(y), int(dw), int(rh), theme, "base_2", rounded=True)
        text = "　".join(b.lines) if b.lines else ""
        add_text(slide, int(dx + Inches(0.15)), int(y), int(dw - Inches(0.3)), int(rh),
                 theme, text, size=13, color_name="ink",
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# maturity_model（横方向N段階、右ほど成熟＝カードが階段状に高くなる）
#   col "Level 1｜属人的"
#     "Excelで個別集計"
#   col "Level 3｜標準化" highlight
#     "共通ダッシュボード"
# ---------------------------------------------------------------------------
_MATURITY_MAX = 6


def render_maturity_model(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:_MATURITY_MAX]
    n = len(blocks)
    if n == 0:
        return

    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    gap = Inches(0.2)
    bw = columns_geometry(CONTENT_W, n, gap)
    min_h = avail_h * 0.32
    max_h = avail_h * 0.92

    for i, blk in enumerate(blocks):
        x = MARGIN + i * (bw + gap)
        frac = i / (n - 1) if n > 1 else 1.0
        bh = min_h + (max_h - min_h) * frac
        y = bottom - bh
        add_rect(slide, int(x), int(y), int(bw), int(bh), theme, "main", rounded=True)
        if blk.highlight:
            # 段は面積が大きくaccent塗りだとP2(8%上限)を超過しやすいため枠線のみで強調
            # （layered_stack/er_diagramと同じ判断）。
            _add_outline_rect(slide, theme, x, y, bw, bh, "accent")
        add_text(slide, int(x + Inches(0.06)), int(y + Inches(0.08)), int(bw - Inches(0.12)),
                 Inches(0.55), theme, blk.title, size=12, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)
        if blk.lines:
            add_text(slide, int(x + Inches(0.08)), int(y + Inches(0.65)), int(bw - Inches(0.16)),
                     int(bh - Inches(0.75)), theme, "　".join(blk.lines), size=10,
                     color_name="on_main", align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)


R.register("event_timetable", render_event_timetable)
R.register("maturity_model", render_maturity_model)
