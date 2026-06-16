"""
__main__.py — 統合CLI。`slidegen` コマンド／`python -m slidegen` の入口。

サブコマンド:
  slidegen build  input.slide -o out.pptx [--template company.potx]
  slidegen sync   original.slide edited.pptx [--apply] [-o updated.slide]

後方互換：従来の `python -m slidegen.cli` / `python -m slidegen.sync` も
そのまま使える（cli.py / sync.py の main() を温存）。本ファイルはそれらと同じ
ロジックを薄く再構成し、build は api.render_file を、sync は sync モジュールの
関数を再利用する。
"""
from __future__ import annotations
import argparse

import slidegen  # 親パッケージの import で全 render_* が登録される
from .api import render_text, render_file
from . import sync as _sync


def _cmd_build(args) -> None:
    out = render_file(args.input, args.output, template=args.template)
    # 枚数・型は API では露出しないので、メッセージ用に軽く再パースする
    slides = slidegen.parse(open(args.input, encoding="utf-8").read())
    print(f"生成: {out}（{len(slides)}枚, 型: {[s.type for s in slides]}）")


def _cmd_sync(args) -> None:
    with open(args.slide, encoding="utf-8") as f:
        src = f.read()
    diff = _sync.compute_diff(src, args.edited_pptx)
    print(_sync._format_diff(diff))
    if args.apply:
        new_src, applied = _sync.apply_changes(src, diff)
        out = args.output or args.slide
        with open(out, "w", encoding="utf-8") as f:
            f.write(new_src)
        print(f"\n→ {applied}件の文言変更を {out} に反映しました。")
    else:
        total = sum(len(e["changes"]) for e in diff)
        if total:
            print(f"\n（dry-run）{total}件の文言変更を検出。--apply で .slide に反映します。")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="slidegen",
        description="記法(DSL)から編集可能なpptxを生成し、手編集を記法へ同期する統合CLI")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="記法ファイル(.slide)から pptx を生成")
    b.add_argument("input", help="記法ファイル(.slide)")
    b.add_argument("-o", "--output", default="output.pptx", help="出力pptxパス")
    b.add_argument("--template", default=None, help="会社の .potx/.pptx テンプレート（任意）")
    b.set_defaults(func=_cmd_build)

    s = sub.add_parser("sync", help="編集後pptxの文言変更を元の.slideに反映")
    s.add_argument("slide", help="生成元の記法ファイル(.slide)")
    s.add_argument("edited_pptx", help="人が編集した後の .pptx")
    s.add_argument("--apply", action="store_true", help=".slide を実際に書き換える")
    s.add_argument("-o", "--output", default=None,
                   help="書き換え結果の保存先（省略時は元の.slideを上書き）")
    s.set_defaults(func=_cmd_sync)
    return ap


def main(argv=None) -> None:
    ap = build_parser()
    args = ap.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
