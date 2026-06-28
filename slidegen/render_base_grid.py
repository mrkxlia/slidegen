"""
render_base_grid.py — 基底レイアウト `grid_2d` と variant ラッパー群。

行×列のセルグリッドを描く基底。本物の表(add_table)ではなく、
ネイティブ図形(矩形)＋テキストフレームでセルを組む。これにより
セル単位の色分け(ヒートマップ/評価記号/RAG)を自由に制御できる。

3軸分解(基底 × variant × 中身)の思想。

記法設計（既存パーサで書ける形）:
  slide comparison_matrix
    headline "技術選定"
    columns "性能" "コスト" "学習コスト"   # 列見出し（トップレベル props）
    col "React"          # col の title = 行ラベル
      "◎"               # 各 line = その行のセル値（列順）
      "○"
      "△"
    col "Vue" highlight  # highlight で行を強調
      "○"
      "◎"
      "◎"

variant:
  symbol_color : 評価記号(◎○△×/●◐○)をセル背景色に対応づけるか
  heat         : 数値を色濃淡にするヒートマップか
  rag          : Red/Amber/Green の信号色か
"""
from __future__ import annotations
import re
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis


VARIANTS = {
    "comparison_matrix": {"mode": "symbol", "row_label": True},
    "scorecard_compare": {"mode": "symbol", "row_label": True},
    "raci":              {"mode": "rag_letter", "row_label": True},
    "heatmap_matrix":    {"mode": "heat", "row_label": True},
    "decision_matrix":   {"mode": "symbol", "row_label": True},
    "plain_grid":        {"mode": "plain", "row_label": True},
}

# 評価記号 → 色の強さ(0..1)。背景の塗り分けに使う。
_SYMBOL_RANK = {"◎": 1.0, "○": 0.66, "△": 0.33, "×": 0.0,
                "●": 1.0, "◐": 0.5, "◯": 0.0, "✓": 1.0, "✗": 0.0}
# RACI 1文字 → 色名
_RAG_LETTER = {"R": "accent", "A": "main", "C": "base_2", "I": "base_2"}


def _resolve(data: Slide) -> dict:
    name = data.props.get("variant") or data.type
    return dict(VARIANTS.get(name, {"mode": "plain", "row_label": True}))


def _cell_color(mode, value):
    """セル値からセル背景色名(または None)を返す。"""
    v = value.strip()
    if mode == "symbol" and v in _SYMBOL_RANK:
        r = _SYMBOL_RANK[v]
        return "main" if r >= 0.9 else ("base_2" if r >= 0.5 else "base")
    if mode == "rag_letter" and v[:1].upper() in _RAG_LETTER:
        return _RAG_LETTER[v[:1].upper()]
    if mode == "heat":
        try:
            n = float(re.sub(r"[^0-9.\-]", "", v))
            return "main" if n >= 0 else "base_2"   # 簡易：正負で塗り
        except Exception:
            return None
    return None


def render_grid_2d(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    v = _resolve(data)
    mode = v["mode"]

    # 列見出し：props["columns_list"]（多値）優先、無ければ columns 単値、それも無ければ自動
    col_headers = data.props.get("columns_list")
    rows = data.blocks
    if not rows:
        return
    ncol = max(len(b.lines) for b in rows)
    if col_headers is None:
        single = data.props.get("columns")
        col_headers = [single] if single else [f"列{i+1}" for i in range(ncol)]
    ncol = max(ncol, len(col_headers))

    has_rowlabel = v.get("row_label", True)
    nrow = len(rows)

    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    gap = Inches(0.06)

    # 列幅：行ラベル列はやや広め
    label_w = Inches(2.2) if has_rowlabel else Inches(0)
    grid_w = CONTENT_W - label_w
    cw = (grid_w - gap * (ncol - 1)) / ncol if ncol else grid_w

    header_h = Inches(0.5)
    rh = (avail_h - header_h - gap * nrow) / nrow if nrow else avail_h

    # --- 列見出し行 ---
    x0 = MARGIN + label_w
    for j in range(ncol):
        x = x0 + j * (cw + gap)
        add_rect(slide, x, top, cw, header_h, theme, "main", rounded=False)
        label = col_headers[j] if j < len(col_headers) else ""
        add_text(slide, x, top, cw, header_h, theme, label,
                 size=12, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    # --- 各行 ---
    for i, b in enumerate(rows):
        y = top + header_h + gap + i * (rh + gap)
        # 行ラベル
        if has_rowlabel:
            lab_color = "accent" if b.highlight else "base_2"
            add_rect(slide, MARGIN, y, label_w - gap, rh, theme, lab_color, rounded=False)
            add_text(slide, MARGIN + Inches(0.1), y, label_w - gap - Inches(0.2), rh,
                     theme, b.title, size=13,
                     color_name="on_main" if b.highlight else "ink",
                     bold=True, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        # セル
        for j in range(ncol):
            x = x0 + j * (cw + gap)
            val = b.lines[j] if j < len(b.lines) else ""
            cell_bg = _cell_color(mode, val)
            add_rect(slide, x, y, cw, rh, theme, cell_bg or "base", rounded=False)
            txt_color = "on_main" if cell_bg in ("main", "accent") else "ink"
            add_text(slide, x, y, cw, rh, theme, split_emphasis(val),
                     size=13, color_name=txt_color,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def _split_quoted(s: str):
    """'"a" "b" "c"' → ['a','b','c']。クォート無しはスペース分割。"""
    found = re.findall(r'"([^"]*)"', s)
    return found if found else s.split()


R.register_many(["grid_2d", *VARIANTS], render_grid_2d)
