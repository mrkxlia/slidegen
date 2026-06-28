"""
render_frameworks.py — ビジネスフレーム個別型。

基底では吸収しきれない、固定の意味論を持つフレームを専用実装する。
- swot     : 2x2固定（強み/弱み/機会/脅威）。軸ラベル・色固定。
- venn2    : 2円の重なり（共通点/相違点）。標準OVALのみ。
- pyramid_levels : N段ピラミッド（既存pyramidと別に、各段ラベル＋説明）

設計思想：標準図形のみ。色は theme 経由。
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

from . import render as R
from .render import (add_rect, add_text, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis
from .render_base_labeled import _block_items, _add_items_text


# ---------------------------------------------------------------------------
# SWOT（2x2固定）
# ---------------------------------------------------------------------------
_SWOT = [
    ("Strengths｜強み",     "main"),
    ("Weaknesses｜弱み",   "muted"),
    ("Opportunities｜機会", "main_2"),
    ("Threats｜脅威",       "accent"),
]


def render_swot(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:4]
    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    gap = Inches(0.25)
    cw = (CONTENT_W - gap) / 2
    ch = (avail_h - gap) / 2

    for i in range(4):
        r, c = divmod(i, 2)
        x = MARGIN + c * (cw + gap)
        y = top + r * (ch + gap)
        label, color = _SWOT[i]
        # カード地
        add_rect(slide, x, y, cw, ch, theme, "base_2", rounded=True)
        # 見出し帯
        head_h = Inches(0.5)
        add_rect(slide, x, y, cw, head_h, theme, color, rounded=True)
        add_text(slide, x, y, cw, head_h, theme, label,
                 size=14, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 中身
        if i < len(blocks):
            items = _block_items(blocks[i])
            _add_items_text(slide, x + Inches(0.18), y + head_h + Inches(0.12),
                            cw - Inches(0.36), ch - head_h - Inches(0.24), theme,
                            items, size=13, anchor=MSO_ANCHOR.TOP,
                            bullet=(len(items) > 1))


# ---------------------------------------------------------------------------
# Venn（2円の重なり）
# ---------------------------------------------------------------------------
def render_venn2(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    bottom = SLIDE_H - Inches(0.7)
    cy = (top + bottom) / 2
    d = min(Inches(3.6), (bottom - top))
    overlap = d * 0.32
    cx = SLIDE_W / 2
    lx = cx - d + overlap / 2
    rx = cx - overlap / 2

    def circle(x, color, alpha_label):
        shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, int(x), int(cy - d / 2), int(d), int(d))
        shp.fill.solid(); shp.fill.fore_color.rgb = theme.rgb(color)
        shp.line.color.rgb = theme.rgb("base"); shp.line.width = Pt(1.5)
        shp.shadow.inherit = False
        # 透過は環境差が出るので使わず、塗りベタ＋重なりは後段テキストで表現
        return shp

    circle(lx, "main", "L")
    circle(rx, "main_2", "R")

    labels = data.blocks
    # 左/重なり/右 のラベル（col 3つを想定）
    texts = [(_join(b)) for b in labels[:3]]
    if len(texts) >= 1:
        add_text(slide, int(lx), int(cy - Inches(0.4)), int(d - overlap), Inches(0.8),
                 theme, texts[0], size=14, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    if len(texts) >= 3:
        add_text(slide, int(rx + overlap), int(cy - Inches(0.4)), int(d - overlap), Inches(0.8),
                 theme, texts[2], size=14, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    if len(texts) >= 2:
        add_text(slide, int(cx - overlap), int(cy - Inches(0.4)), int(overlap * 2), Inches(0.8),
                 theme, texts[1], size=12, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def _join(b):
    parts = [b.title] if b.title else []
    parts += list(b.lines)
    return "  ".join(p for p in parts if p)


R.register("swot", render_swot)
R.register("venn2", render_venn2)
