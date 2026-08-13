#!/usr/bin/env bash
# slidegen CLI ラッパー。リポジトリ内では `uv run`、リポジトリ外では
# `uvx --from git+https://github.com/mrkxlia/slidegen` で実行する自己完結ラッパー。
#
# 使い方:
#   slidegen.sh build deck.slide -o deck.pptx [--template company.potx]
#   slidegen.sh sync original.slide edited.pptx [--apply] [-o updated.slide]
#   slidegen.sh inspect deck.pptx [--compact]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
REPO_URL="git+https://github.com/mrkxlia/slidegen"

if ! command -v uv >/dev/null 2>&1; then
  echo "error: uv が見つかりません。https://docs.astral.sh/uv/getting-started/installation/ から導入してください。" >&2
  exit 1
fi

in_repo() {
  [ -f "$REPO_ROOT/pyproject.toml" ] && grep -q '^name = "slidegen"' "$REPO_ROOT/pyproject.toml"
}

# inspect は console script 未登録のため python -m 経由に変換する。
if [ "${1:-}" = "inspect" ]; then
  shift
  if in_repo; then
    exec uv run --project "$REPO_ROOT" python -m slidegen.inspect_pptx --compact "$@"
  else
    exec uv run --with "$REPO_URL" python -m slidegen.inspect_pptx --compact "$@"
  fi
fi

if in_repo; then
  exec uv run --project "$REPO_ROOT" slidegen "$@"
else
  exec uvx --from "$REPO_URL" slidegen "$@"
fi
