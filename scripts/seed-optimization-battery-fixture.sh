#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

resolve_env_value() {
  local key="$1"
  local default_value="$2"
  local env_file="$ROOT_DIR/backend/.env"

  if [[ -n "${!key:-}" ]]; then
    printf '%s\n' "${!key}"
    return 0
  fi

  if [[ -f "$env_file" ]]; then
    local env_value
    env_value="$(awk -F= -v search_key="$key" '$1 == search_key { print $2; exit }' "$env_file" | tr -d '[:space:]\r')"
    if [[ -n "$env_value" ]]; then
      printf '%s\n' "$env_value"
      return 0
    fi
  fi

  printf '%s\n' "$default_value"
}

DB_HOST="$(resolve_env_value DB_HOST localhost)"
DB_PORT="$(resolve_env_value DB_PORT 5432)"
DB_USERNAME="$(resolve_env_value DB_USERNAME postgres)"
DB_PASSWORD="$(resolve_env_value DB_PASSWORD postgres)"
DB_DATABASE="$(resolve_env_value DB_DATABASE otmiz_new)"

if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -Atqc "select to_regclass('public.companies')" | grep -q companies; then
  echo "Database schema not initialized. Start the backend once with DB_SYNCHRONIZE=true before seeding the battery fixture." >&2
  exit 1
fi

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -f "$ROOT_DIR/backend/scripts/seed_ci_battery_fixture.sql"

if [[ "${SEED_MULTILINE:-1}" != "0" ]]; then
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -f "$ROOT_DIR/backend/scripts/seed_multiline_from_line16.sql"
fi