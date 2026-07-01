"""
cli.py — コマンドラインから記法ファイルをpptxに変換。

使い方:
    python -m slidegen.cli input.slide -o output.pptx
    python -m slidegen.cli input.slide -o output.pptx --template company.potx
"""
import argparse
import sys
import slidegen   # 追加型(render_more)の登録を確実にする
from .parser import parse
from .render import build, RENDERERS
from .dsl_validator import validate as validate_dsl


def main():
    ap = argparse.ArgumentParser(description="記法(DSL)から編集可能なpptxを生成")
    ap.add_argument("input", help="記法ファイル(.slide)")
    ap.add_argument("-o", "--output", default="output.pptx", help="出力pptxパス")
    ap.add_argument("--template", default=None, help="会社の .potx/.pptx テンプレート（任意）")
    args = ap.parse_args()

    with open(args.input, encoding="utf-8") as f:
        text = f.read()
    slides = parse(text)

    val = validate_dsl(slides, RENDERERS)
    for msg in val.warnings:
        print(f"Warning: {msg}", file=sys.stderr)
    if val.blocking_warnings:
        for msg in val.blocking_warnings:
            print(f"Error: {msg}", file=sys.stderr)
        sys.exit(1)

    prs = build(slides, template=args.template)
    prs.save(args.output)
    print(f"生成: {args.output}（{len(slides)}枚, 型: {[s.type for s in slides]}）")


if __name__ == "__main__":
    main()
