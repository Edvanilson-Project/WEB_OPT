#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

resolve_npm() {
  if [[ -n "${NPM_BIN:-}" && -x "${NPM_BIN}" ]]; then
    printf '%s\n' "${NPM_BIN}"
    return 0
  fi

  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  if [[ -n "${NVM_BIN:-}" && -x "${NVM_BIN}/npm" ]]; then
    printf '%s\n' "${NVM_BIN}/npm"
    return 0
  fi

  shopt -s nullglob
  local npm_candidates=("${HOME}"/.nvm/versions/node/*/bin/npm)
  shopt -u nullglob
  if ((${#npm_candidates[@]} > 0)); then
    local last_index=$((${#npm_candidates[@]} - 1))
    printf '%s\n' "${npm_candidates[$last_index]}"
    return 0
  fi

  echo "npm executable not found. Set NPM_BIN or ensure npm is installed." >&2
  return 1
}

BACKEND_PORT="$(resolve_backend_port)"

if ss -ltn 2>/dev/null | awk -v port=":${BACKEND_PORT}$" '$4 ~ port { found = 1 } END { exit(found ? 0 : 1) }'; then
  echo "backend already listening on :${BACKEND_PORT}"
  exit 0
fi

cd "$ROOT_DIR/backend"
NPM_CMD="$(resolve_npm)"
exec "$NPM_CMD" run start:dev