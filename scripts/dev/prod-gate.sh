#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../.. && pwd)"
cd "$ROOT_DIR"

RUN_E2E="${RUN_E2E:-1}"
RUN_SCANNERS="${RUN_SCANNERS:-1}"

log() {
  printf "\n[%s] %s\n" "$(date +%H:%M:%S)" "$1"
}

run_step() {
  local label="$1"
  shift
  log "$label"
  "$@"
}

run_optional_scanner() {
  local name="$1"
  shift
  if "$@"; then
    return 0
  fi
  log "WARN: $name reported issues"
  return 1
}

SCANNER_FAILURE=0

run_step "Typecheck" bun run typecheck
run_step "Lint" bun run lint
run_step "Unit + Smoke" bun run test
run_step "Integration" bun run test:integration

if [[ "$RUN_E2E" == "1" ]]; then
  run_step "Playwright E2E" bun run test:e2e
else
  log "Skipping E2E (RUN_E2E=$RUN_E2E)"
fi

if [[ "$RUN_SCANNERS" == "1" ]]; then
  log "Security scanners (optional)"

  if command -v bun >/dev/null 2>&1; then
    if bun pm --help 2>/dev/null | grep -q "audit"; then
      run_optional_scanner "bun audit" bun pm audit || SCANNER_FAILURE=1
    else
      log "Skip: bun pm audit unavailable in this Bun version"
    fi
  fi

  if command -v npm >/dev/null 2>&1; then
    if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
      run_optional_scanner "npm audit (prod deps)" npm audit --omit=dev || SCANNER_FAILURE=1
    else
      log "Skip: npm audit requires package-lock.json or npm-shrinkwrap.json"
    fi
  else
    log "Skip: npm not installed"
  fi

  if command -v trivy >/dev/null 2>&1; then
    run_optional_scanner "trivy fs scan" trivy fs --exit-code 1 --severity HIGH,CRITICAL . || SCANNER_FAILURE=1
  else
    log "Skip: trivy not installed"
  fi
else
  log "Skipping scanners (RUN_SCANNERS=$RUN_SCANNERS)"
fi

if [[ "$SCANNER_FAILURE" -ne 0 ]]; then
  log "Production gate failed due to scanner findings."
  exit 2
fi

log "Production gate passed."
