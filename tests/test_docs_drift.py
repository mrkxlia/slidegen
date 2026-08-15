"""test_docs_drift.py — 人間向け DSL 解説 docs が教える型 ⊆ 実レンダラ、を保証する CI ガード。

ライブの DSL リファレンス（dsl-reference.md）は test_dsl_reference.py がガードするが、
設計参照ドキュメント（docs/system_prompt.md / docs/type_catalog.md）が RENDERERS と乖離しても
検知されず、AI や新規参加者に「存在しない型」を教える事故になりうる。

抽出の方針（誤検知したら docs でなく抽出規則側を絞る）:
- system_prompt.md: 実装済み型のみ教える文書 → 型一覧の箇条書き（バッククォート）と
  判断テーブル右列を素直に抽出して ⊆ RENDERERS。
- type_catalog.md: ステータス付きカタログ（✅/❌ が混在、行内にも混在）→ **✅ セグメントのみ**対象。
  各行をステータス絵文字で分割し、✅ 直後のセグメントから
  (a) 先頭の型トークン、(b) スラッシュ区切りの型列（2個以上）を抽出する。
  テーブル行は「✅ セルを持つ行の第1セル」を型とみなす。
"""
from pathlib import Path
import re

from slidegen.render import RENDERERS

ROOT = Path(__file__).resolve().parent.parent
SYSTEM_PROMPT_MD = ROOT / "docs" / "system_prompt.md"
TYPE_CATALOG_MD = ROOT / "docs" / "type_catalog.md"

# 型トークン: 英小文字/数字/アンダースコア、英字を1つ以上含む（`5e` を許し `9` 等の裸数字を弾く）
_TOKEN = r"[a-z0-9_]*[a-z][a-z0-9_]*"
_STATUS_MARKS = "✅🔜📋❌"


def _system_prompt_taught_types() -> set:
    text = SYSTEM_PROMPT_MD.read_text(encoding="utf-8")
    taught = set()
    for line in text.splitlines():
        # 型一覧の箇条書き: - `title` … 表紙。…
        m = re.match(rf"^-\s+`({_TOKEN})`", line)
        if m:
            taught.add(m.group(1))
            continue
        # 判断テーブルの右列: | 表紙・タイトル | title |
        m = re.match(rf"^\|[^|]+\|\s*({_TOKEN})\s*\|\s*$", line)
        if m:
            taught.add(m.group(1))
    return taught


def _catalog_implemented_types() -> set:
    text = TYPE_CATALOG_MD.read_text(encoding="utf-8")
    taught = set()
    for line in text.splitlines():
        if "✅" not in line:
            continue
        # 凡例行（「- ✅ 実装済み…」）は日本語のみでトークンが出ないため自然に除外される。
        if line.lstrip().startswith("|"):
            # テーブル行: ✅ セルがあれば第1セルを型とみなす（`labeled_blocks` のバッククォートを剥がす）
            cells = [c.strip().strip("`") for c in line.strip().strip("|").split("|")]
            if any(c == "✅" for c in cells) and re.fullmatch(_TOKEN, cells[0]):
                taught.add(cells[0])
            continue
        # 非テーブル行: ステータス絵文字で分割し、✅ 直後のセグメントのみ処理する
        # （「✅ swot / ✅ venn2 ／ 📋 lean_canvas」のような行内混在に対応）。
        parts = re.split(rf"([{_STATUS_MARKS}])", line)
        for mark, segment in zip(parts[1::2], parts[2::2]):
            if mark != "✅":
                continue
            # (a) ✅ 直後の先頭トークン（「✅ waterfall（…）」「✅ swot / 」）
            m = re.match(rf"^\s*({_TOKEN})\b", segment)
            if m:
                taught.add(m.group(1))
            # (b) スラッシュ区切りの型列（「(bar_chart/bar_horizontal/…)」「基底9種 ✅（a / b / c）」）
            for run in re.findall(rf"{_TOKEN}(?:\s*/\s*{_TOKEN})+", segment):
                for tok in run.split("/"):
                    tok = tok.strip()
                    if re.fullmatch(_TOKEN, tok):
                        taught.add(tok)
    return taught


def test_system_prompt_types_are_registered():
    """system_prompt.md（型一覧＋判断テーブル）が教える全型 ⊆ RENDERERS。"""
    taught = _system_prompt_taught_types()
    assert len(taught) >= 15, f"system_prompt.md から型を十分抽出できない（抽出ロジックの破綻）: {sorted(taught)}"
    missing = sorted(t for t in taught if t not in RENDERERS)
    assert not missing, f"system_prompt.md が教える未登録の型: {missing}（型を登録するか docs を修正）"


def test_type_catalog_implemented_types_are_registered():
    """type_catalog.md の ✅（実装済み）マーク付きの型 ⊆ RENDERERS。

    🔜/📋/❌ は設計上未実装なので対象外。✅ なのに未登録＝「実装済みと嘘をつく」ドリフトを検知する。
    """
    taught = _catalog_implemented_types()
    assert len(taught) >= 40, f"type_catalog.md から ✅ 型を十分抽出できない（抽出ロジックの破綻）: {sorted(taught)}"
    missing = sorted(t for t in taught if t not in RENDERERS)
    assert not missing, f"type_catalog.md で ✅（実装済み）だが未登録の型: {missing}（型を登録するか ✅ を外す）"
