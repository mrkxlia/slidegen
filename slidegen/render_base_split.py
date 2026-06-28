"""
render_base_split.py — 基底レイアウト `split_layout` と variant ラッパー群。

左右(または上下)を比率可変で分割し、各側に「ラベル＋項目リスト」を置く基底。
labeled_blocks と同じ 3軸分解(基底 × variant × 中身)の思想。

variant が:
  labels    : 左右(上下)のラベル（Noneなら col のtitleを使う）
  colors    : 各側のヘッダー色（"main"/"accent"/None）
  ratio     : 分割比 (左の割合, 右の割合)
  direction : "h"(左右) | "v"(上下)
  connector : 中央に矢印を描くか（before→after等）

記法例(before_after):
  slide before_after
    headline "運用はこう変わる"
    col
      "手動デプロイ"
      "障害が頻発"
    col
      "自動デプロイ"
      "障害ほぼゼロ"
  → 左ラベル"Before"/右ラベル"After"、中央に矢印、を自動付与。
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis
from .render_base_labeled import _block_items, _add_items_text


# ---------------------------------------------------------------------------
# variant 辞書
# ---------------------------------------------------------------------------
VARIANTS = {
    "before_after": {
        "labels": ["Before｜現状", "After｜将来"],
        "colors": ["muted", "main"], "ratio": (0.5, 0.5),
        "direction": "h", "connector": True,
    },
    "problem_solution": {
        "labels": ["課題", "解決策"],
        "colors": ["accent", "main"], "ratio": (0.5, 0.5),
        "direction": "h", "connector": True,
    },
    "dual_hero": {
        "labels": None,
        "colors": ["main", "main"], "ratio": (0.5, 0.5),
        "direction": "h", "connector": False,
    },
    "hypothesis_prediction": {
        "labels": ["Hypothesis｜仮説", "Prediction｜予測"],
        "colors": ["main", "main"], "ratio": (0.5, 0.5),
        "direction": "h", "connector": True,
    },
    "limitations_future": {
        "labels": ["Limitations｜限界", "Future Work｜今後"],
        "colors": ["muted", "main"], "ratio": (0.5, 0.5),
        "direction": "h", "connector": False,
    },
    "image_text": {  # 左に図解プレースホルダ、右にテキスト
        "labels": None,
        "colors": [None, None], "ratio": (0.45, 0.55),
        "direction": "h", "connector": False,
    },
}


def _resolve(data: Slide) -> dict:
    name = data.props.get("variant") or data.type
    v = VARIANTS.get(name)
    if v:
        return dict(v)
    return {"labels": None, "colors": ["main", "main"], "ratio": (0.5, 0.5),
            "direction": "h", "connector": False}


def _panel(slide, theme, x, y, w, h, label, items, color):
    """1パネル：ヘッダー帯(あれば)＋カード地＋項目。標準図形のみ。"""
    sep = Inches(0.08)
    multi = len(items) > 1
    if label:
        head_h = Inches(0.5)
        add_rect(slide, x, y, w, head_h, theme, color or "main", rounded=True)
        add_text(slide, x, y, w, head_h, theme, label,
                 size=15, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        body_y = y + head_h + sep
        body_h = h - head_h - sep
    else:
        body_y, body_h = y, h
    add_rect(slide, x, body_y, w, body_h, theme, "base_2", rounded=True)
    if items:
        _add_items_text(slide, x + Inches(0.25), body_y + Inches(0.15),
                        w - Inches(0.5), body_h - Inches(0.3), theme,
                        items, size=14, anchor=MSO_ANCHOR.TOP, bullet=multi)


def render_split_layout(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    v = _resolve(data)
    blocks = data.blocks[:2]   # 2パネル固定（Sonnet安定のため上限固定）
    if len(blocks) < 2:
        # 1個しかなければそのまま全幅
        if blocks:
            b = blocks[0]
            _panel(slide, theme, MARGIN, top, CONTENT_W, SLIDE_H - Inches(0.7) - top,
                   b.title or (v["labels"][0] if v["labels"] else None),
                   _block_items(b), v["colors"][0])
        return

    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    labels = v["labels"]
    colors = v["colors"]
    connector = v["connector"]
    gap = Inches(0.5) if connector else Inches(0.4)

    if v["direction"] == "h":
        lw = (CONTENT_W - gap) * v["ratio"][0]
        rw = (CONTENT_W - gap) * v["ratio"][1]
        # 左パネル
        b0 = blocks[0]
        lab0 = labels[0] if labels else b0.title
        _panel(slide, theme, MARGIN, top, lw, avail_h, lab0,
               _block_items(b0), "accent" if b0.highlight else colors[0])
        # 右パネル
        b1 = blocks[1]
        lab1 = labels[1] if labels else b1.title
        rx = MARGIN + lw + gap
        _panel(slide, theme, rx, top, rw, avail_h, lab1,
               _block_items(b1), "accent" if b1.highlight else colors[1])
        # 中央の矢印
        if connector:
            cx = MARGIN + lw + gap / 2
            cy = top + avail_h / 2
            arr = slide.shapes.add_shape(
                MSO_SHAPE.RIGHT_ARROW, int(cx - Inches(0.22)), int(cy - Inches(0.18)),
                int(Inches(0.44)), int(Inches(0.36)))
            arr.fill.solid(); arr.fill.fore_color.rgb = theme.rgb("muted")
            arr.line.fill.background(); arr.shadow.inherit = False
    else:
        # 上下分割
        th = (avail_h - gap) * v["ratio"][0]
        bh = (avail_h - gap) * v["ratio"][1]
        b0, b1 = blocks[0], blocks[1]
        lab0 = labels[0] if labels else b0.title
        lab1 = labels[1] if labels else b1.title
        _panel(slide, theme, MARGIN, top, CONTENT_W, th, lab0,
               _block_items(b0), "accent" if b0.highlight else colors[0])
        _panel(slide, theme, MARGIN, top + th + gap, CONTENT_W, bh, lab1,
               _block_items(b1), "accent" if b1.highlight else colors[1])


# 登録：基底 + 全 variant
R.register_many(["split_layout", *VARIANTS], render_split_layout)
