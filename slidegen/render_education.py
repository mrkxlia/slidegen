"""
render_education.py — 教育・学術の個別型（S5e）。

- frayer_model  : 用語学習の4象限グラフィックオーガナイザー（定義/特徴/具体例/非例。
                  中央に対象語を重ね描き）。swot と同じ固定2x2ジオメトリを流用。
- abstract_slide: 論文アブストラクト（本文1段落＋下部キーワードチップ）。
                  data_source_footer の下敷きに、出典帯をキーワードチップへ差し替え。

設計思想：標準図形のみ。色は theme 経由。
"""
from __future__ import annotations
from pptx.util import Inches
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import add_rect, add_text, render_header, render_foot, SLIDE_H, MARGIN, CONTENT_W
from .parser import Slide
from .render_util import block_items, add_items_text


# ---------------------------------------------------------------------------
# frayer_model（定義/特徴/具体例/非例の固定2x2＋中央に対象語）
# ---------------------------------------------------------------------------
_FRAYER = [
    ("定義｜Definition", "main"),
    ("特徴｜Characteristics", "main_2"),
    ("具体例｜Examples", "muted"),
    ("非例｜Non-examples", "accent"),
]


def render_frayer_model(slide, data: Slide, theme):
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
        label, color = _FRAYER[i]
        add_rect(slide, int(x), int(y), int(cw), int(ch), theme, "base_2", rounded=True)
        head_h = Inches(0.4)
        add_rect(slide, int(x), int(y), int(cw), int(head_h), theme, color, rounded=True)
        add_text(slide, int(x), int(y), int(cw), int(head_h), theme, label,
                 size=13, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if i < len(blocks):
            items = block_items(blocks[i])
            if items:
                add_items_text(slide, int(x + Inches(0.15)), int(y + head_h + Inches(0.1)),
                                int(cw - Inches(0.3)), int(ch - head_h - Inches(0.2)), theme,
                                items, size=12, anchor=MSO_ANCHOR.TOP, bullet=(len(items) > 1))

    # 中央に対象語を重ね描き（4象限の交点にまたがって浮かせるFrayerモデルの意匠）
    term = data.props.get("term", "")
    if term:
        term_w, term_h = Inches(2.4), Inches(0.7)
        tx = MARGIN + CONTENT_W / 2 - term_w / 2
        ty = top + avail_h / 2 - term_h / 2
        add_rect(slide, int(tx), int(ty), int(term_w), int(term_h), theme, "ink", rounded=True)
        add_text(slide, int(tx), int(ty), int(term_w), int(term_h), theme, term,
                 size=18, color_name="base", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# abstract_slide（本文1段落＋下部キーワードチップ）
#   abstract "本文（1段落）"
#   keywords "kw1" "kw2" "kw3"
# ---------------------------------------------------------------------------
_ABSTRACT_MAX_KEYWORDS = 6


def render_abstract_slide(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    bottom = SLIDE_H - Inches(0.7)

    keywords = data.props.get("keywords_list")
    if keywords is None:
        single = data.props.get("keywords")
        keywords = [single] if single else []
    keywords = keywords[:_ABSTRACT_MAX_KEYWORDS]

    kw_h = Inches(0.5) if keywords else Inches(0)
    kw_gap = Inches(0.2) if keywords else Inches(0)
    body_bottom = bottom - kw_h - kw_gap

    abstract = data.props.get("abstract", "")
    if abstract:
        add_text(slide, int(MARGIN), int(top + Inches(0.2)), int(CONTENT_W),
                 int(body_bottom - top - Inches(0.2)), theme, abstract,
                 size=15, color_name="ink", align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)

    if keywords:
        y = bottom - kw_h
        x = MARGIN
        for kw in keywords:
            w = Inches(0.3) + Inches(0.15) * len(kw)
            add_rect(slide, int(x), int(y), int(w), int(kw_h), theme, "main_3", rounded=True)
            add_text(slide, int(x), int(y), int(w), int(kw_h), theme, kw,
                     size=12, color_name="ink",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            x += w + Inches(0.15)


R.register("frayer_model", render_frayer_model)
R.register("abstract_slide", render_abstract_slide)
