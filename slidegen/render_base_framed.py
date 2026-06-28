"""
render_base_framed.py — 基底レイアウト `framed_canvas` と variant ラッパー群。

外枠（装飾枠）の中にコンテンツを収める基底。式次第 / 賞状 / 挨拶状 /
セレモニー案内など、フォーマルで枠のある文書系を吸収する。
過度な装飾は避け、細い二重枠＋中央寄せの上品な構成にする（設計思想：装飾最小）。

variant:
  mode : "program"(式次第・番号付き進行) | "greeting"(挨拶状・縦書き風の本文) |
         "certificate"(賞状風) | "announcement"(案内)

記法例(program):
  slide program
    headline "開会式 式次第"
    col "開会の辞"
    col "来賓挨拶"
    col "記念講演"
    col "閉会の辞"

記法例(greeting):
  slide greeting
    headline "退職のご挨拶"
    body "このたび一身上の都合により…"
    sign "2026年3月 山田太郎"
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis


VARIANTS = {
    "program":      {"mode": "program"},
    "greeting":     {"mode": "greeting"},
    "certificate":  {"mode": "certificate"},
    "announcement": {"mode": "announcement"},
}


def _resolve(data: Slide) -> dict:
    name = data.props.get("variant") or data.type
    return dict(VARIANTS.get(name, {"mode": "program"}))


def _frame(slide, theme):
    """細い二重枠（外枠＋内枠）。塗りなし・線のみ。"""
    m1 = Inches(0.35)
    outer = add_rect(slide, int(m1), int(m1), int(SLIDE_W - m1 * 2),
                     int(SLIDE_H - m1 * 2), theme, "base", rounded=False)
    outer.fill.background()
    outer.line.color.rgb = theme.rgb("main"); outer.line.width = Pt(2.0)
    outer.shadow.inherit = False
    m2 = Inches(0.5)
    inner = add_rect(slide, int(m2), int(m2), int(SLIDE_W - m2 * 2),
                     int(SLIDE_H - m2 * 2), theme, "base", rounded=False)
    inner.fill.background()
    inner.line.color.rgb = theme.rgb("muted"); inner.line.width = Pt(0.75)
    inner.shadow.inherit = False


def render_framed_canvas(slide, data: Slide, theme):
    v = _resolve(data)
    mode = v["mode"]
    _frame(slide, theme)

    head = data.props.get("headline", "")
    cx = SLIDE_W / 2

    # タイトル（中央上）
    add_text(slide, MARGIN, Inches(1.0), CONTENT_W, Inches(1.0), theme,
             head, size=32, color_name="ink", bold=True,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_hline(slide, int(cx - Inches(1.0)), int(Inches(2.0)),
              int(Inches(2.0)), theme, "accent", weight=2.0)

    if mode == "program":
        # 番号付き進行を中央に縦並び
        items = data.blocks
        n = len(items)
        if n:
            list_top = Inches(2.6)
            row_h = min(Inches(0.7), (SLIDE_H - Inches(3.4)) / max(n, 1))
            for i, b in enumerate(items):
                y = list_top + i * row_h
                add_text(slide, int(cx - Inches(2.6)), int(y), Inches(0.8), row_h, theme,
                         f"{i+1}.", size=18, color_name="accent", bold=True,
                         align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
                add_text(slide, int(cx - Inches(1.6)), int(y), Inches(4.2), row_h, theme,
                         b.title, size=18, color_name="ink",
                         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)

    elif mode in ("greeting", "announcement"):
        body = data.props.get("body", "")
        add_text(slide, MARGIN + Inches(0.6), Inches(2.6),
                 CONTENT_W - Inches(1.2), SLIDE_H - Inches(4.2), theme,
                 split_emphasis(body), size=16, color_name="ink",
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
        sign = data.props.get("sign", "")
        if sign:
            add_text(slide, MARGIN + Inches(0.6), SLIDE_H - Inches(1.6),
                     CONTENT_W - Inches(1.2), Inches(0.8), theme, sign,
                     size=16, color_name="ink",
                     align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)

    else:  # certificate
        body = data.props.get("body", "")
        add_text(slide, MARGIN, SLIDE_H * 0.42, CONTENT_W, Inches(2.0), theme,
                 split_emphasis(body), size=20, color_name="ink",
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        sign = data.props.get("sign", "")
        if sign:
            add_text(slide, MARGIN, SLIDE_H - Inches(1.8), CONTENT_W, Inches(0.8),
                     theme, sign, size=16, color_name="ink",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)


R.register_many(["framed_canvas", *VARIANTS], render_framed_canvas)
