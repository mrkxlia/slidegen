"""
new_type.py — 新しい型を1コマンドで追加するためのワークフロー（Claude Code向け）

Claude Code が「新しい型を足す」と言われたとき、これを使う：

  uv run --extra dev python tools/new_type.py pyramid_inverted \\
    --intent "じょうろ型ピラミッド：下位ほど規模が小" \\
    --layout columns --count "3..5"

1コマンドで以下を実行：
  1. 型スペック JSON を保存
  2. slidegen/render_<name>.py の雛形を生成
  3. examples/<name>.slide のサンプル記法スケルトンを生成
  4. （実装後に）pytest を走らせて第1層を通過確認
  5. （実装後に）モンタージュを生成

ループの回し方:
  $ uv run --extra dev python tools/new_type.py mytype --intent "..." --layout grid
   → 雛形ファイルが生成される
  $ # ここで slidegen/render_mytype.py の TODO を埋める
  $ # examples/mytype.slide のサンプル記法を仕上げる
  $ uv run --extra dev python tools/new_type.py mytype --check
   → pytest + モンタージュ生成 + チェックリスト表示
"""
from __future__ import annotations
import sys, os, json, argparse, subprocess, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLIDEGEN = ROOT / "slidegen"
EXAMPLES = ROOT / "examples"
SPECS = ROOT / "type_specs"


SAMPLE_SLIDE_TEMPLATE = """\
# {name} 型のサンプル記法
# 目的: {intent}

slide {name}
  kicker   "（任意の小見出し）"
  headline "ここに{name}型で言いたいことを書く"
  foot     "出典（任意）"

  col "要素1"
    "短い説明"
  col "要素2" highlight
    "強調したい要素（accentに）"
  col "要素3"
    "短い説明"
"""


def step_init(args):
    """Phase 1: 雛形を作る"""
    spec = {
        "name": args.name,
        "intent": args.intent,
        "uses_header": True,
        "uses_foot": True,
        "element": "col",
        "count_rule": args.count,
        "layout": args.layout,
        "highlight": "accent",
        "regions": [
            {"role": "title", "size": "col_title"},
            {"role": "desc",  "size": "body"},
        ],
    }
    SPECS.mkdir(exist_ok=True)
    spec_path = SPECS / f"{args.name}.json"
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ✓ 型スペック: {spec_path}")

    # render関数の雛形を生成
    render_path = SLIDEGEN / f"render_{args.name}.py"
    if render_path.exists() and not args.force:
        print(f"  ! {render_path} が既に存在。--force で上書き")
    else:
        subprocess.run([
            sys.executable, "-m", "slidegen.scaffold_type",
            str(spec_path), "-o", str(render_path),
        ], check=True, cwd=str(ROOT))
        print(f"  ✓ レンダラ雛形: {render_path}")

    # __init__.py に登録を追加（自動）
    init_path = SLIDEGEN / "__init__.py"
    text = init_path.read_text(encoding="utf-8")
    import_line = f"from . import render_{args.name}"
    if import_line not in text:
        # render_relations の後ろに足す
        marker = "from . import render_relations"
        if marker in text:
            new_text = text.replace(marker,
                f"{marker}\nfrom . import render_{args.name}  # noqa: F401")
            init_path.write_text(new_text, encoding="utf-8")
            print(f"  ✓ __init__.py に登録")
        else:
            print(f"  ! __init__.py に手動で 'from . import render_{args.name}' を追加してください")

    # サンプル記法のスケルトンを生成
    sample_path = EXAMPLES / f"{args.name}.slide"
    if sample_path.exists() and not args.force:
        print(f"  ! {sample_path} が既に存在")
    else:
        sample_path.write_text(
            SAMPLE_SLIDE_TEMPLATE.format(name=args.name, intent=args.intent),
            encoding="utf-8",
        )
        print(f"  ✓ サンプル記法: {sample_path}")

    print()
    print("次のステップ:")
    print(f"  1. {render_path} の TODO を実装")
    print(f"  2. {sample_path} のサンプル記法を仕上げる")
    print(f"  3. uv run --extra dev python tools/new_type.py {args.name} --check で検証")


def step_check(args):
    """Phase 2: テスト＋モンタージュで検証"""
    sample_path = EXAMPLES / f"{args.name}.slide"
    if not sample_path.exists():
        print(f"ERROR: {sample_path} がない。先に --init してください", file=sys.stderr)
        sys.exit(1)

    # 1) 第1層：pytest
    print("=" * 60)
    print("[ 第1層 ] 構造インバリアントの自動テスト (pytest)")
    print("=" * 60)
    r = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_invariants.py", "-q"],
        cwd=str(ROOT), env={**os.environ, "PYTHONPATH": str(ROOT)},
    )
    if r.returncode != 0:
        print("\n❌ 第1層テスト失敗。実装を見直してください。")
        sys.exit(1)
    print("✅ 第1層テスト通過")

    # 2) 第2層：モンタージュ生成
    print()
    print("=" * 60)
    print("[ 第2層 ] モンタージュ生成 → 目視確認")
    print("=" * 60)
    r = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "visual.py"), str(sample_path),
         "-o", f"out/{args.name}.jpg"],
        cwd=str(ROOT), env={**os.environ, "PYTHONPATH": str(ROOT)},
    )
    if r.returncode != 0:
        print("❌ モンタージュ生成失敗")
        sys.exit(1)
    print()
    print(f"✅ 完了。out/{args.name}.jpg を開いて、上のチェックリストに沿って目視確認")


def main():
    ap = argparse.ArgumentParser(description="新型追加ワークフロー（Claude Code向け）")
    ap.add_argument("name", help="型名（英小文字_）")
    ap.add_argument("--intent", default="", help="型の意図（短文）")
    ap.add_argument("--layout", default="columns",
                    choices=["grid", "columns", "rows", "centered", "table"])
    ap.add_argument("--count", default="2..4", help="要素数ルール（例: '3..6'）")
    ap.add_argument("--force", action="store_true", help="既存ファイルを上書き")
    ap.add_argument("--check", action="store_true", help="検証フェーズだけ実行")
    args = ap.parse_args()

    if args.check:
        step_check(args)
    else:
        step_init(args)


if __name__ == "__main__":
    main()
