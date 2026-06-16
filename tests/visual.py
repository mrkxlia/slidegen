"""
visual.py — 第2層：記法→pptx→画像化→モンタージュ生成

社内 Claude Code のループはこの1コマンドで回す：
  python -m tests.visual examples/showcase.slide --dpi 90 -o out/showcase.jpg

何が出る？
  - 生成された pptx
  - 各スライドの jpg
  - 全スライドを 2列で並べたモンタージュ jpg
  - 標準出力に「目視チェックリスト」（最終確認は人間が必要な箇所）

使い方（型を新規追加するときの典型ループ）:
  1. render_<新型>.py を実装
  2. examples/<新型>.slide にサンプル記法を作る
  3. pytest tests/test_invariants.py  ← 自動テスト（第1層）
  4. python -m tests.visual examples/<新型>.slide  ← モンタージュ確認（第2層）
  5. モンタージュを目で見て、意図と合っていればOK／違えば修正→2へ
"""
from __future__ import annotations
import sys, os, argparse, subprocess, shutil, pathlib, tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import slidegen
from slidegen.parser import parse
from slidegen.render import build


CHECKLIST = """
[ 第2層・目視チェックリスト ] === スライド全体を1枚絵で確認 ===
  □ はみ出し・要素重なりがないか（特にテキストと矢印、テキスト同士）
  □ 配色70:25:5が体感で守られているか（ベース白っぽい・メイン主役・accent少々）
  □ 強調は各スライドで1箇所に集約されているか（accent色が1〜2要素以内）
  □ フォントが揃っているか
  □ 余白が窮屈になっていないか／逆に間延びしすぎていないか
  □ 視線の流れがZ型 or 左→右で読めるか（時系列は特に）
  □ ヘッドラインが「言いたいこと」になっているか（事実の羅列ではない）
  □ 装飾（影・グラデ・謎の囲み）が無いか

[ 意図との一致（最終確認） ] === ここは人間にしか判断できない ===
  □ このスライドで「言いたいこと」が、見た瞬間に伝わるか
  □ 違う型のほうが伝わりやすくないか（compare→table、bullets→cardsなど）
"""


def slide_to_images(pptx_path: pathlib.Path, out_dir: pathlib.Path, dpi: int = 90):
    """pptx → 各ページjpg。LibreOffice + pdftoppm を使用。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    # PDF経由でラスタライズ
    pdf_path = out_dir / (pptx_path.stem + ".pdf")
    # LibreOffice 経由（pptx skill同梱のラッパーを使用）
    soffice_script = pathlib.Path("/mnt/skills/public/pptx/scripts/office/soffice.py")
    if soffice_script.exists():
        subprocess.run([
            "python3", str(soffice_script),
            "--headless", "--convert-to", "pdf",
            "--outdir", str(out_dir), str(pptx_path)
        ], check=True, capture_output=True)
    else:
        # フォールバック：直接 soffice 呼び出し
        subprocess.run([
            "libreoffice", "--headless", "--convert-to", "pdf",
            "--outdir", str(out_dir), str(pptx_path)
        ], check=True, capture_output=True)
    # PDF → jpg
    prefix = out_dir / "slide"
    subprocess.run([
        "pdftoppm", "-jpeg", "-r", str(dpi), str(pdf_path), str(prefix)
    ], check=True, capture_output=True)
    images = sorted(out_dir.glob("slide-*.jpg"))
    return images


def make_montage(images: list[pathlib.Path], out_path: pathlib.Path, cols: int = 2):
    """画像群を縦に並べたモンタージュを作る。"""
    from PIL import Image
    imgs = [Image.open(p) for p in images]
    if not imgs:
        raise RuntimeError("画像がありません")
    w, h = imgs[0].size
    gap_x, gap_y = 20, 12
    rows = (len(imgs) + cols - 1) // cols
    canvas_w = w * cols + gap_x * (cols + 1)
    canvas_h = h * rows + gap_y * (rows + 1)
    canvas = Image.new("RGB", (canvas_w, canvas_h), "#5a6b7a")
    for i, im in enumerate(imgs):
        r, c = divmod(i, cols)
        x = gap_x + c * (w + gap_x)
        y = gap_y + r * (h + gap_y)
        canvas.paste(im, (x, y))
    canvas.save(out_path, quality=78, optimize=True)


def main():
    ap = argparse.ArgumentParser(description="記法→pptx→モンタージュ。第2層の視覚チェック用")
    ap.add_argument("slide_file", help=".slide 記法ファイル")
    ap.add_argument("-o", "--output", default=None, help="モンタージュ出力先 jpg（省略時 ./out/<stem>.jpg）")
    ap.add_argument("--dpi", type=int, default=90)
    ap.add_argument("--cols", type=int, default=2, help="モンタージュの列数")
    ap.add_argument("--keep-individual", action="store_true", help="個別画像も残す")
    args = ap.parse_args()

    slide_file = pathlib.Path(args.slide_file)
    if not slide_file.exists():
        print(f"ERROR: {slide_file} が見つかりません", file=sys.stderr)
        sys.exit(1)

    out_dir = pathlib.Path(args.output).parent if args.output else pathlib.Path("out")
    out_path = pathlib.Path(args.output) if args.output else (out_dir / f"{slide_file.stem}.jpg")
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1) pptx 生成
    text = slide_file.read_text(encoding="utf-8")
    slides = parse(text)
    prs = build(slides)
    pptx_path = out_dir / f"{slide_file.stem}.pptx"
    prs.save(str(pptx_path))
    print(f"[1/3] pptx 生成: {pptx_path} ({len(slides)}枚, 型: {[s.type for s in slides]})")

    # 2) 画像化
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = pathlib.Path(tmp)
        # pptxをtmpにコピーしてからラスタライズ（出力先汚さない）
        shutil.copy(pptx_path, tmpdir / pptx_path.name)
        images = slide_to_images(tmpdir / pptx_path.name, tmpdir, dpi=args.dpi)
        print(f"[2/3] 画像化: {len(images)} 枚 (dpi={args.dpi})")

        # 3) モンタージュ
        make_montage(images, out_path, cols=args.cols)
        print(f"[3/3] モンタージュ: {out_path}")

        if args.keep_individual:
            for im in images:
                shutil.copy(im, out_dir / im.name)

    print(CHECKLIST)
    print(f"→ 確認してOKなら次のタスクへ。修正があれば記法/レンダラを直して再実行。")


if __name__ == "__main__":
    main()
