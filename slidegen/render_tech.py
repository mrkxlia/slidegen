"""
render_tech.py — 技術資料の個別型。

- code_block   : コードを等幅フォントで表示（濃色パネル＋行）。シンタックスハイライトはしない（崩れ防止）。
- terminal     : ターミナル出力風（黒地＋プロンプト）。
- api_endpoint_table : APIエンドポイント一覧（メソッド色分け＋パス＋説明）。

設計思想：標準図形のみ。等幅は theme.font_mono。色は theme 経由。
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide


def _code_lines(data: Slide):
    """本文のコード行を取得。最初のブロックの lines を使う。"""
    if data.blocks:
        return data.blocks[0].lines
    return []


def _mono_text(slide, x, y, w, h, theme, lines, *, size, color_name, on_dark):
    box = slide.shapes.add_textbox(int(x), int(y), int(w), int(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Pt(6)
    tf.margin_top = tf.margin_bottom = Pt(4)
    tf.vertical_anchor = MSO_ANCHOR.TOP
    for j, ln in enumerate(lines):
        p = tf.paragraphs[0] if j == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        r = p.add_run()
        r.text = ln if ln else " "
        r.font.size = Pt(size)
        r.font.name = theme.font_mono
        r.font.color.rgb = theme.rgb(color_name)
    return box


def render_code_block(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    lines = _code_lines(data)
    bottom = SLIDE_H - Inches(0.9)
    y = top + Inches(0.1)
    h = bottom - y
    # 濃色パネル
    add_rect(slide, MARGIN, int(y), CONTENT_W, int(h), theme, "ink", rounded=True)
    # ファイル名/言語（任意）
    lang = data.props.get("lang") or data.props.get("file")
    pad = Inches(0.2)
    ty = y + pad
    if lang:
        add_text(slide, MARGIN + pad, int(ty), CONTENT_W - pad * 2, Inches(0.3), theme,
                 lang, size=11, color_name="muted", bold=True)
        ty += Inches(0.35)
    _mono_text(slide, MARGIN + pad, ty, CONTENT_W - pad * 2, bottom - ty - Inches(0.1),
               theme, lines, size=14, color_name="base", on_dark=True)


def render_terminal(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    lines = _code_lines(data)
    bottom = SLIDE_H - Inches(0.9)
    y = top + Inches(0.1)
    h = bottom - y
    add_rect(slide, MARGIN, int(y), CONTENT_W, int(h), theme, "ink", rounded=True)
    # 行頭に $ を付ける（コマンド行の見立て）。出力行は先頭にスペースを入れて区別する運用。
    shown = []
    for ln in lines:
        if ln.startswith("  ") or ln.startswith("\t"):
            shown.append(ln)            # 出力行はそのまま
        else:
            shown.append("$ " + ln)     # コマンド行
    pad = Inches(0.2)
    _mono_text(slide, MARGIN + pad, y + pad, CONTENT_W - pad * 2, h - pad * 2,
               theme, shown, size=14, color_name="base", on_dark=True)


# メソッド → 色
_METHOD_COLOR = {"GET": "main_2", "POST": "main", "PUT": "muted",
                 "PATCH": "muted", "DELETE": "accent"}


def render_api_endpoint_table(slide, data: Slide, theme):
    """各 col が1エンドポイント。
      col "GET"            # title = HTTPメソッド
        "/api/users"       # line[0] = パス
        "ユーザー一覧取得"  # line[1] = 説明
    """
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    rows = data.blocks
    n = len(rows)
    if n == 0:
        return
    bottom = SLIDE_H - Inches(0.8)
    y0 = top + Inches(0.2)
    rh = min(Inches(0.7), (bottom - y0 - Inches(0.1) * n) / max(n, 1))
    gap = Inches(0.1)
    method_w = Inches(1.3)
    path_w = Inches(4.2)

    for i, b in enumerate(rows):
        y = y0 + i * (rh + gap)
        method = (b.title or "GET").strip().upper()
        color = _METHOD_COLOR.get(method, "main")
        # メソッドバッジ
        add_rect(slide, MARGIN, int(y), int(method_w), int(rh), theme, color, rounded=True)
        add_text(slide, MARGIN, int(y), int(method_w), int(rh), theme, method,
                 size=13, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # パス（等幅）
        path = b.lines[0] if b.lines else ""
        pbox = slide.shapes.add_textbox(int(MARGIN + method_w + gap), int(y),
                                        int(path_w), int(rh))
        tf = pbox.text_frame; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        pr = tf.paragraphs[0].add_run(); pr.text = path
        pr.font.name = theme.font_mono; pr.font.size = Pt(14); pr.font.color.rgb = theme.rgb("ink")
        # 説明
        desc = b.lines[1] if len(b.lines) > 1 else ""
        dx = MARGIN + method_w + gap + path_w + gap
        add_text(slide, int(dx), int(y), int(SLIDE_W - dx - MARGIN), int(rh), theme,
                 desc, size=13, color_name="muted",
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)


R.RENDERERS["code_block"] = render_code_block
R.RENDERERS["terminal"] = render_terminal
R.RENDERERS["api_endpoint_table"] = render_api_endpoint_table
