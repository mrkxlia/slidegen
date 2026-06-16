"""
test_cli.py — 統合CLI（python -m slidegen / slidegen コマンド）と後方互換の配線テスト。

ここでは「CLIの配線が正しいか（終了コード0・成果物生成）」だけを検証する。
sync の往復（--apply で文言が記法に戻ること）は tests/test_sync.py が担保済み。

注意：相対パス examples/... が pytest 実行 cwd に依存して壊れないよう、
subprocess は必ず sys.executable + cwd=REPO_ROOT で起動する。
"""
import pathlib
import shutil
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


def _run(args, cwd=REPO_ROOT):
    return subprocess.run(
        args, cwd=str(cwd), capture_output=True, text=True,
    )


def test_unified_build_and_sync(tmp_path):
    # build：統合CLI で pptx を生成
    out = tmp_path / "out.pptx"
    r = _run([sys.executable, "-m", "slidegen", "build",
              "examples/sample.slide", "-o", str(out)])
    assert r.returncode == 0, r.stderr
    assert out.exists() and out.stat().st_size > 0

    # sync（dry-run）：build が出力した pptx を入力に取る（順序結合を1テスト内で明示）
    r2 = _run([sys.executable, "-m", "slidegen", "sync",
               "examples/sample.slide", str(out)])
    assert r2.returncode == 0, r2.stderr


def test_backward_compat_cli_module(tmp_path):
    out = tmp_path / "compat.pptx"
    r = _run([sys.executable, "-m", "slidegen.cli",
              "examples/sample.slide", "-o", str(out)])
    assert r.returncode == 0, r.stderr
    assert out.exists() and out.stat().st_size > 0


def test_backward_compat_sync_module(tmp_path):
    # まず生成してから sync モジュールを直接叩く（後方互換）
    out = tmp_path / "compat2.pptx"
    _run([sys.executable, "-m", "slidegen.cli",
          "examples/sample.slide", "-o", str(out)])
    r = _run([sys.executable, "-m", "slidegen.sync",
              "examples/sample.slide", str(out)])
    assert r.returncode == 0, r.stderr


def test_console_script_entrypoint(tmp_path):
    """console_scripts の slidegen コマンドが実際にインストールされ動くこと。
    未インストール環境（PATH に無い）では skip。"""
    exe = shutil.which("slidegen")
    if exe is None:
        import pytest
        pytest.skip("slidegen console script not installed on PATH")
    out = tmp_path / "viaentry.pptx"
    r = _run([exe, "build", "examples/sample.slide", "-o", str(out)])
    assert r.returncode == 0, r.stderr
    assert out.exists() and out.stat().st_size > 0
