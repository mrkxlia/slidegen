# 0002. Python のパッケージ管理・ビルドを uv に統一する

- ステータス: 採用 (Accepted)
- 日付: 2026-06-27
- 関連: `pyproject.toml`, `tools/build_wheel.sh`, `.github/workflows/ci.yml`, `uv.lock`

## コンテキスト

slidegen のビルド（wheel 生成）とテストは当初 `pip` / `python -m build` で行っていた。
その都合で `pyproject.toml` の**実行時 `dependencies` に `build>=1.5.0` が紛れ込んでいた**
（ビルドフロントエンドであり、ライブラリの実行時依存ではない＝wheel 配布物に不要な依存が付く）。
開発者は uv を利用しており、ツールチェーンを uv に統一したい。

## 決定

Python のパッケージ管理・実行・ビルドを **uv に統一**する。

- **wheel ビルド**: `tools/build_wheel.sh` は `uv build --wheel`（`[build-system]` の setuptools を使用）。
- **テスト/実行**: `uv run --extra dev pytest`（依存解決は `uv sync --extra dev`、ロックは `uv.lock`）。
- **CI**: GitHub Actions は `astral-sh/setup-uv`（`actions/setup-python` + `pip install` を置換）。
- **`pyproject.toml`**: 実行時 `dependencies` は `python-pptx` のみ。`build` は除去（`uv build` が提供）。
  dev 依存（pytest/pillow）は `[project.optional-dependencies].dev`。
- `pip` / `python -m build` の直接利用はしない。

## 結果

- wheel 配布物から不要な `build` 依存が消え、パッケージとして正しくなった。
- `uv run` が slidegen を正式インストールするため、以前 import 起因で skip されていたテストも実行され
  **106 passed**（旧: 105 passed + 1 skipped）。
- ローカルと CI のツールチェーンが揃い、`uv.lock` で再現性が上がる。
- 注意: 配信 wheel は正規名 `slidegen-0.1.0-py3-none-any.whl` を維持（micropip 互換、`build_wheel.sh` が担保）。
