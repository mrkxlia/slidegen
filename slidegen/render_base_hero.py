"""
render_base_hero.py — 基底レイアウト `hero_canvas` と variant ラッパー群。

1スライド1要素を大きく見せる基底。big_fact / 休憩 / TED型 / カウントダウンなど、
「中央に大きな主役を置く」系を吸収する。

variant:
  mode    : "fact"(巨大数字+キャプション) | "word"(巨大コピー1行) |
            "break"(休憩) | "statement"(主張文) | "trio"(3数字並列)
  bg      : 背景色名（Noneなら白）

記法例(big_fact):
  slide big_fact
    number "3.2x"
    caption "導入後3ヶ月の処理速度"
    foot "※当社調べ N=42"

記法例(stat_trio):
  slide stat_trio
    col "98%"
      "顧客継続率"
    col "1.5億"
      "累計取引額"
    col "24h"
      "平均応答時間"
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis


VARIANTS = {
    "big_fact":   {"mode": "fact",      "bg": None},
    "stat_trio":  {"mode": "trio",      "bg": None},
    "takahashi":  {"mode": "word",      "bg": "main"},
    "tagline":    {"mode": "word",      "bg": None},
    "break_slide":{"mode": "break",     "bg": "main"},
    "statement":  {"mode": "statement", "bg": None},
    "ted_idea":   {"mode": "word",      "bg": "main"},
}


def _resolve(data: Slide) -> dict:
    name = data.props.get("variant") or data.type
    return dict(VARIANTS.get(name, {"mode": "statement", "bg": None}))


def render_hero_canvas(slide, data: Slide, theme):
    v = _resolve(data)
    mode = v["mode"]
    bg = v["bg"]

    # 背景塗り（全面）
    if bg:
        add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, theme, bg, rounded=False)
    on_bg = "on_main" if bg == "main" else "ink"
    accent_on_bg = "on_main" if bg == "main" else "accent"

    cx = SLIDE_W / 2

    if mode == "fact":
        number = data.props.get("number", "")
        caption = data.props.get("caption", "")
        # 巨大数字
        add_text(slide, MARGIN, SLIDE_H * 0.28, CONTENT_W, Inches(2.2), theme,
                 number, size=110, color_name=accent_on_bg, bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # キャプション
        add_text(slide, MARGIN, SLIDE_H * 0.62, CONTENT_W, Inches(1.0), theme,
                 caption, size=24, color_name=on_bg,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)

    elif mode == "trio":
        items = data.blocks[:3]
        if not items:
            return
        n = len(items)
        gap = Inches(0.5)
        cw = (CONTENT_W - gap * (n - 1)) / n
        y = SLIDE_H * 0.32
        for i, b in enumerate(items):
            x = MARGIN + i * (cw + gap)
            num = b.title
            lab = b.lines[0] if b.lines else ""
            add_text(slide, x, y, cw, Inches(1.6), theme, num,
                     size=64, color_name="accent" if b.highlight else "main",
                     bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            add_text(slide, x, y + Inches(1.7), cw, Inches(0.8), theme, lab,
                     size=18, color_name="ink",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)

    elif mode == "word":
        word = data.props.get("word") or data.props.get("headline", "")
        add_text(slide, MARGIN, 0, CONTENT_W, SLIDE_H, theme, split_emphasis(word),
                 size=80, color_name=on_bg, bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    elif mode == "break":
        big = data.props.get("headline", "BREAK")
        sub = data.props.get("caption", "")
        add_text(slide, MARGIN, SLIDE_H * 0.32, CONTENT_W, Inches(1.6), theme, big,
                 size=72, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if sub:
            add_text(slide, MARGIN, SLIDE_H * 0.58, CONTENT_W, Inches(0.8), theme, sub,
                     size=24, color_name="on_main",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)

    else:  # statement（主張文・中央寄せ＋上下に細い線）
        msg = data.props.get("headline") or data.props.get("message", "")
        add_text(slide, MARGIN, SLIDE_H * 0.30, CONTENT_W, Inches(2.4), theme,
                 split_emphasis(msg), size=40, color_name=on_bg, bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        sub = data.props.get("caption", "")
        if sub:
            add_text(slide, MARGIN, SLIDE_H * 0.62, CONTENT_W, Inches(0.8), theme, sub,
                     size=20, color_name="muted",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)

    # フッタ（bg有りのときは出典色が見えにくいので白背景時のみ）
    if not bg:
        render_foot(slide, data, theme)


R.RENDERERS["hero_canvas"] = render_hero_canvas
for _name in VARIANTS:
    R.RENDERERS[_name] = render_hero_canvas
