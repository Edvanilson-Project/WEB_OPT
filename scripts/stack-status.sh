#!/usr/bin/env bash

set -uo pipefail

status=0

get_pid_for_port() {
  local port="$1"
  local pid=""

  pid="$(ss -ltnp 2>/dev/null | awk -v port=":${port}" '
    index($4, port) && match($0, /pid=([0-9]+)/, match_data) {
      print match_data[1]
      exit
    }
  ')"

  if [[ -z "$pid" ]]; then
    pid="$(fuser "${port}/tcp" 2>/dev/null | awk 'NF { print $1; exit }')"
  fi

  printf '%s' "$pid"
}

print_service_status() {
  local name="$1"
  local url="$2"
  local port="$3"
  local pid=""
  local ppid="-"
  local tty="-"
  local cmd="-"

  pid="$(get_pid_for_port "$port")"

  if [[ -n "$pid" ]]; then
    ppid="$(ps -o ppid= -p "$pid" | xargs)"
    tty="$(ps -o tty= -p "$pid" | xargs)"
    cmd="$(ps -o cmd= -p "$pid" | xargs)"
  else
    pid="-"
  fi

  if curl -fsS --max-time 5 "$url" >/dev/null; then
    printf 'OK   %-10s url=%s port=%s pid=%s ppid=%s tty=%s\n' "$name" "$url" "$port" "$pid" "$ppid" "$tty"
  else
    printf 'FAIL %-10s url=%s port=%s pid=%s ppid=%s tty=%s\n' "$name" "$url" "$port" "$pid" "$ppid" "$tty"
    status=1
  fi

  printf '     cmd=%s\n' "$cmd"
}

print_service_status "frontend" "http://127.0.0.1:3000/otimiz/optimization" "3000"
print_service_status "backend" "http://127.0.0.1:3001/api/docs" "3001"
print_service_status "optimizer" "http://127.0.0.1:8000/health" "8000"

exit "$status"