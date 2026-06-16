"""
render_data_support.py — データ補助の個別型。

- data_source_footer : 本文＋下部に出典/期間/N/注を明示する帯。全定量スライドに付けたいプリミティブ。
- waterfall          : 増減分解（開始→増減→着地）。ネイティブ図形の積み木で表現。

設計思想：標準図形のみ。色は theme 経由。
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis
from .render_base_labeled import _block_items, _add_items_text


# ---------------------------------------------------------------------------
# data_source_footer
# ---------------------------------------------------------------------------
def render_data_source_footer(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    # 本文（最初のブロックがあれば箇条書き、なければ message プロパティ）
    body_bottom = SLIDE_H - Inches(1.0)
    if data.blocks:
        items = _block_items(data.blocks[0])
        _add_items_text(slide, MARGIN, top + Inches(0.2), CONTENT_W,
                        body_bottom - top - Inches(0.2), theme, items,
                        size=16, anchor=MSO_ANCHOR.TOP, bullet=(len(items) > 1))
    else:
        msg = data.props.get("message", "")
        if msg:
            add_text(slide, MARGIN, top + Inches(0.3), CONTENT_W, Inches(2.0), theme,
                     split_emphasis(msg), size=20, color_name="ink",
                     align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)

    # 下部の出典帯
    parts = []
    for k, tag in (("source", "出典"), ("period", "期間"), ("note", "注")):
        v = data.props.get(k)
        if v:
            parts.append(f"{tag}：{v}")
    n = data.props.get("n")
    if n:
        parts.append(f"N＝{n}")
    fy = SLIDE_H - Inches(0.85)
    add_rect(slide, 0, int(fy), SLIDE_W, Inches(0.85), theme, "base_2", rounded=False)
    add_text(slide, MARGIN, int(fy), CONTENT_W, Inches(0.85), theme,
             "　／　".join(parts) if parts else "", size=11, color_name="muted",
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# waterfall（増減分解）
# ---------------------------------------------------------------------------
def _num(s):
    try:
        return float(s.replace(",", "").replace("+", ""))
    except Exception:
        return 0.0


def render_waterfall(slide, data: Slide, theme):
    """各 col が1本のバー。
    col "売上" → title=ラベル、line[0]=値、行頭が total 指定なら累計バー。
    記法:
      col "期初" base       # base 行 = 絶対値バー（開始/着地）
        "100"
      col "新規"            # 増減バー（前の累計に積む）
        "+40"
      col "解約"
        "-15"
      col "期末" base
        "125"
    """
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    bars = data.blocks
    n = len(bars)
    if n == 0:
        return

    bottom = SLIDE_H - Inches(1.0)
    plot_top = top + Inches(0.3)
    plot_h = bottom - plot_top
    gap = Inches(0.25)
    bw = (CONTENT_W - gap * (n - 1)) / n

    # 累計を計算。highlight 付きのバー = 絶対値バー（期初/期末などの着地点）
    vals = [_num(b.lines[0]) if b.lines else 0.0 for b in bars]
    is_total = [b.highlight for b in bars]
    running = 0.0
    tops = []   # (start_val, end_val)
    for i, v in enumerate(vals):
        if is_total[i]:
            tops.append((0.0, v)); running = v
        else:
            tops.append((running, running + v)); running += v
    vmax = max([t[1] for t in tops] + [t[0] for t in tops] + [1.0])

    def y_of(val):
        return plot_top + plot_h * (1 - val / vmax)

    for i, b in enumerate(bars):
        x = MARGIN + i * (bw + gap)
        s, e = tops[i]
        y_top = y_of(max(s, e))
        bar_h = abs(y_of(s) - y_of(e))
        if bar_h < Inches(0.04):
            bar_h = Inches(0.04)
        if is_total[i]:
            color = "main"
        else:
            color = "main_2" if (e >= s) else "accent"   # 増=青、減=赤
        add_rect(slide, int(x), int(y_top), int(bw), int(bar_h), theme, color, rounded=False)
        # 値ラベル
        add_text(slide, int(x), int(y_top - Inches(0.32)), int(bw), Inches(0.3), theme,
                 b.lines[0] if b.lines else "", size=12,
                 color_name="ink", bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)
        # カテゴリラベル
        add_text(slide, int(x), int(bottom + Inches(0.05)), int(bw), Inches(0.4), theme,
                 b.title, size=12, color_name="ink",
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)


R.RENDERERS["data_source_footer"] = render_data_source_footer
R.RENDERERS["waterfall"] = render_waterfall
