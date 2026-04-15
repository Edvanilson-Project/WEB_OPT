#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

extract_port_from_url() {
  local url="$1"

  if [[ "$url" =~ :([0-9]+)(/|$) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
}

resolve_backend_port() {
  if [[ -n "${BACKEND_PORT:-}" ]]; then
    printf '%s\n' "${BACKEND_PORT}"
    return 0
  fi

  local env_file="$ROOT_DIR/backend/.env"
  if [[ -f "$env_file" ]]; then
    local env_port
    env_port="$(awk -F= '/^PORT=/{print $2; exit}' "$env_file" | tr -d '[:space:]\r')"
    if [[ -n "$env_port" ]]; then
      printf '%s\n' "$env_port"
      return 0
    fi
  fi

  printf '3001\n'
}

resolve_optimizer_port() {
  if [[ -n "${OPTIMIZER_PORT:-}" ]]; then
    printf '%s\n' "${OPTIMIZER_PORT}"
    return 0
  fi

  local backend_env_file="$ROOT_DIR/backend/.env"
  if [[ -f "$backend_env_file" ]]; then
    local optimizer_url
    local optimizer_port
    optimizer_url="$(awk -F= '/^OPTIMIZER_URL=/{print $2; exit}' "$backend_env_file" | tr -d '[:space:]\r')"
    optimizer_port="$(extract_port_from_url "$optimizer_url")"
    if [[ -n "$optimizer_port" ]]; then
      printf '%s\n' "$optimizer_port"
      return 0
    fi
  fi

  local optimizer_env_file="$ROOT_DIR/optimizer/.env"
  if [[ -f "$optimizer_env_file" ]]; then
    local env_port
    env_port="$(awk -F= '/^PORT=/{print $2; exit}' "$optimizer_env_file" | tr -d '[:space:]\r')"
    if [[ -n "$env_port" ]]; then
      printf '%s\n' "$env_port"
      return 0
    fi
  fi

  printf '8000\n'
}

OPTIMIZER_PORT="$(resolve_optimizer_port)"
BACKEND_PORT="$(resolve_backend_port)"

if ss -ltn 2>/dev/null | awk -v port=":${OPTIMIZER_PORT}" '$4 ~ (port "$") { found = 1 } END { exit(found ? 0 : 1) }'; then
  echo "optimizer already listening on :${OPTIMIZER_PORT}"
  exit 0
fi

cd "$ROOT_DIR/optimizer"
exec env PORT="$OPTIMIZER_PORT" BACKEND_URL="http://localhost:${BACKEND_PORT}/api/v1" "$ROOT_DIR/.venv/bin/python" main.py