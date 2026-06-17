"""test_chart_dsl.py — prompts.ts が教える型 ⊆ 実レンダラ、を保証する CI ガード。

フロント(prompts.ts)が LLM に教える chart 型と、本体 slidegen のレンダラ登録型が
食い違うと「生成DSLが描画できない」事故になる。ここを機械的に固定する。
"""
from pathlib import Path
import re
import io

import slidegen
from slidegen.render import RENDERERS, build
from slidegen.parser import parse

ROOT = Path(__file__).resolve().parent.parent
PROMPTS_TS = ROOT / "frontend" / "src" / "prompts.ts"
EXAMPLES = sorted((ROOT / "examples").glob("*.slide"))

# prompts.ts が教えるネイティブ chart 型（render_charts.py と一致しているべき）
TAUGHT_CHART_TYPES = {
    "bar_chart", "line_chart", "bar_horizontal",
    "stacked_bar", "stacked_100_bar", "clustered_bar",
}


def test_taught_chart_types_are_registered():
    missing = TAUGHT_CHART_TYPES - set(RENDERERS)
    assert not missing, f"prompts.ts が教える未登録の chart 型: {missing}"


def test_prompts_does_not_use_legacy_chart_dsl():
    text = PROMPTS_TS.read_text(encoding="utf-8")
    # zip 版の単数 `chart` 型 / `chart_type` プロパティは本体に存在しない。
    # 説明文での言及は許すが、DSL の実使用パターン（`chart_type "..."`、`slide chart` 改行）は禁止。
    assert not re.search(r'chart_type\s+"', text), "prompts.ts に廃止された chart_type 記法(DSL使用)が残っている"
    assert not re.search(r"slide chart\s*\n", text), "prompts.ts に廃止された単数 `slide chart` の例が残っている"


def test_prompts_taught_types_match_taught_set():
    """prompts.ts 内に列挙された chart 型が TAUGHT_CHART_TYPES と一致（取りこぼし検知）。"""
    text = PROMPTS_TS.read_text(encoding="utf-8")
    for t in TAUGHT_CHART_TYPES:
        assert t in text, f"prompts.ts に {t} の記載が無い（リファレンス不足）"


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
    """template 未指定で既定テンプレートが解決できる（ブラウザ Pyodide でも同経路）。"""
    prs = build(parse('slide title\n  headline "テスト"'))
    buf = io.BytesIO()
    prs.save(buf)
    assert buf.getvalue()[:2] == b"PK"
