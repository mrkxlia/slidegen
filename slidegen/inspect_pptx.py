"""
inspect_pptx.py — 既存の .pptx から「型スペック」を抽出する（②の入力=PowerPoint）。

目的：手元にある良いスライドの構造を、機械的に読み取って JSON 化する。
抽出するのは「どこに・何が・どれだけ」あるか：
  - 各シェイプの種類 / 位置(相対%) / サイズ / テキスト有無 / 塗り色
  - テキストのフォントサイズ階層（見出し/本文/注釈の推定）
  - 配色（使われている色とおおよその面積比 → 70:25:5 になっているか点検）
この JSON を Claude（社内Claude Code）に渡せば、既存型への当てはめ or 新型の設計ができる。

※これは「決定的に読める部分」を担当する。意味の解釈（compare型だ等）はLLMが行う分業。

使い方:
    python -m slidegen.inspect_pptx good_deck.pptx          # 全スライドのスペックをJSON出力
    python -m slidegen.inspect_pptx good_deck.pptx -n 3     # 3枚目だけ
"""
from __future__ import annotations
import sys, json, argparse
from collections import Counter
from pptx import Presentation
from pptx.util import Emu


def _emu_to_pct(v, total):
    try:
        return round(100.0 * float(v) / float(total), 1)
    except Exception:
        return None


def _shape_fill_hex(shape):
    try:
        f = shape.fill
        if f.type is not None and f.fore_color and f.fore_color.type is not None:
            rgb = f.fore_color.rgb
            return str(rgb)
    except Exception:
        pass
    return None


def _font_sizes(shape):
    sizes = []
    if shape.has_text_frame:
        for p in shape.text_frame.paragraphs:
            for r in p.runs:
                if r.font.size:
                    sizes.append(int(r.font.size.pt))
    return sizes


def inspect_slide(slide, sw, sh) -> dict:
    shapes = []
    color_area = Counter()
    all_sizes = []
    for sh_ in slide.shapes:
        item = {
            "kind": str(sh_.shape_type),
            "x%": _emu_to_pct(sh_.left, sw) if sh_.left is not None else None,
            "y%": _emu_to_pct(sh_.top, sh) if sh_.top is not None else None,
            "w%": _emu_to_pct(sh_.width, sw) if sh_.width is not None else None,
            "h%": _emu_to_pct(sh_.height, sh) if sh_.height is not None else None,
            "text": (sh_.text_frame.text.strip()[:40] if sh_.has_text_frame else ""),
        }
        fill = _shape_fill_hex(sh_)
        item["fill"] = fill
        sizes = _font_sizes(sh_)
        if sizes:
            item["font_pt"] = sizes
            all_sizes += sizes
        if fill and sh_.width and sh_.height:
            color_area[fill] += int(sh_.width) * int(sh_.height)
        shapes.append(item)

    # フォント階層の推定（大→小）
    uniq = sorted(set(all_sizes), reverse=True)
    hierarchy = {}
    if uniq:
        hierarchy["headline_pt"] = uniq[0]
        if len(uniq) > 1:
            hierarchy["body_pt"] = uniq[len(uniq) // 2]
        if len(uniq) > 2:
            hierarchy["caption_pt"] = uniq[-1]

    # 配色の面積比（70:25:5 になっているかの点検材料）
    total_area = sum(color_area.values()) or 1
    palette = [{"color": c, "area%": round(100 * a / total_area, 1)}
               for c, a in color_area.most_common(6)]

    return {
        "n_shapes": len(shapes),
        "font_hierarchy": hierarchy,
        "palette_by_area": palette,
        "shapes": shapes,
    }


def inspect(path: str, only: int | None = None) -> dict:
    prs = Presentation(path)
    sw, sh = prs.slide_width, prs.slide_height
    out = {"file": path, "slide_size_emu": [int(sw), int(sh)], "slides": []}
    for i, slide in enumerate(prs.slides, 1):
        if only and i != only:
            continue
        spec = inspect_slide(slide, sw, sh)
        spec["index"] = i
        out["slides"].append(spec)
    return out


def main():
    ap = argparse.ArgumentParser(description="既存pptxから型スペックを抽出")
    ap.add_argument("pptx")
    ap.add_argument("-n", type=int, default=None, help="特定スライド番号のみ")
    ap.add_argument("-o", "--output", default=None, help="JSON出力先（省略時stdout）")
    args = ap.parse_args()
    data = inspect(args.pptx, args.n)
    js = json.dumps(data, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(js)
        print(f"出力: {args.output}")
    else:
        print(js)


if __name__ == "__main__":
    main()
