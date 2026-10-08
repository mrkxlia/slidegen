"""test_copilot_skill.py — Copilot in PowerPoint 向けスキルの CI ガード。

copilot/slidegen-copilot/SKILL.md は Copilot が自身の図形編集でスライドを組むための
指示だけで完結する（外部コマンドを実行しない）。次の3点を純Python・ネットワーク不要で固定する。

- frontmatter は Agent Skills オープン仕様のフィールドだけで、name とフォルダ名が一致する
  （Copilot は一致しないフォルダを読み飛ばす）。
- パターン識別子（バッククォート）⊆ RENDERERS。slidegen の型名とずれないようにする。
- uv / slidegen.sh 等の実行手順を持ち込まない（Copilot では実行できないため）。
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = ROOT / "copilot" / "slidegen-copilot"
SKILL_MD = SKILL_DIR / "SKILL.md"

SKILL_FRONTMATTER_ALLOWED_KEYS = {
    "name", "description", "license", "compatibility", "metadata", "allowed-tools",
}


def _frontmatter() -> tuple[str, dict]:
    text = SKILL_MD.read_text(encoding="utf-8")
    m = re.match(r'^---\n(.*?)\n---\n', text, re.DOTALL)
    assert m, "SKILL.md の frontmatter (---...---) が見つからない"
    fm = {}
    for line in m.group(1).splitlines():
        km = re.match(r'^([a-zA-Z-]+):\s*(.*)$', line)
        if km:
            fm[km.group(1)] = km.group(2).strip()
    return text[m.end():], fm


def test_frontmatter_uses_only_open_spec_fields_and_matches_folder():
    _, fm = _frontmatter()
    extra = set(fm) - SKILL_FRONTMATTER_ALLOWED_KEYS
    assert not extra, f"frontmatter に Agent Skills 仕様外のフィールド: {extra}"
    assert fm.get("name") == SKILL_DIR.name, "name とフォルダ名が一致しない（Copilot が読み飛ばす）"
    assert "description" in fm


def test_pattern_ids_are_registered_types():
    from slidegen.render import RENDERERS

    body, _ = _frontmatter()
    # コードブロック内（構成提案の例）も含め、バッククォートの識別子を拾う。
    referenced = set(re.findall(r'`([a-z0-9_]+)`', body))
    referenced |= set(re.findall(r'\[([a-z0-9_]+)\]', body))
    assert referenced, "パターン識別子を抽出できない（抽出ロジックの破綻）"
    missing = sorted(t for t in referenced if t not in RENDERERS)
    assert not missing, f"Copilot スキルが案内する未登録の型: {missing}"


def test_skill_is_instruction_only():
    body, _ = _frontmatter()
    for word in ("uv run", "uvx", "slidegen.sh", "slidegen build", "references/"):
        assert word not in body, f"Copilot スキルに実行手順・外部参照 `{word}` が含まれる"
    extra_files = [p for p in SKILL_DIR.rglob("*") if p.is_file() and p != SKILL_MD]
    assert not extra_files, f"Copilot スキルは SKILL.md 単体で完結させる: {extra_files}"
