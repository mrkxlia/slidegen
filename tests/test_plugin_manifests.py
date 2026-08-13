"""test_plugin_manifests.py — Agent Skill/Plugin マニフェスト群の整合性を保証する CI ガード。

S2 で追加した plugin.json（Agent Plugins 1.0）・.claude-plugin/plugin.json（Claude Code）・
.claude-plugin/marketplace.json・skills/slidegen/SKILL.md の4点が、互いに、また pyproject.toml と
食い違わないことを機械的に固定する。skills-ref / claude plugin validate はネットワーク・外部CLIに
依存するため CI 外（ローカル `make validate-skill`）で実施し、ここでは純Python・ネットワーク不要の
チェックのみを行う。
"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent
PYPROJECT = ROOT / "pyproject.toml"
ROOT_PLUGIN_JSON = ROOT / "plugin.json"
CLAUDE_PLUGIN_JSON = ROOT / ".claude-plugin" / "plugin.json"
MARKETPLACE_JSON = ROOT / ".claude-plugin" / "marketplace.json"
SKILL_MD = ROOT / "skills" / "slidegen" / "SKILL.md"
DESIGN_GUIDELINES_MD = ROOT / "skills" / "slidegen" / "references" / "design-guidelines.md"
TYPE_SELECTION_GUIDE_MD = ROOT / "skills" / "slidegen" / "references" / "type-selection-guide.md"

# Agent Plugins 1.0 の plugin.json スキーマ（additionalProperties: false）が許可するキー。
# https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
AGENT_PLUGINS_ALLOWED_KEYS = {
    "$schema", "name", "version", "description", "author",
    "homepage", "repository", "license", "keywords", "extensions",
}

# Agent Skills オープン仕様の SKILL.md frontmatter が許可する6フィールド。
# https://agentskills.io/specification
SKILL_FRONTMATTER_ALLOWED_KEYS = {
    "name", "description", "license", "compatibility", "metadata", "allowed-tools",
}


def _pyproject_version() -> str:
    # requires-python >=3.10 では tomllib が無いため正規表現で抽出する。
    text = PYPROJECT.read_text(encoding="utf-8")
    m = re.search(r'(?m)^version\s*=\s*"([^"]+)"', text)
    assert m, "pyproject.toml から version を抽出できない"
    return m.group(1)


def _skill_frontmatter() -> dict:
    text = SKILL_MD.read_text(encoding="utf-8")
    m = re.match(r'^---\n(.*?)\n---\n', text, re.DOTALL)
    assert m, "SKILL.md の frontmatter (---...---) が見つからない"
    fm = {}
    for line in m.group(1).splitlines():
        km = re.match(r'^([a-zA-Z-]+):', line)
        if km:
            fm[km.group(1)] = True
    return fm


def test_root_plugin_json_is_valid_and_synced():
    data = json.loads(ROOT_PLUGIN_JSON.read_text(encoding="utf-8"))
    assert data.get("$schema") == "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
    assert data.get("name") == "slidegen"
    extra = set(data) - AGENT_PLUGINS_ALLOWED_KEYS
    assert not extra, f"plugin.json に Agent Plugins 1.0 未定義のキー: {extra}"
    assert data.get("version") == _pyproject_version(), (
        "plugin.json の version が pyproject.toml と食い違っている（同期漏れ）"
    )


def test_claude_plugin_json_is_valid_and_synced():
    data = json.loads(CLAUDE_PLUGIN_JSON.read_text(encoding="utf-8"))
    assert data.get("name") == "slidegen"
    assert data.get("version") == _pyproject_version(), (
        ".claude-plugin/plugin.json の version が pyproject.toml と食い違っている（同期漏れ）"
    )


def test_marketplace_json_is_valid():
    data = json.loads(MARKETPLACE_JSON.read_text(encoding="utf-8"))
    assert data.get("name") == "slidegen"
    assert "owner" in data
    plugins = data.get("plugins")
    assert plugins and any(p.get("name") == "slidegen" for p in plugins), (
        "marketplace.json の plugins に slidegen が登録されていない"
    )


def test_skill_md_frontmatter_uses_only_open_spec_fields():
    fm = _skill_frontmatter()
    extra = set(fm) - SKILL_FRONTMATTER_ALLOWED_KEYS
    assert not extra, f"SKILL.md frontmatter に Agent Skills 仕様外のフィールド: {extra}"
    assert "name" in fm and "description" in fm, "SKILL.md frontmatter に必須の name/description が無い"


def test_skill_md_does_not_enumerate_type_names():
    """型カタログの正本は dsl-reference.md のみ（test_dsl_reference.py がガード）。
    SKILL.md に `slide <型>` の実例を書くと、ここは未ガードのままドリフトしうるため禁止する。
    """
    text = SKILL_MD.read_text(encoding="utf-8")
    assert not re.search(r'(?m)^\s*slide\s+[a-z]', text), (
        "SKILL.md に `slide <型>` の型実例が書かれている（型カタログは dsl-reference.md に一本化する）"
    )


def test_slidegen_wrapper_script_is_executable():
    script = ROOT / "skills" / "slidegen" / "scripts" / "slidegen.sh"
    assert script.exists(), "skills/slidegen/scripts/slidegen.sh が無い"
    assert script.stat().st_mode & 0o111, "skills/slidegen/scripts/slidegen.sh に実行ビットが無い"


def test_skill_references_design_guidance_docs():
    """S3完了条件: design-guidelines.md / type-selection-guide.md がスキルから参照されていること。"""
    assert DESIGN_GUIDELINES_MD.exists(), "skills/slidegen/references/design-guidelines.md が無い"
    assert TYPE_SELECTION_GUIDE_MD.exists(), "skills/slidegen/references/type-selection-guide.md が無い"

    text = SKILL_MD.read_text(encoding="utf-8")
    assert "references/design-guidelines.md" in text, (
        "SKILL.md が references/design-guidelines.md を参照していない"
    )
    assert "references/type-selection-guide.md" in text, (
        "SKILL.md が references/type-selection-guide.md を参照していない"
    )


def _type_selection_guide_registered_type_refs() -> set:
    """type-selection-guide.md からバッククォート型名を抽出する。
    📋（未実装候補）を含む行は対象外とする（実装済みと確定していないため）。
    """
    text = TYPE_SELECTION_GUIDE_MD.read_text(encoding="utf-8")
    referenced = set()
    for line in text.splitlines():
        if "📋" in line:
            continue
        referenced.update(re.findall(r'`([a-z0-9_]+)`', line))
    return referenced


def test_type_selection_guide_types_are_registered():
    """type-selection-guide.md が案内する実装済み型（📋以外）⊆ RENDERERS。
    dsl-reference.md と同じ「型名は必ず実在するものだけを書く」というドリフト防止思想を軽量に流用する。
    """
    from slidegen.render import RENDERERS

    referenced = _type_selection_guide_registered_type_refs()
    assert referenced, "type-selection-guide.md からバッククォート型名を抽出できない（抽出ロジックの破綻）"
    missing = sorted(t for t in referenced if t not in RENDERERS)
    assert not missing, f"type-selection-guide.md が案内する未登録の型: {missing}"
