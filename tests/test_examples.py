"""test_examples.py — examples/*.slide の parse/render 回帰と、既定テンプレート解決の検証。"""
from pathlib import Path
import io

import slidegen
from slidegen.render import RENDERERS, build
from slidegen.parser import parse

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = sorted((ROOT / "examples").glob("*.slide"))


def test_all_examples_parse_and_render():
    """全 examples が parse → render_to_bytes まで通る（回帰防止スナップショット）。"""
    assert EXAMPLES, "examples/*.slide が見つからない"
    for path in EXAMPLES:
        text = path.read_text(encoding="utf-8")
        slides = parse(text)
        assert slides, f"{path.name}: parse 結果が空"
        # 参照される型はすべて登録済みであること
        for s in slides:
            assert s.type in RENDERERS, f"{path.name}: 未登録の型 {s.type}"
        b = slidegen.render_to_bytes(text)
        assert b[:2] == b"PK", f"{path.name}: 生成物が pptx(zip) でない"


def test_default_template_resolves():
    """template 未指定で既定テンプレートが解決できる。"""
    prs = build(parse('slide title\n  headline "テスト"'))
    buf = io.BytesIO()
    prs.save(buf)
    assert buf.getvalue()[:2] == b"PK"
