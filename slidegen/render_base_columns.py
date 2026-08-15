"""
render_base_columns.py — 基底レイアウト `columns_with_header` と variant ラッパー群。

上部に共通ヘッダー（小見出し or リード文）、その下に N 列を並べる基底。
labeled_blocks（各ブロックにラベル帯）と違い、こちらは「列の上に1本の共通の文脈」が乗る。
教育・行政・データ補助・編集レイアウトで頻出。

variant:
  band_text : ヘッダー帯に出す既定の説明（Noneなら props["lead"]）
  ncol_hint : 推奨列数（指定なければブロック数）
  numbered  : 列に 01/02… の番号を振るか

記法例(policy_3col):
  slide policy_3col
    headline "次期システムの論点"
    lead "現状の課題を3つの論点で整理する"
    col "コスト"
      "保守費が年々増加"
      "属人化でリスク大"
    col "スピード"
      "申請処理に3日"
    col "ガバナンス"
      "監査ログが分散"
"""
from __future__ import annotations
from pptx.util import Inches
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis
from .render_util import block_items, add_items_text, resolve_variant, columns_geometry

_DEFAULT = {"numbered": False, "band": "main"}

VARIANTS = {
    "policy_3col":      {"numbered": False, "band": "main"},
    "know_dontknow":    {"numbered": False, "band": "main",
                         "labels": ["分かっていること", "分からないこと", "調べること"]},
    "editorial_cols":   {"numbered": False, "band": None},
    "numbered_columns": {"numbered": True,  "band": "main"},
    "data_limitations": {"numbered": False, "band": "accent",
                         "labels": ["限界", "影響", "緩和策"]},
    "travel_itinerary": {"numbered": False, "band": "main"},   # S5g: col=Day見出し+縦リスト
    "okr": {"numbered": True, "band": "accent"},   # S5g: lead=Objective、col=Key Result
}


def render_columns_with_header(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    v = resolve_variant(data, VARIANTS, _DEFAULT)
    labels = v.get("labels")
    numbered = v.get("numbered", False)
    band_color = v.get("band", "main")

    cols = data.blocks
    n = len(cols)
    if n == 0:
        return

    bottom = SLIDE_H - Inches(0.7)
    y = top

    # 共通ヘッダー帯（lead 文があれば）
    lead = data.props.get("lead", "")
    if lead and band_color:
        band_h = Inches(0.6)
        add_rect(slide, MARGIN, y, CONTENT_W, band_h, theme, band_color, rounded=True)
        add_text(slide, MARGIN + Inches(0.2), y, CONTENT_W - Inches(0.4), band_h, theme,
                 split_emphasis(lead), size=15, color_name="on_main", bold=True,
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        y += band_h + Inches(0.25)

    avail_h = bottom - y
    gap = Inches(0.3)
    cw = columns_geometry(CONTENT_W, n, gap)

    for i, b in enumerate(cols):
        x = MARGIN + i * (cw + gap)
        # 列見出し
        head = (labels[i] if labels and i < len(labels) else b.title)
        if numbered:
            num = f"{i+1:02d}"
            add_text(slide, x, y, cw, Inches(0.7), theme, num,
                     size=34, color_name="accent" if b.highlight else "main",
                     bold=True, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
            hy = y + Inches(0.7)
        else:
            hy = y
        if head:
            add_text(slide, x, hy, cw, Inches(0.5), theme, head,
                     size=16, color_name="accent" if b.highlight else "ink",
                     bold=True, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
            add_hline(slide, x, hy + Inches(0.5), cw, theme, "muted", weight=1.0)
            cy = hy + Inches(0.62)
        else:
            cy = hy
        items = block_items(b)
        if items:
            add_items_text(slide, x, cy, cw, bottom - cy, theme,
                            items, size=13, anchor=MSO_ANCHOR.TOP,
                            bullet=(len(items) > 1))


R.register_many(["columns_with_header", *VARIANTS], render_columns_with_header)
