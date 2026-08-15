"""
render_base_nodes.py — 基底レイアウト `nodes_and_connectors` と variant ラッパー群。

ノード(箱)＋コネクタ(矢印)で構成される図を描く基底。
layout モードで見た目が変わる：
  linear   : 横一列を矢印で連結（process / 手順 / バリューチェーン）
  circular : 円周上に配置し循環矢印（cycle / PDCA / ループ）
  branching: 縦フロー＋分岐（フロー図 / PRISMA 風）

標準プリセット図形のみ使用（矢印は RIGHT_ARROW / DOWN_ARROW、回転・カスタムジオメトリ禁止）。

記法例(process):
  slide process_flow
    headline "リリースまでの流れ"
    col "要件定義"
      "体制と要件を確定"
    col "設計"
      "アーキを決める"
    col "実装"
    col "リリース"
  → 横一列＋間に矢印を自動。
"""
from __future__ import annotations
from pptx.util import Inches
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import math

from . import render as R
from .render import add_rect, add_text, render_header, render_foot, SLIDE_H, MARGIN, CONTENT_W
from .parser import Slide, split_emphasis
from .render_util import resolve_variant

_DEFAULT = {"layout": "linear", "labels": None}

VARIANTS = {
    "process_flow":  {"layout": "linear",   "labels": None},
    "value_chain":   {"layout": "linear",   "labels": None},
    "cloud_architecture": {"layout": "linear", "labels": None},
    "cycle_loop":    {"layout": "circular", "labels": None},
    "pdca":          {"layout": "circular", "labels": ["Plan", "Do", "Check", "Act"]},
    "flow_branching":{"layout": "branching","labels": None},
    "funnel_steps":  {"layout": "funnel",   "labels": None},
}


def _node_box(slide, theme, x, y, w, h, title, desc, accent):
    color = "accent" if accent else "main"
    add_rect(slide, x, y, w, h, theme, "base_2", rounded=True)
    head_h = min(Inches(0.5), h * 0.4)
    add_rect(slide, x, y, w, head_h, theme, color, rounded=True)
    add_text(slide, x, y, w, head_h, theme, title,
             size=13, color_name="on_main", bold=True,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    if desc:
        add_text(slide, x + Inches(0.12), y + head_h + Inches(0.08),
                 w - Inches(0.24), h - head_h - Inches(0.16), theme,
                 split_emphasis(desc), size=11, color_name="ink",
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)


def _arrow(slide, theme, x, y, w, h, direction="right"):
    shp = slide.shapes.add_shape(
        MSO_SHAPE.RIGHT_ARROW if direction == "right" else MSO_SHAPE.DOWN_ARROW,
        int(x), int(y), int(w), int(h))
    shp.fill.solid(); shp.fill.fore_color.rgb = theme.rgb("muted")
    shp.line.fill.background(); shp.shadow.inherit = False
    return shp


def render_nodes_and_connectors(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    v = resolve_variant(data, VARIANTS, _DEFAULT)
    layout = v["layout"]
    labels = v["labels"]
    nodes = data.blocks
    n = len(nodes)
    if n == 0:
        return

    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top

    def title_of(i, b):
        if labels and i < len(labels):
            return labels[i]
        return b.title or f"{i+1}"

    def desc_of(b):
        return "  ".join(b.lines) if b.lines else ""

    if layout == "linear" or layout == "funnel":
        arrow_w = Inches(0.4)
        total_arrow = arrow_w * (n - 1)
        nw = (CONTENT_W - total_arrow) / n
        nh = min(Inches(2.0), avail_h * 0.55)
        ny = top + (avail_h - nh) / 2
        for i, b in enumerate(nodes):
            x = MARGIN + i * (nw + arrow_w)
            # funnel は右へ行くほど少し縮める
            shrink = (Inches(0.0) if layout == "linear"
                      else Inches(0.18) * i)
            _node_box(slide, theme, x, ny + shrink / 2, nw, nh - shrink,
                      title_of(i, b), desc_of(b), accent=b.highlight)
            if i < n - 1:
                ax = x + nw
                _arrow(slide, theme, ax + Inches(0.03), ny + nh / 2 - Inches(0.14),
                       arrow_w - Inches(0.06), Inches(0.28), "right")

    elif layout == "circular":
        # 円周に均等配置＋中心ラベル
        cx = MARGIN + CONTENT_W / 2
        cy = top + avail_h / 2
        radius_x = CONTENT_W * 0.30
        radius_y = avail_h * 0.34
        nw, nh = Inches(2.4), Inches(1.0)
        for i, b in enumerate(nodes):
            ang = -math.pi / 2 + 2 * math.pi * i / n   # 上から時計回り
            px = cx + radius_x * math.cos(ang) - nw / 2
            py = cy + radius_y * math.sin(ang) - nh / 2
            _node_box(slide, theme, int(px), int(py), int(nw), int(nh),
                      title_of(i, b), desc_of(b), accent=b.highlight)
        # 中心に小さな循環マーク（テキスト）
        add_text(slide, int(cx - Inches(1.0)), int(cy - Inches(0.3)),
                 int(Inches(2.0)), int(Inches(0.6)), theme,
                 data.props.get("center", "↻"),
                 size=20, color_name="muted", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    else:  # branching（縦フロー）
        nh = min(Inches(1.0), (avail_h - Inches(0.4) * (n - 1)) / n)
        gap = Inches(0.4)
        nw = CONTENT_W * 0.6
        nx = MARGIN + (CONTENT_W - nw) / 2
        for i, b in enumerate(nodes):
            y = top + i * (nh + gap)
            _node_box(slide, theme, int(nx), int(y), int(nw), int(nh),
                      title_of(i, b), desc_of(b), accent=b.highlight)
            if i < n - 1:
                _arrow(slide, theme, nx + nw / 2 - Inches(0.14), y + nh + Inches(0.04),
                       Inches(0.28), gap - Inches(0.08), "down")


R.register_many(["nodes_and_connectors", *VARIANTS], render_nodes_and_connectors)
