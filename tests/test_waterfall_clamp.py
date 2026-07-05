"""
test_waterfall_clamp.py — waterfall（render_data_support.render_waterfall）の負値クランプの回帰テスト。

累計が負に振れる場合でも、バーの図形が plot 領域の下端を突き抜けないことを確認する
（修正前は vmax が正の最大値しか見ておらず、val<0 のとき y 座標が範囲外に出ていた）。
"""
from pptx.util import Inches

import slidegen  # 全 render_* を登録
from slidegen.render import build, SLIDE_H
from slidegen.parser import Slide, Block


def _waterfall_shape_bottoms():
    slide_data = Slide(
        type="waterfall",
        props={"headline": "赤字転落のケース"},
        blocks=[
            Block(title="期初", highlight=True, lines=["10"]),
            Block(title="大幅減", lines=["-50"]),   # 累計が負に転落する
            Block(title="期末", highlight=True, lines=["-40"]),
        ],
    )
    prs = build([slide_data])
    slide = prs.slides[0]
    plot_bottom = SLIDE_H - Inches(1.0)
    # rect 系シェイプ（バー本体）の top+height が plot 下端をどれだけ超えるかを集計。
    return [sh.top + sh.height for sh in slide.shapes if sh.shape_type is not None], plot_bottom


def test_negative_cumulative_bars_do_not_overflow_plot_bottom():
    bottoms, plot_bottom = _waterfall_shape_bottoms()
    # カテゴリラベル(下端 bottom+0.4in 付近)は許容し、バー本体のみを見たいので緩めの上限を取る。
    margin = Inches(0.5)
    assert all(b <= plot_bottom + margin for b in bottoms), (
        f"plot_bottom={plot_bottom} を大きく超える図形がある: {bottoms}"
    )
