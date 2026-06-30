"""test_version_sync.py — wheel 版が pyproject.toml と frontend で一致、を保証する CI ガード。

version bump 時、`pyproject.toml` の version を上げても `renderClient.ts` の既定 wheel URL
（VITE_WHEEL_URL 欠落時のフォールバック）の版表記を直し忘れると、本番/ローカルで
間違った版名を取りに行って 404 になる。ここを機械的に固定して更新漏れを検知する。

cross-file ドリフトガードの idiom は test_chart_dsl.py を踏襲（regex でファイルを読む）。
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
PYPROJECT = ROOT / "pyproject.toml"
RENDER_CLIENT_TS = ROOT / "frontend" / "src" / "render" / "renderClient.ts"


def _pyproject_version() -> str:
    text = PYPROJECT.read_text(encoding="utf-8")
    m = re.search(r'(?m)^version\s*=\s*"([^"]+)"', text)
    assert m, "pyproject.toml から version を抽出できない"
    return m.group(1)


def _render_client_wheel_version() -> str:
    text = RENDER_CLIENT_TS.read_text(encoding="utf-8")
    m = re.search(r"slidegen-([0-9][^-]*)-py3-none-any\.whl", text)
    assert m, "renderClient.ts に既定の wheel URL（slidegen-<版>-py3-none-any.whl）が見つからない"
    return m.group(1)


def test_render_client_wheel_version_matches_pyproject():
    """renderClient.ts の既定 wheel 版 == pyproject.toml の version（version bump 漏れを検知）。"""
    pkg = _pyproject_version()
    front = _render_client_wheel_version()
    assert pkg == front, (
        f"版の不一致: pyproject.toml={pkg} / renderClient.ts の既定 wheel URL={front}。"
        " version bump 時は renderClient.ts の既定 VITE_WHEEL_URL も更新すること。"
    )
