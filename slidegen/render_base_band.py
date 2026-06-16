"""
render_base_band.py — 基底レイアウト `band_strip` と variant ラッパー群。

水平または垂直の「帯」を主役にする基底。
section（中表紙）/ sidebar（縦帯＋本文）/ data_source_footer（下部に出典帯）/
chapter（章番号帯）などを吸収する。

variant:
  mode : "section"(中央の大見出し帯) | "sidebar"(左縦帯+本文) |
         "footer"(下部に出典帯) | "chapter"(上部に章番号帯)

記法例(section_band):
  slide section_band
    headline "第2章 設計方針"
    caption "なぜこのアーキテクチャを選ぶか"

記法例(source_footer):
  slide source_footer
    headline "売上は前年比120%"
    source "社内Salesforce"
    period "2025-07〜2025-09"
    note "解約・無料分を除外"
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis
from .render_base_labeled import _block_items, _add_items_text


VARIANTS = {
    "section_band": {"mode": "section"},
    "sidebar":      {"mode": "sidebar"},
    "source_footer":{"mode": "footer"},
    "chapter_band": {"mode": "chapter"},
}


def _resolve(data: Slide) -> dict:
    name = data.props.get("variant") or data.type
    return dict(VARIANTS.get(name, {"mode": "section"}))


def render_band_strip(slide, data: Slide, theme):
    v = _resolve(data)
    mode = v["mode"]

    if mode == "section":
        # 画面中央に太い帯、その上に章タイトル
        band_y = SLIDE_H * 0.38
        band_h = Inches(1.4)
        add_rect(slide, 0, int(band_y), SLIDE_W, int(band_h), theme, "main", rounded=False)
        head = data.props.get("headline", "")
        add_text(slide, MARGIN, int(band_y), CONTENT_W, int(band_h), theme,
                 split_emphasis(head), size=40, color_name="on_main", bold=True,
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        cap = data.props.get("caption", "")
        if cap:
            add_text(slide, MARGIN, int(band_y + band_h + Inches(0.2)),
                     CONTENT_W, Inches(0.8), theme, cap, size=20, color_name="muted",
                     align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)

    elif mode == "chapter":
        # 上部に細い章番号帯
        num = data.props.get("number", "")
        head = data.props.get("headline", "")
        band_h = Inches(0.9)
        add_rect(slide, 0, 0, SLIDE_W, int(band_h), theme, "main", rounded=False)
        add_text(slide, MARGIN, 0, Inches(1.6), int(band_h), theme, num,
                 size=30, color_name="on_main", bold=True,
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        add_text(slide, MARGIN + Inches(1.6), 0, CONTENT_W - Inches(1.6), int(band_h),
                 theme, head, size=24, color_name="on_main", bold=True,
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)

    elif mode == "sidebar":
        # 左に縦帯（見出し）、右に本文
        sb_w = CONTENT_W * 0.32
        add_rect(slide, 0, 0, int(MARGIN + sb_w), SLIDE_H, theme, "main", rounded=False)
        head = data.props.get("headline", "")
        add_text(slide, MARGIN * 0.6, SLIDE_H * 0.3, int(sb_w), Inches(2.0), theme,
                 split_emphasis(head), size=28, color_name="on_main", bold=True,
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
        # 本文（最初のブロックの items）
        bx = MARGIN + sb_w + Inches(0.5)
        bw = SLIDE_W - bx - MARGIN
        if data.blocks:
            items = _block_items(data.blocks[0])
            _add_items_text(slide, int(bx), SLIDE_H * 0.28, int(bw), SLIDE_H * 0.5,
                            theme, items, size=16, anchor=MSO_ANCHOR.TOP,
                            bullet=(len(items) > 1))

    else:  # footer：本文＋下部に出典帯
        top = render_header(slide, data, theme)
        # 本文（あればブロック、なければ空）
        if data.blocks:
            items = _block_items(data.blocks[0])
            _add_items_text(slide, MARGIN, top + Inches(0.2), CONTENT_W,
                            SLIDE_H - top - Inches(1.4), theme, items,
                            size=16, anchor=MSO_ANCHOR.TOP, bullet=(len(items) > 1))
        # 下部の出典帯
        parts = []
        for k in ("source", "period", "note"):
            val = data.props.get(k)
            if val:
                tag = {"source": "出典", "period": "期間", "note": "注"}[k]
                parts.append(f"{tag}: {val}")
        n = data.props.get("n")
        if n:
            parts.append(f"N={n}")
        if parts:
            fy = SLIDE_H - Inches(0.9)
            add_rect(slide, 0, int(fy), SLIDE_W, Inches(0.9), theme, "base_2", rounded=False)
            add_text(slide, MARGIN, int(fy), CONTENT_W, Inches(0.9), theme,
                     "　／　".join(parts), size=12, color_name="muted",
                     align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)


R.RENDERERS["band_strip"] = render_band_strip
for _name in VARIANTS:
    R.RENDERERS[_name] = render_band_strip
