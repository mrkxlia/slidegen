"""
test_dsl_validator.py — DSL 静的バリデーション（軽量版）の単体テスト。

validate() は RENDERERS/DSL 構造から機械的に判る問題だけを見る:
  - 未知の型 → blocking（CLI では exit(1)）
  - 誤ったトップレベルキー / 実質空スライド → warning のみ
CLI 側の配線（exit code）は test_cli.py 相当だが、未知型で exit 1 になることもここで確認する。
"""
import pathlib
import subprocess
import sys

import slidegen
from slidegen.parser import parse
from slidegen.render import RENDERERS
from slidegen.dsl_validator import validate

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


def test_unknown_type_is_blocking():
    slides = parse('slide unknown_xyz\n  headline "テスト"\n')
    r = validate(slides, RENDERERS)
    assert not r.ok
    assert any("未対応の型" in m for m in r.blocking_warnings)


def test_valid_type_has_no_blocking():
    slides = parse('slide bullets\n  headline "見出し"\n  col "項目"\n    "本文"\n')
    r = validate(slides, RENDERERS)
    assert r.ok
    assert r.blocking_warnings == []


def test_invalid_top_level_key_warns():
    slides = parse('slide bullets\n  headline "見出し"\n  bullet "これは誤記法"\n')
    r = validate(slides, RENDERERS)
    # 誤記法は warning（描画自体は止めない）
    assert r.ok
    assert any("bullet" in m for m in r.warnings)


def test_cli_exits_nonzero_on_unknown_type(tmp_path):
    bad = tmp_path / "bad.slide"
    bad.write_text('slide bad_type_xyz\n  headline "test"\n', encoding="utf-8")
    out = tmp_path / "bad.pptx"
    r = subprocess.run(
        [sys.executable, "-m", "slidegen", "build", str(bad), "-o", str(out)],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
    )
    assert r.returncode == 1, r.stderr
    assert "未対応の型" in r.stderr
    assert not out.exists()
