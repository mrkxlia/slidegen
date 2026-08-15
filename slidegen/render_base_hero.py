"""
render_base_hero.py — 基底レイアウト `hero_canvas` と variant ラッパー群。

1スライド1要素を大きく見せる基底。big_fact / 休憩 / TED型 / カウントダウンなど、
「中央に大きな主役を置く」系を吸収する。

variant:
  mode    : "fact"(巨大数字+キャプション) | "word"(巨大コピー1行) |
            "break"(休憩) | "statement"(主張文) | "trio"(3数字並列) |
            "cta"(大見出し+訴求ポイント+連絡先バー)
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
from pptx.util import Inches
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import add_rect, add_text, render_foot, SLIDE_W, SLIDE_H, MARGIN, CONTENT_W
from .parser import Slide, split_emphasis
from .render_util import resolve_variant, columns_geometry

_DEFAULT = {"mode": "statement", "bg": None}

VARIANTS = {
    "big_fact":   {"mode": "fact",      "bg": None},
    "stat_trio":  {"mode": "trio",      "bg": None},
    "takahashi":  {"mode": "word",      "bg": "main"},
    "tagline":    {"mode": "word",      "bg": None},
    "break_slide":{"mode": "break",     "bg": "main"},
    "statement":  {"mode": "statement", "bg": None},
    "ted_idea":   {"mode": "word",      "bg": "main"},
    "cta_recruit":{"mode": "cta",       "bg": None},
}


def render_hero_canvas(slide, data: Slide, theme):
    v = resolve_variant(data, VARIANTS, _DEFAULT)
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
        cw = columns_geometry(CONTENT_W, n, gap)
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

    elif mode == "cta":
        msg = data.props.get("headline", "")
        add_text(slide, MARGIN, SLIDE_H * 0.14, CONTENT_W, Inches(1.3), theme,
                 split_emphasis(msg), size=38, color_name=on_bg, bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        items = data.blocks[:4]
        item_h = Inches(0.45)
        items_top = SLIDE_H * 0.46
        for i, blk in enumerate(items):
            text = blk.title or (blk.lines[0] if blk.lines else "")
            if text:
                add_text(slide, MARGIN, items_top + i * item_h, CONTENT_W, item_h, theme,
                         f"・{text}", size=18, color_name=on_bg,
                         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        contact = data.props.get("contact", "")
        if contact:
            # 帯は全幅×0.75"だとP2(accent面積8%上限)を超過するため、幅0.85倍・高さ0.65"に
            # 縮めて面積比を約6.6%に抑える（実機テストで確認済み）。
            bar_w = CONTENT_W * 0.85
            bar_h = Inches(0.65)
            bar_x = MARGIN + (CONTENT_W - bar_w) / 2
            bar_y = SLIDE_H - Inches(1.3)  # render_foot の領域(SLIDE_H-0.55〜)と重ならない位置
            add_rect(slide, bar_x, bar_y, bar_w, bar_h, theme, "accent", rounded=True)
            add_text(slide, bar_x, bar_y, bar_w, bar_h, theme, contact,
                     size=18, color_name="on_accent", bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

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


R.register_many(["hero_canvas", *VARIANTS], render_hero_canvas)
