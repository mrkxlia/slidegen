"""
test_inspect_pptx.py — inspect_pptx（既存 pptx の構造抽出）のテスト。

デザイン取り込み（ブラウザの Pyodide worker → LLM）の入力になる
inspect() / inspect_compact() を、slidegen 自身が生成した pptx で検証する。
純Python・LibreOffice 不要。
"""
import pathlib

import slidegen
from slidegen.inspect_pptx import inspect, inspect_compact

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLE = (REPO_ROOT / "examples" / "sample.slide").read_text(encoding="utf-8")


def _sample_pptx(tmp_path) -> str:
    out = tmp_path / "deck.pptx"
    out.write_bytes(slidegen.render_to_bytes(SAMPLE))
    return str(out)


def test_inspect_returns_spec_fields(tmp_path):
    from slidegen.parser import parse

    data = inspect(_sample_pptx(tmp_path))
    assert len(data["slides"]) == len(parse(SAMPLE))
    assert len(data["slide_size_emu"]) == 2
    for spec in data["slides"]:
        assert spec["n_shapes"] == len(spec["shapes"])
        for s in spec["shapes"]:
            # 配置は%（0..100）で正規化されている。
            for k in ("x%", "y%", "w%", "h%"):
                if s[k] is not None:
                    assert -50 <= s[k] <= 150  # 意図的なはみ出し装飾を許容
    # 少なくとも1枚はフォント階層と面積パレットが取れる。
    assert any(spec["font_hierarchy"] for spec in data["slides"])
    assert any(spec["palette_by_area"] for spec in data["slides"])


def test_inspect_text_limit_expands_truncation(tmp_path):
    path = _sample_pptx(tmp_path)
    short = inspect(path, text_limit=5)
    long = inspect(path, text_limit=500)
    assert all(len(s["text"]) <= 5 for sp in short["slides"] for s in sp["shapes"])
    joined = lambda d: sum(len(s["text"]) for sp in d["slides"] for s in sp["shapes"])
    assert joined(long) > joined(short)


def test_inspect_compact_is_bounded_text(tmp_path):
    text = inspect_compact(_sample_pptx(tmp_path))
    assert text.startswith("deck: ")
    assert "[S1]" in text
    # スライドあたりの上限（見出し行＋図形行）が効いている。
    for block in text.split("\n\n")[1:]:
        assert len(block) <= 1600 + 200  # 見出し行と omitted 行の余裕分


def test_inspect_compact_caps_slides(tmp_path):
    # 40枚のデッキ → 30枚で打ち切り、省略数を明記する。
    dsl = "\n---\n".join(f'slide statement\n  headline "S{i}"' for i in range(40))
    out = tmp_path / "big.pptx"
    out.write_bytes(slidegen.render_to_bytes(dsl))
    text = inspect_compact(str(out))
    assert "[S30]" in text and "[S31]" not in text
    assert "(10 more slides omitted)" in text
