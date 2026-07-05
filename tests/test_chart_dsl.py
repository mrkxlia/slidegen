"""test_chart_dsl.py — prompts.ts が教える型 ≡ 実レンダラ(RENDERERS)、を保証する CI ガード。

フロント(prompts.ts)が LLM に教える型と、本体 slidegen のレンダラ登録型が食い違うと
2方向の事故になる: (a) 教える型が未登録 → 生成DSLが描画できない、(b) RENDERERS にある型を
教え忘れる → その型が永久にAIの選択肢から漏れる（デザイン取り込みでの再構成先にもならない）。
ここを機械的に固定する（backlog #2: chart型の⊆保証を全型の⊆/⊇＝同値保証に拡張）。
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


def _taught_types_in_prompts() -> set:
    """prompts.ts(live プロンプト)が AI に教える型名を抽出する。
    (a) `slide <型>` のコード例、(b) スラッシュ区切りの型カタログ列（"- a / b / c … 説明"）。
    誤検知回避のため (b) は `^[a-z0-9][a-z0-9_]*$` のクリーンなトークンのみ採用
    （`swot系`・`(2〜4)`・装飾付きはスキップ）。先頭は数字も許容する（`5e` 型のため）。
    """
    text = PROMPTS_TS.read_text(encoding="utf-8")
    taught = set(re.findall(r'(?m)^\s*slide\s+([a-z0-9][a-z0-9_]*)', text))
    for line in text.splitlines():
        if re.match(r'^\s*-\s', line) and ' / ' in line:
            head = line.split('…')[0]
            for raw in head.split('/'):
                tok = re.sub(r'\([^)]*\)', '', raw).strip(' \t-')
                if re.fullmatch(r'[a-z0-9][a-z0-9_]*', tok):
                    taught.add(tok)
    return taught


def test_prompts_taught_types_are_registered():
    """prompts.ts が教える全型 ⊆ RENDERERS（未登録型を AI に教える＝生成DSLが描画不能、を防ぐ）。"""
    taught = _taught_types_in_prompts()
    assert taught, "prompts.ts から型を1つも抽出できない（抽出ロジックの破綻）"
    missing = sorted(t for t in taught if t not in RENDERERS)
    assert not missing, f"prompts.ts が教える未登録の型: {missing}（型を登録するか prompts.ts を修正）"


def test_renderers_are_all_taught_by_prompts():
    """RENDERERS 全型 ⊆ prompts.ts が教える型（教え忘れを防ぐ。上のテストと合わせて同値を保証）。

    100型登録されていても prompts.ts のカタログに載っていなければ、AI はその型を
    一生選ばない（新規生成でもデザイン取り込みの再構成先でも死蔵する）。
    """
    taught = _taught_types_in_prompts()
    missing = sorted(t for t in RENDERERS if t not in taught)
    assert not missing, f"RENDERERS にあるが prompts.ts が教えていない型: {missing}（型カタログに追記する）"


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
