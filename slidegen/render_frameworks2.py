"""
render_frameworks2.py — ビジネスフレーム個別型 第2弾。

- bmc          : ビジネスモデルキャンバス（9ブロックの固定非対称レイアウト）
- lean_canvas  : リーンキャンバス（bmc と同一ジオメトリ・ラベルのみ差し替え）
- journey_map  : カスタマージャーニー（横スイムレーン：ステージ×行）
- pricing_tiers: 料金プラン（N列カード、中央を強調）

設計思想：標準図形のみ。色は theme 経由。固定の意味論を持つので専用実装。
"""
from __future__ import annotations
from pptx.util import Inches
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import add_rect, add_text, render_header, render_foot, SLIDE_H, MARGIN, CONTENT_W
from .parser import Slide, split_emphasis
from .render_util import block_items, add_items_text, columns_geometry


# ---------------------------------------------------------------------------
# 9セル非対称キャンバス（共通ジオメトリ）：bmc / lean_canvas が共有する。
# 標準レイアウト：
#   上段：col0 | col1(上)/col2(下) | col3(中央強調) | col4(上)/col5(下) | col6
#   下段：col7 | col8（横2分割）
# ---------------------------------------------------------------------------
def _render_canvas9(slide, data: Slide, theme, labels):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks
    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    gap = Inches(0.1)

    upper_h = avail_h * 0.68
    lower_h = avail_h - upper_h - gap
    colw = (CONTENT_W - gap * 4) / 5   # 上段5列

    def cell(idx, x, y, w, h):
        label = labels[idx]
        # idx=3（中央列）は強調
        head_color = "accent" if idx == 3 else "main"
        add_rect(slide, int(x), int(y), int(w), int(h), theme, "base_2", rounded=True)
        hh = Inches(0.36)
        add_rect(slide, int(x), int(y), int(w), int(hh), theme, head_color, rounded=True)
        add_text(slide, int(x), int(y), int(w), int(hh), theme, label,
                 size=9, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if idx < len(blocks):
            items = block_items(blocks[idx])
            add_items_text(slide, int(x + Inches(0.08)), int(y + hh + Inches(0.05)),
                            int(w - Inches(0.16)), int(h - hh - Inches(0.1)), theme,
                            items, size=9, anchor=MSO_ANCHOR.TOP, bullet=(len(items) > 1))

    x0 = MARGIN
    # 列1（縦フル）
    cell(0, x0, top, colw, upper_h)
    # 列2（上）/列3（下）
    half = (upper_h - gap) / 2
    cell(1, x0 + (colw + gap), top, colw, half)
    cell(2, x0 + (colw + gap), top + half + gap, colw, half)
    # 列3（縦フル・中央強調）
    cell(3, x0 + (colw + gap) * 2, top, colw, upper_h)
    # 列4（上）/列5（下）
    cell(4, x0 + (colw + gap) * 3, top, colw, half)
    cell(5, x0 + (colw + gap) * 3, top + half + gap, colw, half)
    # 列5（縦フル）
    cell(6, x0 + (colw + gap) * 4, top, colw, upper_h)
    # 下段：横2分割
    ly = top + upper_h + gap
    halfw = (CONTENT_W - gap) / 2
    cell(7, x0, ly, halfw, lower_h)
    cell(8, x0 + halfw + gap, ly, halfw, lower_h)


_BMC_LABELS = [
    "Key Partners｜パートナー",
    "Key Activities｜主要活動",
    "Key Resources｜リソース",
    "Value Propositions｜価値提案",
    "Customer Relationships｜顧客との関係",
    "Channels｜チャネル",
    "Customer Segments｜顧客セグメント",
    "Cost Structure｜コスト構造",
    "Revenue Streams｜収益の流れ",
]

_LEAN_CANVAS_LABELS = [
    "Problem｜課題",
    "Solution｜解決策",
    "Key Metrics｜主要指標",
    "UVP｜独自の価値提案",
    "Unfair Advantage｜優位性",
    "Channels｜チャネル",
    "Customer Segments｜顧客セグメント",
    "Cost Structure｜コスト構造",
    "Revenue Streams｜収益の流れ",
]


def render_bmc(slide, data: Slide, theme):
    _render_canvas9(slide, data, theme, _BMC_LABELS)


def render_lean_canvas(slide, data: Slide, theme):
    _render_canvas9(slide, data, theme, _LEAN_CANVAS_LABELS)


# ---------------------------------------------------------------------------
# journey_map（横スイムレーン：ステージ×行）
# 記法：
#   stages "認知" "検討" "購入" "利用" "推奨"   # 横軸ステージ
#   col "行動"        # title = 行ラベル（レーン名）
#     "広告で知る"     # 各ステージのセルは1行1セル（複数を1行にまとめて書かない）
#     "比較する"
#     "申し込む"
#     "使う"
#     "勧める"
#   col "感情" emotion  # （将来：感情曲線レーン）
# ---------------------------------------------------------------------------
def render_journey_map(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    stages = data.props.get("stages_list")
    if stages is None:
        single = data.props.get("stages")
        stages = [single] if single else None
    rows = data.blocks
    if not rows:
        return
    ncol = len(stages) if stages else max(len(b.lines) for b in rows)
    if not stages:
        stages = [f"Stage {i+1}" for i in range(ncol)]

    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    gap = Inches(0.08)
    label_w = Inches(1.6)
    grid_w = CONTENT_W - label_w
    cw = columns_geometry(grid_w, ncol, gap)
    header_h = Inches(0.5)
    nrow = len(rows)
    rh = (avail_h - header_h - gap * nrow) / nrow

    # ステージ見出し
    x0 = MARGIN + label_w
    for j in range(ncol):
        x = x0 + j * (cw + gap)
        add_rect(slide, int(x), int(top), int(cw), int(header_h), theme, "main", rounded=True)
        add_text(slide, int(x), int(top), int(cw), int(header_h), theme,
                 stages[j] if j < len(stages) else "", size=12, color_name="on_main",
                 bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    for i, b in enumerate(rows):
        y = top + header_h + gap + i * (rh + gap)
        # 行ラベル
        add_rect(slide, int(MARGIN), int(y), int(label_w - gap), int(rh), theme,
                 "main_3", rounded=True)
        add_text(slide, int(MARGIN + Inches(0.1)), int(y), int(label_w - gap - Inches(0.2)),
                 int(rh), theme, b.title, size=12, color_name="ink", bold=True,
                 align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        # セル
        for j in range(ncol):
            x = x0 + j * (cw + gap)
            val = b.lines[j] if j < len(b.lines) else ""
            add_rect(slide, int(x), int(y), int(cw), int(rh), theme, "base_2", rounded=True)
            add_text(slide, int(x + Inches(0.08)), int(y), int(cw - Inches(0.16)), int(rh),
                     theme, split_emphasis(val), size=11, color_name="ink",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# pricing_tiers（料金プラン：N列カード、highlightで強調）
# 記法：
#   col "Free"
#     "¥0 / 月"
#     "個人利用"
#     "5プロジェクト"
#   col "Pro" highlight
#     "¥1,980 / 月"
#     "プロ向け"
#     "無制限"
# ---------------------------------------------------------------------------
def render_pricing_tiers(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    tiers = data.blocks
    n = len(tiers)
    if n == 0:
        return
    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    gap = Inches(0.3)
    cw = columns_geometry(CONTENT_W, n, gap)

    for i, b in enumerate(tiers):
        x = MARGIN + i * (cw + gap)
        accent = b.highlight
        # 強調プランは少し背を高く（上に伸ばす）
        ch = avail_h if accent else avail_h - Inches(0.4)
        y = top if accent else top + Inches(0.4)
        # カード地
        add_rect(slide, int(x), int(y), int(cw), int(ch), theme,
                 "base_2", rounded=True)
        # プラン名帯
        hh = Inches(0.7)
        add_rect(slide, int(x), int(y), int(cw), int(hh), theme,
                 "accent" if accent else "main", rounded=True)
        add_text(slide, int(x), int(y), int(cw), int(hh), theme, b.title,
                 size=18, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 価格（1行目）
        price = b.lines[0] if b.lines else ""
        add_text(slide, int(x), int(y + hh + Inches(0.1)), int(cw), Inches(0.7), theme,
                 price, size=24, color_name="ink", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 残りの行（特徴）
        feats = b.lines[1:]
        if feats:
            add_items_text(slide, int(x + Inches(0.2)), int(y + hh + Inches(0.9)),
                            int(cw - Inches(0.4)), int(y + ch - (y + hh + Inches(0.9)) - Inches(0.1)),
                            theme, feats, size=12, anchor=MSO_ANCHOR.TOP, bullet=True)


R.register("bmc", render_bmc)
R.register("lean_canvas", render_lean_canvas)
R.register("journey_map", render_journey_map)
R.register("pricing_tiers", render_pricing_tiers)
