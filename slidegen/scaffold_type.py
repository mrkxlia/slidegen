"""
scaffold_type.py — 「型スペック(JSON)」から新しい render 関数の雛形を生成する（②の出力）。

役割：カタログにない構造を新型として足すとき、ゼロから書かずに雛形を出す。
入力 typespec.json の形式（Claudeが Web/画像/pptx から起こす中間表現）:

{
  "name": "feature_grid",          # 型名（英小文字_）
  "intent": "特徴を3〜6個グリッドで見せる",
  "uses_header": true,             # 共通ヘッダ(kicker/headline)を使うか
  "uses_foot": true,
  "element": "col",                # 繰り返し要素（基本 col）
  "count_rule": "3..6",            # 要素数の許容範囲（要素数パターン化）
  "layout": "grid",                # grid | columns | rows | centered | table
  "highlight": "accent",           # 強調は accent のみ（固定）
  "regions": [                     # 任意：各要素内のテキスト領域
    {"role": "title", "size": "col_title"},
    {"role": "desc",  "size": "body"}
  ]
}

出力：slidegen/render_<name>.py の雛形。中身を社内Claude Codeが詰める。
原則：色・フォントは theme 経由のみ。強調は accent のみ。新色を足さない。
"""
from __future__ import annotations
import json, argparse


LAYOUT_HINTS = {
    "grid":     "cols = 2 if n <= 4 else 3  # 要素数で列数を決める",
    "columns":  "cols = n                   # 横一列",
    "rows":     "rows = n                   # 縦積み",
    "centered": "# 中央に1要素を大きく",
    "table":    "# slide.shapes.add_table(...) を使う（本物のPPTテーブル）",
}


def scaffold(spec: dict) -> str:
    name = spec["name"]
    intent = spec.get("intent", "")
    uses_header = spec.get("uses_header", True)
    uses_foot = spec.get("uses_foot", True)
    layout = spec.get("layout", "columns")
    count_rule = spec.get("count_rule", "n")
    hint = LAYOUT_HINTS.get(layout, "")
    regions = spec.get("regions", [])
    region_lines = "\n".join(
        f'        # {r.get("role","?")}: size=theme.sz_{r.get("size","body")}'
        for r in regions
    ) or "        # 各要素内の領域をここに描く"

    return f'''"""
render_{name}.py — 型「{name}」: {intent}
自動生成された雛形。社内Claude Codeで中身を実装する。
規約: §2-bis(編集可能・ネイティブ要素のみ) / §3(強調はaccentのみ・新色禁止)。
要素数ルール: {count_rule}
"""
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from . import render as R
from .render import (add_rect, add_text, add_hline, render_header, render_foot,
                     SLIDE_W, SLIDE_H, MARGIN, CONTENT_W)
from .parser import Slide, split_emphasis


def render_{name}(slide, data: Slide, theme):
    top = {"render_header(slide, data, theme)" if uses_header else "MARGIN"}
    {"render_foot(slide, data, theme)" if uses_foot else ""}
    n = len(data.blocks)
    if n == 0:
        return
    {hint}
    bottom = SLIDE_H - Inches(0.7)

    for i, blk in enumerate(data.blocks):
        color = "accent" if blk.highlight else "main"   # 強調はaccentのみ
        # TODO: レイアウト({layout})に従って配置を実装
        # 利用可能: add_rect(slide,x,y,w,h,theme,color_name,rounded=) /
        #          add_text(slide,x,y,w,h,theme,runs,size=,color_name=,bold=,align=,anchor=) /
        #          add_hline(slide,x,y,w,theme,color_name,weight)
{region_lines}
        pass


R.register("{name}", render_{name})
'''


def main():
    ap = argparse.ArgumentParser(description="型スペックからrender関数の雛形を生成")
    ap.add_argument("typespec", help="型スペックJSONファイル")
    ap.add_argument("-o", "--output", default=None, help="出力 .py（省略時stdout）")
    args = ap.parse_args()
    with open(args.typespec, encoding="utf-8") as f:
        spec = json.load(f)
    code = scaffold(spec)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(code)
        print(f"生成: {args.output}（型: {spec['name']}）")
    else:
        print(code)


if __name__ == "__main__":
    main()
