#!/usr/bin/env bash
# build_wheel.sh — slidegen を wheel 化し、内容ハッシュ付き「ディレクトリ」へ
# 配置して frontend/.env.wheel に URL を書き出す。
#
# なぜハッシュ付き“ディレクトリ”か（ファイル名ではなく）:
#   micropip はファイル名からパッケージ名/版を PEP440 として解析する。版に
#   ハッシュ(+xxxx / _xxxx)を混ぜると解析に失敗しうる。そこで wheel 名は正規の
#   `slidegen-0.1.0-py3-none-any.whl` のまま保ち、親ディレクトリ名にハッシュを
#   入れる。内容が変われば URL(ディレクトリ)が変わるので immutable キャッシュでも
#   確実にバスティングできる。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ building wheel from $(pwd)"
rm -rf dist
# Python パッケージ管理は uv に統一。uv build がビルドフロントエンドを提供するため
# `build` を別途インストールする必要はない（pyproject の [build-system] を使用）。
uv build --wheel

SRC_WHEEL=$(ls dist/slidegen-*-py3-none-any.whl | head -1)
WHEEL_BASE=$(basename "$SRC_WHEEL")
HASH=$(sha256sum "$SRC_WHEEL" | cut -c1-12)

DEST_ROOT="frontend/public/wheels"
DEST_DIR="$DEST_ROOT/$HASH"
rm -rf "$DEST_ROOT"
mkdir -p "$DEST_DIR"
cp "$SRC_WHEEL" "$DEST_DIR/$WHEEL_BASE"

URL="/wheels/$HASH/$WHEEL_BASE"
echo "VITE_WHEEL_URL=$URL" > frontend/.env.local
echo "✔ wrote $DEST_DIR/$WHEEL_BASE"
echo "✔ wrote frontend/.env.local (VITE_WHEEL_URL=$URL)"
