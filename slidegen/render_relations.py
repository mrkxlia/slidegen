"""
render_relations.py — 39パターン(Cone社)から、要素間の関係を示す図解系の型を追加。

実装方針：
- 各型は data.blocks の数（col の数）でレイアウトを自動決定
- 強調は accent のみ／装飾は最小（影なし・罫線はグレー）
- すべてネイティブシェイプ（編集可能）

型一覧（このモジュール）:
  matrix    … 2x2マトリクス（ポジショニング・4象限）
  cycle     … サイクル（PDCA等）。3〜4要素は円配置、5+は四角配置
  pyramid   … ピラミッド型（上位ほど規模が小）
  tree      … ツリー図（中心1→子N）
  formula   … 数式型（A × B = C のように要素関係を式で示す）
  timeline  … 時系列年表（左→右）。26則「時系列は左から右」
  image_left… 画像（または図解領域）左 + テキスト右。26則「画像は必ず左」
  mutual_relation … 相互関係（中心1者と相手1〜3者の間を、往復2本の矢印＋ラベルで結ぶ）
  scale_compare   … 規模比較（面積が値に比例する円を下端揃えで並べる）
  nested_boxes    … 包含（外側→内側の入れ子の角丸矩形。汎用N段の包含関係）
  logic_tree      … 左→右の多段ロジックツリー＋葉ごとの注記列（破線矢印で結ぶ。列見出し任意）
"""
from __future__ import annotations
import math
import re
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.dml import MSO_LINE
from pptx.oxml.ns import qn

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis
from .render_util import columns_geometry, fill_shape, parse_number


def _add_oval(slide, x, y, w, h, theme, color_name):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, w, h)
    fill_shape(shp, theme, color_name, no_shadow=True)
    return shp


def _add_triangle(slide, x, y, w, h, theme, color_name):
    shp = slide.shapes.add_shape(MSO_SHAPE.ISOSCELES_TRIANGLE, x, y, w, h)
    fill_shape(shp, theme, color_name, no_shadow=True)
    return shp


# ---------------------------------------------------------------------------
# matrix — 2x2 マトリクス（4象限）
#   ・横軸/縦軸ラベルは props["x_axis"], props["y_axis"] か "横軸"/"縦軸"
#   ・blocks 1〜4個。block.title=象限名, block.lines=説明。highlightで強調象限。
#   ・象限の配置順は記法どおり（左上・右上・左下・右下）
# ---------------------------------------------------------------------------
def render_matrix(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    bottom = SLIDE_H - Inches(0.9)
    plot_top = top + Inches(0.1)
    plot_h = bottom - plot_top
    # 軸ラベル領域を確保
    axis_pad_l = Inches(0.5)   # 縦軸ラベル分
    axis_pad_b = Inches(0.4)   # 横軸ラベル分
    plot_x = MARGIN + axis_pad_l
    plot_w = CONTENT_W - axis_pad_l
    plot_h = plot_h - axis_pad_b
    cell_w = plot_w / 2
    cell_h = plot_h / 2

    # 4象限の枠（記法順に左上・右上・左下・右下）
    positions = [(0,0),(1,0),(0,1),(1,1)]
    for i, blk in enumerate(data.blocks[:4]):
        cx, cy = positions[i]
        x = plot_x + cx * cell_w
        y = plot_top + cy * cell_h
        bg = "main_3" if blk.highlight else "base_2"
        add_rect(slide, x + Inches(0.04), y + Inches(0.04),
                 cell_w - Inches(0.08), cell_h - Inches(0.08), theme, bg, rounded=True)
        title_color = "accent" if blk.highlight else "ink"
        add_text(slide, x + Inches(0.2), y + Inches(0.2), cell_w - Inches(0.4), Inches(0.5),
                 theme, split_emphasis(blk.title), size=16, color_name=title_color, bold=True)
        if blk.lines:
            add_text(slide, x + Inches(0.2), y + Inches(0.7), cell_w - Inches(0.4), cell_h - Inches(0.9),
                     theme, " ".join(blk.lines), size=12, color_name="muted")

    # 軸線（中心の十字）— ネイティブの直線
    cx0 = plot_x + cell_w
    cy0 = plot_top + cell_h
    add_hline(slide, plot_x, cy0, plot_w, theme, "main", 1.5)
    # 縦線も直接
    v = slide.shapes.add_connector(2, int(cx0), int(plot_top), int(cx0), int(plot_top + plot_h))
    v.line.color.rgb = theme.rgb("main"); v.line.width = Pt(1.5)

    # 軸ラベル
    x_axis = data.props.get("x_axis") or data.props.get("横軸") or ""
    y_axis = data.props.get("y_axis") or data.props.get("縦軸") or ""
    if x_axis:
        add_text(slide, plot_x, plot_top + plot_h + Inches(0.05), plot_w, axis_pad_b,
                 theme, x_axis, size=11, color_name="muted", align=PP_ALIGN.CENTER)
    if y_axis:
        # 簡略化：縦書きではなく左マージンに横書きで（編集性優先）
        add_text(slide, MARGIN, plot_top, axis_pad_l - Inches(0.1), plot_h, theme,
                 y_axis, size=11, color_name="muted", anchor=MSO_ANCHOR.MIDDLE,
                 align=PP_ALIGN.RIGHT)


# ---------------------------------------------------------------------------
# cycle — サイクル（PDCA等）
#   要素3〜4: 円形配置（円型サイクル）
#   要素5+  : 四角の輪を作る
# ---------------------------------------------------------------------------
def render_cycle(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    n = len(data.blocks)
    if n == 0:
        return
    bottom = SLIDE_H - Inches(0.7)
    cx = SLIDE_W / 2
    cy = (top + bottom) / 2
    radius = min((bottom - top), CONTENT_W) / 2 - Inches(0.8)
    node = Inches(1.4)

    for i, blk in enumerate(data.blocks):
        angle = -math.pi/2 + 2*math.pi * i / n  # 12時方向から時計回り
        ex = cx + radius * math.cos(angle) - node/2
        ey = cy + radius * math.sin(angle) - node/2
        color = "accent" if blk.highlight else "main"
        _add_oval(slide, ex, ey, node, node, theme, color)
        add_text(slide, ex, ey, node, node, theme, blk.title,
                 size=14, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 説明は外側に置く（矢印を避けるためノードのさらに外側へ）
        if blk.lines:
            ox = cx + (radius + Inches(1.1)) * math.cos(angle) - Inches(1.4)
            oy = cy + (radius + Inches(1.1)) * math.sin(angle) - Inches(0.25)
            add_text(slide, ox, oy, Inches(2.8), Inches(0.5), theme, " ".join(blk.lines),
                     size=11, color_name="muted", align=PP_ALIGN.CENTER)
        # 矢印（次のノードへ。控えめなグレー）
        if n >= 2:
            angle_next = -math.pi/2 + 2*math.pi * ((i+1) % n) / n
            sx = cx + radius * math.cos(angle + 0.5) * 0.93
            sy = cy + radius * math.sin(angle + 0.5) * 0.93
            ex2 = cx + radius * math.cos(angle_next - 0.5) * 0.93
            ey2 = cy + radius * math.sin(angle_next - 0.5) * 0.93
            arr = slide.shapes.add_connector(2, int(sx), int(sy), int(ex2), int(ey2))
            arr.line.color.rgb = theme.rgb("muted")
            arr.line.width = Pt(1.5)


# ---------------------------------------------------------------------------
# pyramid — ピラミッド型（上位ほど規模が小）
#   blocks 3〜5 段。上から並べる。highlightは accent。
# ---------------------------------------------------------------------------
def render_pyramid(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    n = len(data.blocks)
    if n == 0:
        return
    bottom = SLIDE_H - Inches(0.7)
    pyr_h = bottom - top - Inches(0.2)
    layer_h = pyr_h / n
    max_w = Inches(7.0)
    cx = SLIDE_W / 2

    for i, blk in enumerate(data.blocks):
        # 台形を矩形で近似（編集容易さ優先）
        w = max_w * (i + 1) / n
        x = cx - w / 2
        y = top + Inches(0.1) + i * layer_h
        color = "accent" if blk.highlight else "main"
        add_rect(slide, x, y + Inches(0.05), w, layer_h - Inches(0.1), theme, color, rounded=False)
        add_text(slide, x, y, w, layer_h, theme, blk.title,
                 size=18, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        # 右側に説明（スライド右端を超えないよう動的計算）
        if blk.lines:
            desc_x = x + w + Inches(0.3)
            desc_w = max(Inches(1.0), SLIDE_W - MARGIN - desc_x)
            add_text(slide, desc_x, y, desc_w, layer_h, theme,
                     " ".join(blk.lines), size=12, color_name="muted",
                     anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# tree — ツリー図（中心ノード→子ノード横一列）
#   1個目を親、残りを子として扱う
# ---------------------------------------------------------------------------
def render_tree(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    if not data.blocks:
        return
    bottom = SLIDE_H - Inches(0.7)
    h_total = bottom - top
    parent = data.blocks[0]
    children = data.blocks[1:]

    node_w = Inches(2.2)
    node_h = Inches(0.9)
    px = SLIDE_W/2 - node_w/2
    py = top + Inches(0.2)
    color_p = "accent" if parent.highlight else "main"
    add_rect(slide, px, py, node_w, node_h, theme, color_p, rounded=True)
    add_text(slide, px, py, node_w, node_h, theme, parent.title,
             size=16, color_name="on_main", bold=True,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    if children:
        n = len(children)
        gap = Inches(0.3)
        cw = columns_geometry(CONTENT_W, n, gap)
        cy = py + node_h + Inches(0.9)
        for i, ch in enumerate(children):
            cx = MARGIN + i*(cw+gap)
            color = "accent" if ch.highlight else "main_2"
            add_rect(slide, cx, cy, cw, node_h, theme, color, rounded=True)
            add_text(slide, cx, cy, cw, node_h, theme, ch.title,
                     size=14, color_name="on_main", bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            # 親→子の接続線（グレー）
            line = slide.shapes.add_connector(2, int(px + node_w/2), int(py + node_h),
                                              int(cx + cw/2), int(cy))
            line.line.color.rgb = theme.rgb("rule"); line.line.width = Pt(1.5)
            # 子の説明
            if ch.lines:
                add_text(slide, cx, cy + node_h + Inches(0.15), cw, h_total - (cy + node_h + Inches(0.15) - top),
                         theme, " ".join(ch.lines), size=11, color_name="muted",
                         align=PP_ALIGN.CENTER)


# ---------------------------------------------------------------------------
# org_chart — 多段階層の組織図（tree の1段版を拡張。S5h）
#   col "CEO"
#   col "CTO"
#     上司 "CEO"       # rows[0]の値＝上司の名前（ラベルは自由）。無ければルート扱い
# 上限: ノード10・レベル3（安全・シンプルさ優先。循環参照はレベル計算時に打ち切る）
# ---------------------------------------------------------------------------
_ORG_CHART_MAX_NODES = 10
_ORG_CHART_MAX_LEVELS = 3


def render_org_chart(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:_ORG_CHART_MAX_NODES]
    n = len(blocks)
    if n == 0:
        return

    names = [b.title for b in blocks]
    parent_of = {}
    for b in blocks:
        p = b.rows[0][1] if b.rows else None
        parent_of[b.title] = p if p in names else None

    level = {}
    for name in names:
        depth, cur, seen = 0, name, set()
        while parent_of.get(cur) and depth < _ORG_CHART_MAX_LEVELS - 1 and cur not in seen:
            seen.add(cur)
            cur = parent_of[cur]
            depth += 1
        level[name] = depth

    by_level = {}
    for b in blocks:
        by_level.setdefault(level[b.title], []).append(b)
    max_level = max(by_level)
    n_levels = max_level + 1

    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    row_gap = Inches(0.4)
    node_h = min(Inches(0.8), (avail_h - row_gap * (n_levels - 1)) / n_levels)
    node_w = Inches(2.0)
    gap = Inches(0.25)

    positions = {}
    for lv in range(n_levels):
        row_blocks = by_level.get(lv, [])
        m = len(row_blocks)
        if m == 0:
            continue
        cw = min(node_w, columns_geometry(CONTENT_W, m, gap))
        row_w = cw * m + gap * (m - 1)
        x0 = MARGIN + (CONTENT_W - row_w) / 2
        y = top + lv * (node_h + row_gap)
        for i, b in enumerate(row_blocks):
            x = x0 + i * (cw + gap)
            positions[b.title] = (x, y, cw)

    # 接続線を先に描き、ノードを後から重ねて線端を隠す（3c/state_transitionと同じ手法）
    for b in blocks:
        parent = parent_of.get(b.title)
        if parent and parent in positions:
            px, py, pw = positions[parent]
            cx_, cy_, cwc = positions[b.title]
            ln = slide.shapes.add_connector(
                2, int(px + pw / 2), int(py + node_h), int(cx_ + cwc / 2), int(cy_))
            ln.line.color.rgb = theme.rgb("rule")
            ln.line.width = Pt(1.5)

    for b in blocks:
        x, y, cw = positions[b.title]
        color = "accent" if b.highlight else "main"
        add_rect(slide, int(x), int(y), int(cw), int(node_h), theme, color, rounded=True)
        add_text(slide, int(x), int(y), int(cw), int(node_h), theme, b.title,
                 size=13, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# formula — 数式型（A × B = C / A + B = C のように要素関係を式で示す）
#   props["operator"]: "x" (×) / "+" (+) / "=" の繰り返し（"x,x,=" など）
#   デフォルトは要素間 "x"、最後 "="。要素数 2〜4。
# ---------------------------------------------------------------------------
def render_formula(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    n = len(data.blocks)
    if n < 2:
        return
    # オペレータ列を組み立てる： n-1 個の演算子（最後の前は "="）
    op_spec = data.props.get("operator") or ("x," * (n-2) + "=") if n >= 2 else ""
    ops = [o.strip() for o in op_spec.split(",") if o.strip()] if "," in op_spec else list(op_spec)
    # デフォルト：最後の手前を "="、それ以前を "×"
    if not ops or len(ops) != n - 1:
        ops = ["x"] * (n - 2) + ["="] if n >= 2 else []
    op_disp = {"x": "×", "*": "×", "+": "＋", "=": "＝", "-": "−"}

    bottom = SLIDE_H - Inches(0.9)
    box_h = Inches(1.8)
    cy = (top + bottom) / 2
    # 要素ボックスと演算子テキストを並べる
    box_w = Inches(2.0)
    op_w  = Inches(0.6)
    total_w = box_w * n + op_w * (n - 1)
    start_x = SLIDE_W/2 - total_w/2

    x = start_x
    for i, blk in enumerate(data.blocks):
        color = "accent" if blk.highlight else "main"
        add_rect(slide, x, cy - box_h/2, box_w, box_h, theme, color, rounded=True)
        add_text(slide, x, cy - box_h/2, box_w, box_h*0.55, theme, blk.title,
                 size=18, color_name="on_main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)
        if blk.lines:
            add_text(slide, x, cy, box_w, box_h*0.45, theme, blk.lines[0],
                     size=11, color_name="on_main",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)
        x += box_w
        if i < n - 1:
            sym = op_disp.get(ops[i], ops[i])
            add_text(slide, x, cy - box_h/2, op_w, box_h, theme, sym,
                     size=36, color_name="ink", bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            x += op_w


# ---------------------------------------------------------------------------
# timeline — 時系列年表（左→右配置 / 26則「時系列は左から右」）
#   blocks 3〜6個。block.title=時点、block.lines=出来事
# ---------------------------------------------------------------------------
def render_timeline(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    n = len(data.blocks)
    if n == 0:
        return
    bottom = SLIDE_H - Inches(0.7)
    # 中央に横線を1本（main色）、上に時点ラベル、下にイベント説明（または交互）
    line_y = (top + bottom) / 2
    add_hline(slide, MARGIN, line_y, CONTENT_W, theme, "main", 2.5)
    step = CONTENT_W / (n - 1) if n > 1 else CONTENT_W
    for i, blk in enumerate(data.blocks):
        cx = MARGIN + (i * step if n > 1 else CONTENT_W/2)
        # ドット
        dot = Inches(0.35)
        color = "accent" if blk.highlight else "main"
        _add_oval(slide, cx - dot/2, line_y - dot/2, dot, dot, theme, color)
        # 上下交互配置（i偶数：上、奇数：下）
        up = (i % 2 == 0)
        label_h = Inches(0.5)
        desc_h = Inches(1.0)
        if up:
            ly = line_y - Inches(1.5)
            dy = line_y - Inches(0.55)
        else:
            ly = line_y + Inches(1.0)
            dy = line_y + Inches(0.25)
        # 時点（強）— ラベル幅を端で縮めて境界からはみ出さないようにする
        label_w = Inches(2.8)
        lx = cx - label_w/2
        # スライド境界にクランプ
        if lx < MARGIN:
            label_w = label_w - (MARGIN - lx)
            lx = MARGIN
        if lx + label_w > SLIDE_W - MARGIN:
            label_w = SLIDE_W - MARGIN - lx
        add_text(slide, lx, ly, label_w, label_h, theme,
                 split_emphasis(blk.title), size=14,
                 color_name=("accent" if blk.highlight else "ink"),
                 bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if blk.lines:
            add_text(slide, lx,
                     line_y - Inches(0.95) if up else line_y + Inches(0.55),
                     label_w, Inches(0.5), theme, " ".join(blk.lines),
                     size=11, color_name="muted",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP if not up else MSO_ANCHOR.BOTTOM)


# ---------------------------------------------------------------------------
# image_left — 画像（または図解領域）左 + テキスト右（26則「画像は必ず左」）
#   実画像未指定時は左に main 色の図解プレースホルダーを置く
#   blocks の各要素を右側に縦に並べる（カード）
#   props["image"] にパスがあれば貼る
# ---------------------------------------------------------------------------
def render_image_left(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    bottom = SLIDE_H - Inches(0.7)
    # 左右分割
    gap = Inches(0.4)
    left_w = (CONTENT_W - gap) * 0.45
    right_w = CONTENT_W - gap - left_w
    lh = bottom - top
    img_path = data.props.get("image")
    if img_path:
        try:
            slide.shapes.add_picture(img_path, MARGIN, top, left_w, lh)
        except Exception:
            add_rect(slide, MARGIN, top, left_w, lh, theme, "main_3", rounded=True)
            add_text(slide, MARGIN, top, left_w, lh, theme,
                     "（画像を読み込めません）", size=14, color_name="muted",
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    else:
        # プレースホルダ（編集時に差し替え）
        add_rect(slide, MARGIN, top, left_w, lh, theme, "main_3", rounded=True)
        add_text(slide, MARGIN, top, left_w, lh, theme, "画像を配置",
                 size=18, color_name="main", bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    # 右側：blocks を縦カード
    items = data.blocks
    if items:
        rx = MARGIN + left_w + gap
        ih = (lh - Inches(0.2) * (len(items) - 1)) / len(items) if items else lh
        for i, blk in enumerate(items):
            y = top + i * (ih + Inches(0.2))
            color = "accent" if blk.highlight else "main"
            chip = Inches(0.35)
            add_rect(slide, rx, y + Inches(0.15), chip, chip, theme, color, rounded=True)
            add_text(slide, rx + chip + Inches(0.2), y, right_w - chip - Inches(0.2), Inches(0.5),
                     theme, split_emphasis(blk.title), size=16, color_name="ink", bold=True)
            if blk.lines:
                add_text(slide, rx + chip + Inches(0.2), y + Inches(0.5),
                         right_w - chip - Inches(0.2), ih - Inches(0.5), theme,
                         " ".join(blk.lines), size=12, color_name="muted")


# 登録

# ---------------------------------------------------------------------------
# 強調の共通処理：accent 塗りは面積が小さいときだけ（P2: accent 面積8%上限）。
# 大きな図形は accent の太枠で強調する（色は theme 経由・塗りは通常色のまま）。
# ---------------------------------------------------------------------------
_ACCENT_FILL_MAX_RATIO = 0.06


def _accent_fill_ok(w, h) -> bool:
    return (int(w) * int(h)) / (int(SLIDE_W) * int(SLIDE_H)) <= _ACCENT_FILL_MAX_RATIO


def _accent_outline(shp, theme):
    shp.line.color.rgb = theme.rgb("accent")
    shp.line.width = Pt(3)


# ---------------------------------------------------------------------------
# mutual_relation — 相互関係（中心1者 ⇄ 相手1〜3者）
#   1個目の col = 中心（自社など）、2個目以降 = 相手（上限3。左右→下の順に配置）。
#   相手 col の rows: `give "…"`＝相手→中心に渡すもの、`get "…"`＝中心→相手に渡すもの。
#   lines はカード内の補足。各相手との間に往復2本のブロック矢印（muted）を置く。
# ---------------------------------------------------------------------------
def _relation_card(slide, theme, x, y, w, h, blk, fill, text_color):
    shp = add_rect(slide, int(x), int(y), int(w), int(h), theme, fill, rounded=True)
    if blk.highlight:
        if _accent_fill_ok(w, h):
            fill_shape(shp, theme, "accent")
            text_color = "on_accent"
        else:
            _accent_outline(shp, theme)
    lines = list(blk.lines)
    title_h = h * (0.45 if lines else 1.0)
    add_text(slide, int(x), int(y), int(w), int(title_h), theme, blk.title,
             size=16, color_name=text_color, bold=True,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM if lines else MSO_ANCHOR.MIDDLE)
    if lines:
        add_text(slide, int(x + Inches(0.1)), int(y + title_h), int(w - Inches(0.2)),
                 int(h - title_h), theme, split_emphasis(" ".join(lines)),
                 size=11, color_name=text_color,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)


def _flow_labels(blk):
    rows = dict(blk.rows)
    return rows.get("give", ""), rows.get("get", "")


def render_mutual_relation(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:4]
    if not blocks:
        return
    hub, partners = blocks[0], blocks[1:]
    k = len(partners)
    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top

    card_w = Inches(2.7)
    vgap = Inches(0.9)
    if k == 3:
        row_h = (avail_h - vgap) / 2
        row_y = top
    else:
        row_h = min(Inches(2.0), avail_h)
        row_y = top + (avail_h - row_h) / 2
    cy = row_y + row_h / 2

    # 横並び位置：相手1者なら [中心, 相手]、2者以上なら [左相手, 中心, 右相手]
    if k <= 1:
        span = CONTENT_W * 0.8
        hub_x = MARGIN + (CONTENT_W - span) / 2
        side = [(hub_x + span - card_w, "right")] if k == 1 else []
    else:
        hub_x = MARGIN + (CONTENT_W - card_w) / 2
        side = [(MARGIN, "left"), (MARGIN + CONTENT_W - card_w, "right")]

    _relation_card(slide, theme, hub_x, row_y, card_w, row_h, hub, "main", "on_main")

    arrow_t = Inches(0.32)
    label_h = Inches(0.4)
    for blk, (px, pos) in zip(partners[:2], side):
        _relation_card(slide, theme, px, row_y, card_w, row_h, blk, "main_3", "ink")
        give, get = _flow_labels(blk)
        if pos == "right":
            gx0, gx1 = hub_x + card_w, px
            to_partner, to_hub = MSO_SHAPE.RIGHT_ARROW, MSO_SHAPE.LEFT_ARROW
        else:
            gx0, gx1 = px + card_w, hub_x
            to_partner, to_hub = MSO_SHAPE.LEFT_ARROW, MSO_SHAPE.RIGHT_ARROW
        ax = gx0 + Inches(0.15)
        aw = gx1 - gx0 - Inches(0.3)
        # 上段＝中心→相手（get）、下段＝相手→中心（give）
        for shape_kind, ay, label, ly in (
            (to_partner, cy - Inches(0.08) - arrow_t, get, cy - Inches(0.08) - arrow_t - label_h),
            (to_hub, cy + Inches(0.08), give, cy + Inches(0.08) + arrow_t),
        ):
            shp = slide.shapes.add_shape(shape_kind, int(ax), int(ay), int(aw), int(arrow_t))
            fill_shape(shp, theme, "muted", no_shadow=True)
            if label:
                add_text(slide, int(ax), int(ly), int(aw), int(label_h), theme,
                         split_emphasis(label), size=11, color_name="ink",
                         align=PP_ALIGN.CENTER,
                         anchor=MSO_ANCHOR.BOTTOM if ly < cy else MSO_ANCHOR.TOP)

    if k == 3:
        blk = partners[2]
        by = row_y + row_h + vgap
        _relation_card(slide, theme, hub_x, by, card_w, row_h, blk, "main_3", "ink")
        give, get = _flow_labels(blk)
        ccx = hub_x + card_w / 2
        ay = row_y + row_h + Inches(0.1)
        ah = vgap - Inches(0.2)
        lw = Inches(2.4)
        for shape_kind, axx, label, lx, align in (
            (MSO_SHAPE.DOWN_ARROW, ccx - Inches(0.08) - arrow_t, get,
             ccx - Inches(0.16) - arrow_t - lw, PP_ALIGN.RIGHT),
            (MSO_SHAPE.UP_ARROW, ccx + Inches(0.08), give,
             ccx + Inches(0.16) + arrow_t, PP_ALIGN.LEFT),
        ):
            shp = slide.shapes.add_shape(shape_kind, int(axx), int(ay), int(arrow_t), int(ah))
            fill_shape(shp, theme, "muted", no_shadow=True)
            if label:
                add_text(slide, int(lx), int(ay), int(lw), int(ah), theme,
                         split_emphasis(label), size=11, color_name="ink",
                         align=align, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# scale_compare — 規模比較（面積∝値の円を下端揃えで並べる。2〜5個）
#   col.title＝ラベル、lines[0]＝表示値（例 "1.2兆円"）。比率計算用の数値は
#   rows の `value "12000"` があればそれ、無ければ表示値の先頭の数値を使う（単位は揃える）。
#   小さすぎて見えなくならないよう最小径を設け、表示値は円に収まらなければ円の上に出す。
# ---------------------------------------------------------------------------
_NUM_RE = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")


def _scale_value(blk) -> float:
    rows = dict(blk.rows)
    if "value" in rows:
        return parse_number(rows["value"], context=f"scale_compare {blk.title}")
    m = _NUM_RE.search(blk.lines[0]) if blk.lines else None
    if not m:
        return parse_number("", context=f"scale_compare {blk.title}")
    return parse_number(m.group(0), context=f"scale_compare {blk.title}")


def render_scale_compare(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:5]
    n = len(blocks)
    if n == 0:
        return
    values = [max(_scale_value(b), 0.0) for b in blocks]
    vmax = max(values) or 1.0

    bottom = SLIDE_H - Inches(0.7)
    label_h = Inches(0.5)
    value_h = Inches(0.4)
    baseline = bottom - label_h
    gap = Inches(0.3)
    col_w = columns_geometry(CONTENT_W, n, gap)
    d_max = min(col_w, baseline - top - value_h)
    d_min = Inches(0.3)

    for i, (blk, v) in enumerate(zip(blocks, values)):
        d = max(int(d_max * math.sqrt(v / vmax)), int(d_min))
        cx = MARGIN + i * (col_w + gap) + col_w / 2
        shp = _add_oval(slide, int(cx - d / 2), int(baseline - d), d, d, theme, "main")
        text_color = "on_main"
        if blk.highlight:
            if _accent_fill_ok(d, d):
                fill_shape(shp, theme, "accent", no_shadow=True)
                text_color = "on_accent"
            else:
                _accent_outline(shp, theme)
        add_text(slide, int(cx - col_w / 2), int(baseline + Inches(0.05)), int(col_w),
                 int(label_h - Inches(0.05)), theme, blk.title, size=14, color_name="ink",
                 bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)
        if not blk.lines:
            continue
        shown = blk.lines[0]
        if d >= Inches(1.3):
            add_text(slide, int(cx - d / 2), int(baseline - d), d, d, theme,
                     shown, size=18, color_name=text_color, bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        else:
            add_text(slide, int(cx - col_w / 2), int(baseline - d - value_h), int(col_w),
                     int(value_h), theme, shown, size=14,
                     color_name="accent" if blk.highlight else "ink", bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)


# ---------------------------------------------------------------------------
# nested_boxes — 包含（外側→内側の入れ子。2〜4段）
#   1個目の col が最外周。各段の上部帯に「ラベル（col.title）＋補足（lines）」を置き、
#   その下に1段内側の矩形を入れる。最内段はラベルと補足を中央配置。
#   色は外→内に base_2 → main_3 → main_2 → main（内側ほど濃い＝焦点）。
# ---------------------------------------------------------------------------
_NEST_COLORS = [("base_2", "ink"), ("main_3", "ink"), ("main_2", "on_main"), ("main", "on_main")]


def render_nested_boxes(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:4]
    n = len(blocks)
    if n == 0:
        return
    bottom = SLIDE_H - Inches(0.7)
    avail_h = bottom - top
    inset_x = Inches(0.35)
    inset_b = Inches(0.2)
    band_h = min(Inches(0.85), avail_h * 0.6 / max(n - 1, 1))
    palette = _NEST_COLORS[len(_NEST_COLORS) - n:] if n < len(_NEST_COLORS) else _NEST_COLORS

    x, y, w, h = MARGIN, top, CONTENT_W, avail_h
    for i, blk in enumerate(blocks):
        fill, text_color = palette[i]
        shp = add_rect(slide, int(x), int(y), int(w), int(h), theme, fill, rounded=True)
        if blk.highlight:
            if _accent_fill_ok(w, h):
                fill_shape(shp, theme, "accent")
                text_color = "on_accent"
            else:
                _accent_outline(shp, theme)
        innermost = (i == n - 1)
        desc = " ".join(blk.lines)
        if innermost:
            title_h = h * (0.5 if desc else 1.0)
            add_text(slide, int(x), int(y), int(w), int(title_h), theme, blk.title,
                     size=18, color_name=text_color, bold=True, align=PP_ALIGN.CENTER,
                     anchor=MSO_ANCHOR.BOTTOM if desc else MSO_ANCHOR.MIDDLE)
            if desc:
                add_text(slide, int(x + Inches(0.2)), int(y + title_h), int(w - Inches(0.4)),
                         int(h - title_h), theme, split_emphasis(desc), size=12,
                         color_name=text_color, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)
            break
        label_w = min(Inches(3.0), w * 0.35)
        add_text(slide, int(x + Inches(0.2)), int(y), int(label_w), int(band_h), theme,
                 blk.title, size=16, color_name=text_color, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        if desc:
            add_text(slide, int(x + Inches(0.3) + label_w), int(y), int(w - label_w - Inches(0.5)),
                     int(band_h), theme, split_emphasis(desc), size=12,
                     color_name=text_color, anchor=MSO_ANCHOR.MIDDLE)
        x, y = x + inset_x, y + band_h
        w, h = w - 2 * inset_x, h - band_h - inset_b


# ---------------------------------------------------------------------------
# logic_tree — 左→右の多段ロジックツリー＋葉ごとの注記列
#   columns "ツリーの見出し" "注記列1の見出し" "注記列2の見出し"   # 任意。無ければ見出し帯なし
#   col "既保有データ"
#   col "申請者情報"
#     親 "既保有データ"          # rows[0]の値＝親ノード名（ラベルは自由。org_chart と同じ）
#   col "アカウント情報" highlight
#     親 "申請者情報"
#     "Gビズフォーム全手続"     # 葉の lines[i]＝注記列 i の文言（{強調} 可）
#     "{GビズID}からデータを取得"
# 葉でないノードの lines はノード内の補足（小さい文字）になる。
# 上限: ノード12・レベル4・葉6・注記列2（S2 のシェイプ数上限と可読性のため。超過分は描かない）
# ---------------------------------------------------------------------------
_LOGIC_TREE_MAX_NODES = 12
_LOGIC_TREE_MAX_LEVELS = 4
_LOGIC_TREE_MAX_LEAVES = 6
_LOGIC_TREE_MAX_NOTES = 2


def _logic_tree_layout(blocks):
    """親参照を解決し、DFS順（DSL記述順）の (block, level) と葉の並びを返す。循環は根扱い。"""
    names = [b.title for b in blocks]
    parent_of = {}
    for b in blocks:
        p = b.rows[0][1] if b.rows else None
        parent_of[b.title] = p if (p in names and p != b.title) else None
    for name in names:  # 循環参照を断つ（循環に入ったノードは根にする）
        cur, seen = name, set()
        while parent_of.get(cur):
            if cur in seen:
                parent_of[name] = None
                break
            seen.add(cur)
            cur = parent_of[cur]
    children = {n: [] for n in names}
    by_name = {}
    for b in blocks:
        if b.title in by_name:
            continue  # 同名ノードは先勝ち
        by_name[b.title] = b
        if parent_of[b.title]:
            children[parent_of[b.title]].append(b)
    order, leaves = [], []

    def walk(b, lv):
        if lv >= _LOGIC_TREE_MAX_LEVELS or len(leaves) >= _LOGIC_TREE_MAX_LEAVES:
            return False
        kids = children[b.title]
        if not kids:
            order.append((b, lv, True))
            leaves.append(b)
            return True
        entry = [b, lv, False]
        order.append(entry)
        drawn = [walk(k, lv + 1) for k in kids]
        if not any(drawn):  # 子が1つも描けなかった（深さ超過）→ 自分が葉
            entry[2] = True
            leaves.append(b)
        return True

    for b in blocks:
        if parent_of[b.title] is None and by_name.get(b.title) is b:
            walk(b, 0)
    return [tuple(e) for e in order], leaves, parent_of


def _arrow_end(connector):
    ln = connector.line._get_or_add_ln()
    tail = ln.find(qn("a:tailEnd"))
    if tail is None:
        tail = ln.makeelement(qn("a:tailEnd"), {})
        ln.append(tail)
    tail.set("type", "triangle")


def render_logic_tree(slide, data: Slide, theme):
    top = render_header(slide, data, theme)
    render_foot(slide, data, theme)
    blocks = data.blocks[:_LOGIC_TREE_MAX_NODES]
    if not blocks:
        return
    order, leaves, parent_of = _logic_tree_layout(blocks)
    headers = data.props.get("columns_list") or (
        [data.props["columns"]] if data.props.get("columns") else [])
    n_notes = min(_LOGIC_TREE_MAX_NOTES,
                  max([len(headers) - 1] + [len(b.lines) for b in leaves]))
    n_levels = max(lv for _, lv, _ in order) + 1

    # 横方向：ツリー領域＋(矢印の間隔)＋注記列。注記列は後ろほど広い（説明文が入る）
    arrow_gap = Inches(0.6)
    if n_notes == 0:
        tree_w = CONTENT_W
    else:
        tree_w = int(CONTENT_W * (0.6 if n_notes == 1 else 0.5))
    notes_w = CONTENT_W - tree_w - (arrow_gap if n_notes else 0)
    note_ws = ([notes_w] if n_notes == 1 else
               [int(notes_w * 0.38), notes_w - int(notes_w * 0.38)] if n_notes == 2 else [])
    note_gap = Inches(0.2)
    note_xs, x = [], MARGIN + tree_w + arrow_gap
    for w in note_ws:
        note_xs.append(x)
        x += w
    lv_gap = Inches(0.35)
    node_w = int(min(Inches(2.6), (tree_w - lv_gap * (n_levels - 1)) / n_levels))
    node_size = 11 if n_levels >= 4 else 12

    # 列見出し帯（任意）
    y0 = top
    if headers:
        head_h = Inches(0.4)
        spans = [(MARGIN, tree_w)] + [(note_xs[i], note_ws[i] - (note_gap if i < n_notes - 1 else 0))
                                      for i in range(n_notes)]
        for (hx, hw), label in zip(spans, headers):
            add_text(slide, int(hx), int(y0), int(hw), int(head_h), theme, label,
                     size=12, color_name="muted", bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            add_hline(slide, int(hx), int(y0 + head_h), int(hw), theme, "rule", 1.0)
        y0 = y0 + head_h + Inches(0.2)

    # 縦方向：葉1つ＝1行。親は最初の子と同じ行（上揃え）に置く
    bottom = SLIDE_H - Inches(0.7)
    slot_h = (bottom - y0) / len(leaves)
    node_h = int(min(Inches(0.8), slot_h * 0.8))
    leaf_row = {id(b): i for i, b in enumerate(leaves)}
    pos = {}

    def first_leaf_row(name):
        # DFS順で name 以降に最初に現れる葉の行
        start = next(i for i, (b, _, _) in enumerate(order) if b.title == name)
        for b, _, is_leaf in order[start:]:
            if is_leaf:
                return leaf_row[id(b)]
        return 0

    for b, lv, is_leaf in order:
        row = leaf_row[id(b)] if is_leaf else first_leaf_row(b.title)
        x = MARGIN + lv * (node_w + lv_gap)
        y = int(y0 + row * slot_h + (slot_h - node_h) / 2)
        pos[b.title] = (int(x), y)

    # 親→子の結線：直線のみで組む（カギ型コネクタは描画系によって折れ位置がずれるため）。
    # 親の右端→最初の子は同じ行なので1本、残りの子は幹（隙間の中央の縦線）から水平線を引く
    def _line(x1, y1, x2, y2):
        ln = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, int(x1), int(y1), int(x2), int(y2))
        ln.line.color.rgb = theme.rgb("rule")
        ln.line.width = Pt(1.5)

    kids_of = {}
    for b, lv, _ in order:
        p = parent_of.get(b.title)
        if p and p in pos:
            kids_of.setdefault(p, []).append(b.title)
    for p, kids in kids_of.items():
        px, py = pos[p]
        trunk_x = px + node_w + lv_gap // 2
        mids = [pos[k][1] + node_h // 2 for k in kids]
        _line(px + node_w, py + node_h // 2, pos[kids[0]][0], mids[0])
        if len(kids) > 1:
            _line(trunk_x, mids[0], trunk_x, mids[-1])
            for k, m in zip(kids[1:], mids[1:]):
                _line(trunk_x, m, pos[k][0], m)

    for b, lv, is_leaf in order:
        x, y = pos[b.title]
        if b.highlight:
            color, text_color = "accent", "on_accent"
        elif lv == 0:
            color, text_color = "main", "on_main"
        else:
            color, text_color = "base_2", "ink"
        rect = add_rect(slide, x, y, node_w, node_h, theme, color)
        rect.shadow.inherit = False
        if not is_leaf and b.lines:
            box = add_text(slide, x, y, node_w, node_h, theme, b.title, size=node_size,
                           color_name=text_color, bold=True,
                           align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            p2 = box.text_frame.add_paragraph()
            p2.alignment = PP_ALIGN.CENTER
            r = p2.add_run()
            r.text = " ".join(b.lines)
            r.font.size = Pt(10)
            r.font.name = theme.font
            r.font.color.rgb = theme.rgb(text_color)
        else:
            add_text(slide, x, y, node_w, node_h, theme, b.title, size=node_size,
                     color_name=text_color, bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    # 葉→注記列（破線矢印＋文言）
    for b in leaves:
        notes = b.lines[:n_notes]
        if not notes:
            continue
        x, y = pos[b.title]
        mid = y + node_h // 2
        conn = slide.shapes.add_connector(
            MSO_CONNECTOR.STRAIGHT, x + node_w + Inches(0.08), mid,
            int(note_xs[0] - Inches(0.08)), mid)
        conn.line.color.rgb = theme.rgb("muted")
        conn.line.width = Pt(1.25)
        conn.line.dash_style = MSO_LINE.DASH
        _arrow_end(conn)
        row_top = int(mid - slot_h / 2)
        for i, note in enumerate(notes):
            w = note_ws[i] - (note_gap if i < n_notes - 1 else 0)
            add_text(slide, int(note_xs[i]), row_top, int(w), int(slot_h), theme,
                     split_emphasis(note), size=12, color_name="ink",
                     align=PP_ALIGN.CENTER if (i == 0 and n_notes == 2) else PP_ALIGN.LEFT,
                     anchor=MSO_ANCHOR.MIDDLE)


R.register("matrix", render_matrix)
R.register("cycle", render_cycle)
R.register("pyramid", render_pyramid)
R.register("tree", render_tree)
R.register("org_chart", render_org_chart)
R.register("formula", render_formula)
R.register("timeline", render_timeline)
R.register("image_left", render_image_left)
R.register("mutual_relation", render_mutual_relation)
R.register("scale_compare", render_scale_compare)
R.register("nested_boxes", render_nested_boxes)
R.register("logic_tree", render_logic_tree)
