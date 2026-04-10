#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ss -ltn 2>/dev/null | awk '$4 ~ /:8000$/ { found = 1 } END { exit(found ? 0 : 1) }'; then
  echo "optimizer already listening on :8000"
  exit 0
fi

cd "$ROOT_DIR/optimizer"
exec "$ROOT_DIR/.venv/bin/python" main.py