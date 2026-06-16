"""
render_charts.py — ネイティブ編集可能チャート型。

python-pptx の Chart API で「本物のグラフ」を生成する（画像化しない＝編集可能）。
設計思想：円グラフ・3D・ゲージは作らない。棒/横棒/折れ線/積み上げ/100%積み上げ/クラスターを提供。
系列色は theme の main 系＋accent に限定（70:25:5 を守る）。

DSL（既存パーサで書ける形）:
  slide bar_chart
    headline "四半期売上"
    categories "Q1" "Q2" "Q3" "Q4"   # x軸ラベル（多値プロパティ→categories_list）
    unit "百万円"                      # y軸の単位（任意）
    col "売上"                         # col.title = 系列名
      "120"                           # 各 line = 数値（カテゴリ順）
      "150"
      "135"
      "180"
    col "目標"                         # 2系列目（clustered/lineで複数系列に）
      "100"
      "140"
      "160"
      "170"

型 → チャート種別:
  bar_chart        : 縦棒（単一/複数系列=clustered）
  bar_horizontal   : 横棒
  line_chart       : 折れ線
  stacked_bar      : 積み上げ縦棒
  stacked_100_bar  : 100%積み上げ（円グラフ代替）
  clustered_bar    : クラスター縦棒（明示）
"""
from __future__ import annotations
from pptx.util import Inches, Pt
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION

from . import render as R
from .render import (add_text, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide


CHART_TYPES = {
    "bar_chart":       XL_CHART_TYPE.COLUMN_CLUSTERED,
    "clustered_bar":   XL_CHART_TYPE.COLUMN_CLUSTERED,
    "bar_horizontal":  XL_CHART_TYPE.BAR_CLUSTERED,
    "line_chart":      XL_CHART_TYPE.LINE_MARKERS,
    "stacked_bar":     XL_CHART_TYPE.COLUMN_STACKED,
    "stacked_100_bar": XL_CHART_TYPE.COLUMN_STACKED_100,
}

# 系列に割り当てる色（main系＋accent。多すぎる系列は非推奨）
_SERIES_COLORS = ["main", "main_2", "main_3", "accent", "muted"]


def _nums(lines):
    out = []
    for s in lines:
        try:
            out.append(float(s.replace(",", "").replace("+", "")))
        except Exception:
            out.append(0.0)
    return out


def render_chart(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)

    chart_type = CHART_TYPES.get(data.type, XL_CHART_TYPE.COLUMN_CLUSTERED)
    series = data.blocks
    if not series:
        return

    # カテゴリ（x軸）
    cats = data.props.get("categories_list")
    if cats is None:
        single = data.props.get("categories")
        # 無ければ系列の値数から連番
        ncat = max(len(b.lines) for b in series)
        cats = [single] if single else [f"{i+1}" for i in range(ncat)]

    cd = CategoryChartData()
    cd.categories = cats
    for b in series:
        vals = _nums(b.lines)
        # カテゴリ数に長さを合わせる
        while len(vals) < len(cats):
            vals.append(0.0)
        cd.add_series(b.title or "系列", vals[:len(cats)])

    # チャート配置領域（ヘッダー下〜フッタ上）
    x = MARGIN
    y = top + Inches(0.1)
    w = CONTENT_W
    h = SLIDE_H - Inches(0.9) - y

    gframe = slide.shapes.add_chart(chart_type, int(x), int(y), int(w), int(h), cd)
    chart = gframe.chart

    # --- スタイリング（装飾を抑える） ---
    chart.has_title = False
    # 凡例：系列が複数のときだけ
    if len(series) > 1:
        chart.has_legend = True
        chart.legend.position = XL_LEGEND_POSITION.BOTTOM
        chart.legend.include_in_layout = False
        chart.legend.font.size = Pt(11)
        chart.legend.font.name = theme.font
    else:
        chart.has_legend = False

    # 系列色
    for i, plot_series in enumerate(chart.series):
        color = theme.rgb(_SERIES_COLORS[i % len(_SERIES_COLORS)])
        fmt = plot_series.format
        if data.type == "line_chart":
            fmt.line.color.rgb = color
            fmt.line.width = Pt(2.5)
        else:
            fmt.fill.solid()
            fmt.fill.fore_color.rgb = color

    # データラベル（単一系列の棒なら値を直接表示＝凡例不要の直接ラベリング）
    try:
        plot = chart.plots[0]
        if len(series) == 1 and data.type in ("bar_chart", "bar_horizontal", "clustered_bar"):
            plot.has_data_labels = True
            plot.data_labels.font.size = Pt(11)
            plot.data_labels.font.name = theme.font
            plot.data_labels.number_format = '#,##0'
            plot.data_labels.number_format_is_linked = False
    except Exception:
        pass

    # 軸フォント・単位
    try:
        cax = chart.category_axis
        cax.tick_labels.font.size = Pt(11)
        cax.tick_labels.font.name = theme.font
        vax = chart.value_axis
        vax.tick_labels.font.size = Pt(10)
        vax.tick_labels.font.name = theme.font
        vax.has_major_gridlines = True
    except Exception:
        pass

    # 単位ラベル（右上に小さく）
    unit = data.props.get("unit")
    if unit:
        add_text(slide, x, top - Inches(0.05), w, Inches(0.3), theme,
                 f"（単位：{unit}）", size=10, color_name="muted")


for _name in CHART_TYPES:
    R.RENDERERS[_name] = render_chart
