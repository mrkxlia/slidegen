"""test_dsl_reference.py — dsl-reference.md が教える型 ≡ 実レンダラ(RENDERERS)、を保証する CI ガード。

スキル(dsl-reference.md)が LLM に教える型と、本体 slidegen のレンダラ登録型が食い違うと
2方向の事故になる: (a) 教える型が未登録 → 生成DSLが描画できない、(b) RENDERERS にある型を
教え忘れる → その型が永久にAIの選択肢から漏れる（デザイン取り込みでの再構成先にもならない）。
ここを機械的に固定する（backlog #2: chart型の⊆保証を全型の⊆/⊇＝同値保証に拡張）。

旧 frontend/src/prompts.ts の DSL_REFERENCE を skills/slidegen/references/dsl-reference.md へ
移設した際、読み取り先を付け替えたもの（S1）。抽出ロジック自体は無変更。
"""
from pathlib import Path
import re

from slidegen.render import RENDERERS

ROOT = Path(__file__).resolve().parent.parent
DSL_REFERENCE_MD = ROOT / "skills" / "slidegen" / "references" / "dsl-reference.md"

# dsl-reference.md が教えるネイティブ chart 型（render_charts.py と一致しているべき）
TAUGHT_CHART_TYPES = {
    "bar_chart", "line_chart", "bar_horizontal",
    "stacked_bar", "stacked_100_bar", "clustered_bar",
}


def test_taught_chart_types_are_registered():
    missing = TAUGHT_CHART_TYPES - set(RENDERERS)
    assert not missing, f"dsl-reference.md が教える未登録の chart 型: {missing}"


def test_dsl_reference_does_not_use_legacy_chart_dsl():
    text = DSL_REFERENCE_MD.read_text(encoding="utf-8")
    # zip 版の単数 `chart` 型 / `chart_type` プロパティは本体に存在しない。
    # 説明文での言及は許すが、DSL の実使用パターン（`chart_type "..."`、`slide chart` 改行）は禁止。
    assert not re.search(r'chart_type\s+"', text), "dsl-reference.md に廃止された chart_type 記法(DSL使用)が残っている"
    assert not re.search(r"slide chart\s*\n", text), "dsl-reference.md に廃止された単数 `slide chart` の例が残っている"


def test_dsl_reference_taught_types_match_taught_set():
    """dsl-reference.md 内に列挙された chart 型が TAUGHT_CHART_TYPES と一致（取りこぼし検知）。"""
    text = DSL_REFERENCE_MD.read_text(encoding="utf-8")
    for t in TAUGHT_CHART_TYPES:
        assert t in text, f"dsl-reference.md に {t} の記載が無い（リファレンス不足）"


def _taught_types_in_dsl_reference() -> set:
    """dsl-reference.md(live プロンプト)が AI に教える型名を抽出する。
    (a) `slide <型>` のコード例、(b) スラッシュ区切りの型カタログ列（"- a / b / c … 説明"）。
    誤検知回避のため (b) は `^[a-z0-9][a-z0-9_]*$` のクリーンなトークンのみ採用
    （`swot系`・`(2〜4)`・装飾付きはスキップ）。先頭は数字も許容する（`5e` 型のため）。
    """
    text = DSL_REFERENCE_MD.read_text(encoding="utf-8")
    taught = set(re.findall(r'(?m)^\s*slide\s+([a-z0-9][a-z0-9_]*)', text))
    for line in text.splitlines():
        if re.match(r'^\s*-\s', line) and ' / ' in line:
            head = line.split('…')[0]
            for raw in head.split('/'):
                tok = re.sub(r'\([^)]*\)', '', raw).strip(' \t-')
                if re.fullmatch(r'[a-z0-9][a-z0-9_]*', tok):
                    taught.add(tok)
    return taught


def test_dsl_reference_taught_types_are_registered():
    """dsl-reference.md が教える全型 ⊆ RENDERERS（未登録型を AI に教える＝生成DSLが描画不能、を防ぐ）。"""
    taught = _taught_types_in_dsl_reference()
    assert taught, "dsl-reference.md から型を1つも抽出できない（抽出ロジックの破綻）"
    missing = sorted(t for t in taught if t not in RENDERERS)
    assert not missing, f"dsl-reference.md が教える未登録の型: {missing}（型を登録するか dsl-reference.md を修正）"


def test_renderers_are_all_taught_by_dsl_reference():
    """RENDERERS 全型 ⊆ dsl-reference.md が教える型（教え忘れを防ぐ。上のテストと合わせて同値を保証）。

    100型登録されていても dsl-reference.md のカタログに載っていなければ、AI はその型を
    一生選ばない（新規生成でもデザイン取り込みの再構成先でも死蔵する）。
    """
    taught = _taught_types_in_dsl_reference()
    missing = sorted(t for t in RENDERERS if t not in taught)
    assert not missing, f"RENDERERS にあるが dsl-reference.md が教えていない型: {missing}（型カタログに追記する）"
