#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${OKASTR8_BASE_URL:-http://127.0.0.1:41788}"
HEALTH_PATH="/api/auth/me"
START_CMD=(bun run src/managerServer.ts)
LOG_FILE="${OKASTR8_MANAGER_LOG:-/tmp/okastr8-manager-dev.log}"

get_pid() {
  ss -ltnp 2>/dev/null | sed -n 's/.*:41788 .*pid=\([0-9]\+\).*/\1/p' | head -n1
}

probe_code() {
  curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${HEALTH_PATH}" || echo 000
}

echo "[restart-manager] base url: ${BASE_URL}"

OLD_PID="$(get_pid || true)"
if [[ -n "${OLD_PID}" ]]; then
  echo "[restart-manager] stopping existing pid ${OLD_PID}"
  kill "${OLD_PID}" || true
fi

for _ in $(seq 1 30); do
  if [[ -z "$(get_pid || true)" ]]; then
    break
  fi
  sleep 1
done

echo "[restart-manager] starting manager..."
setsid -f "${START_CMD[@]}" >"${LOG_FILE}" 2>&1

NEW_PID=""
for _ in $(seq 1 30); do
  NEW_PID="$(get_pid || true)"
  if [[ -n "${NEW_PID}" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "${NEW_PID}" ]]; then
  echo "[restart-manager] failed to start manager process"
  exit 1
fi

CODE=000
for _ in $(seq 1 30); do
  CODE="$(probe_code)"
  if [[ "${CODE}" != "000" ]]; then
    break
  fi
  sleep 1
done

echo "[restart-manager] pid: ${NEW_PID}"
echo "[restart-manager] health probe code: ${CODE}"
if [[ "${CODE}" == "000" ]]; then
  echo "[restart-manager] manager process is up but HTTP probe is unreachable"
  exit 1
fi

echo "[restart-manager] restart complete"
