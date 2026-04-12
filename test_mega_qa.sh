#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${OTIMIZ_BATTERY_PROFILE:-ci}"
OUTPUT_DIR="${OTIMIZ_BATTERY_OUTPUT_DIR:-$ROOT_DIR/artifacts/optimization-battery/$PROFILE}"

exec node "$ROOT_DIR/scripts/optimization-battery.mjs" --profile "$PROFILE" --output-dir "$OUTPUT_DIR" "$@"