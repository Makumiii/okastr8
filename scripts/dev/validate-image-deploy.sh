#!/usr/bin/env bash
set -euo pipefail

CLI_CMD=(bun run src/main.ts)
APP_PREFIX="phase7-image-validate"
PUBLIC_APP="${APP_PREFIX}-public"
PUBLIC_PORT="${PUBLIC_PORT:-18110}"
FAILURE_APP="${APP_PREFIX}-failure"
REGISTRY_IDS=()
PRIVATE_EXPECTED=3
PRIVATE_RAN=0
PRIVATE_SKIPPED=()

cleanup() {
  set +e
  "${CLI_CMD[@]}" app delete "$PUBLIC_APP" >/dev/null 2>&1 || true
  "${CLI_CMD[@]}" app delete "$FAILURE_APP" >/dev/null 2>&1 || true
  if [[ -n "${PRIVATE_APP:-}" ]]; then
    "${CLI_CMD[@]}" app delete "$PRIVATE_APP" >/dev/null 2>&1 || true
  fi
  for id in "${REGISTRY_IDS[@]}"; do
    "${CLI_CMD[@]}" registry remove "$id" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

echo "[1/5] Creating public image app"
"${CLI_CMD[@]}" app create-image "$PUBLIC_APP" "nginx:1.27-alpine" \
  --port "$PUBLIC_PORT" \
  --container-port 80 \
  --pull-policy always \
  --release-retention 3 \
  --registry-provider dockerhub

echo "[2/5] Deploying public image app"
"${CLI_CMD[@]}" deploy trigger "$PUBLIC_APP"

echo "[3/5] Verifying public app responds"
sleep 2
curl -fsS "http://127.0.0.1:${PUBLIC_PORT}" >/dev/null

echo "[4/5] Rolling back by explicit image target"
"${CLI_CMD[@]}" deploy rollback "$PUBLIC_APP" --target "nginx:1.27-alpine" >/dev/null

echo "[5/5] Verifying release retention cap"
COUNT=$(bun --eval "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.env.HOME+'/.okastr8/apps/${PUBLIC_APP}/app.json','utf8')); console.log(p.imageReleases.length);")
if [[ "$COUNT" -gt 3 ]]; then
  echo "FAIL: expected <=3 image releases, found ${COUNT}" >&2
  exit 1
fi
echo "PASS: public flow validated with release count ${COUNT}"

echo "[6/6] Failure injection: non-existent image must fail deployment"
"${CLI_CMD[@]}" app create-image "$FAILURE_APP" "does-not-exist.invalid/okastr8/fail:missing" \
  --port "${FAILURE_PORT:-18114}" \
  --container-port 80 \
  --pull-policy always \
  --release-retention 2 \
  --registry-provider generic >/dev/null
if "${CLI_CMD[@]}" deploy trigger "$FAILURE_APP" >/tmp/okastr8-phase7-failure.log 2>&1; then
  echo "FAIL: expected deployment failure for non-existent image" >&2
  cat /tmp/okastr8-phase7-failure.log >&2 || true
  exit 1
fi
rm -f /tmp/okastr8-phase7-failure.log
echo "PASS: failure path returns non-zero as expected"

echo "Optional private registry validations"
if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" && -n "${GHCR_IMAGE:-}" ]]; then
  PRIVATE_RAN=$((PRIVATE_RAN + 1))
  PRIVATE_APP="${APP_PREFIX}-ghcr"
  PRIVATE_PORT="${GHCR_PORT:-18111}"
  echo " - Running GHCR private image validation"
  "${CLI_CMD[@]}" registry add phase7-ghcr ghcr ghcr.io "$GHCR_USER" "$GHCR_TOKEN" >/dev/null
  REGISTRY_IDS+=("phase7-ghcr")
  "${CLI_CMD[@]}" app create-image "$PRIVATE_APP" "$GHCR_IMAGE" \
    --port "$PRIVATE_PORT" \
    --container-port "${GHCR_CONTAINER_PORT:-80}" \
    --registry-provider ghcr \
    --registry-credential phase7-ghcr \
    --release-retention 3 >/dev/null
  "${CLI_CMD[@]}" deploy trigger "$PRIVATE_APP"
  sleep 2
  curl -fsS "http://127.0.0.1:${PRIVATE_PORT}" >/dev/null
  echo "PASS: GHCR private validation"
else
  PRIVATE_SKIPPED+=("GHCR (set GHCR_USER, GHCR_TOKEN, GHCR_IMAGE)")
fi

if [[ -n "${DOCKERHUB_USER:-}" && -n "${DOCKERHUB_TOKEN:-}" && -n "${DOCKERHUB_IMAGE:-}" ]]; then
  PRIVATE_RAN=$((PRIVATE_RAN + 1))
  PRIVATE_APP="${APP_PREFIX}-dockerhub"
  PRIVATE_PORT="${DOCKERHUB_PORT:-18112}"
  echo " - Running DockerHub private image validation"
  "${CLI_CMD[@]}" registry add phase7-dockerhub dockerhub docker.io "$DOCKERHUB_USER" "$DOCKERHUB_TOKEN" >/dev/null
  REGISTRY_IDS+=("phase7-dockerhub")
  "${CLI_CMD[@]}" app create-image "$PRIVATE_APP" "$DOCKERHUB_IMAGE" \
    --port "$PRIVATE_PORT" \
    --container-port "${DOCKERHUB_CONTAINER_PORT:-80}" \
    --registry-provider dockerhub \
    --registry-credential phase7-dockerhub \
    --release-retention 3 >/dev/null
  "${CLI_CMD[@]}" deploy trigger "$PRIVATE_APP"
  sleep 2
  curl -fsS "http://127.0.0.1:${PRIVATE_PORT}" >/dev/null
  echo "PASS: DockerHub private validation"
else
  PRIVATE_SKIPPED+=("DockerHub (set DOCKERHUB_USER, DOCKERHUB_TOKEN, DOCKERHUB_IMAGE)")
fi

if [[ -n "${ECR_SERVER:-}" && -n "${ECR_USER:-}" && -n "${ECR_TOKEN:-}" && -n "${ECR_IMAGE:-}" ]]; then
  PRIVATE_RAN=$((PRIVATE_RAN + 1))
  PRIVATE_APP="${APP_PREFIX}-ecr"
  PRIVATE_PORT="${ECR_PORT:-18113}"
  echo " - Running ECR private image validation"
  "${CLI_CMD[@]}" registry add phase7-ecr ecr "$ECR_SERVER" "$ECR_USER" "$ECR_TOKEN" >/dev/null
  REGISTRY_IDS+=("phase7-ecr")
  "${CLI_CMD[@]}" app create-image "$PRIVATE_APP" "$ECR_IMAGE" \
    --port "$PRIVATE_PORT" \
    --container-port "${ECR_CONTAINER_PORT:-80}" \
    --registry-provider ecr \
    --registry-server "$ECR_SERVER" \
    --registry-credential phase7-ecr \
    --release-retention 3 >/dev/null
  "${CLI_CMD[@]}" deploy trigger "$PRIVATE_APP"
  sleep 2
  curl -fsS "http://127.0.0.1:${PRIVATE_PORT}" >/dev/null
  echo "PASS: ECR private validation"
else
  PRIVATE_SKIPPED+=("ECR (set ECR_SERVER, ECR_USER, ECR_TOKEN, ECR_IMAGE)")
fi

echo "Validation complete."
echo "Private matrix summary: ran ${PRIVATE_RAN}/${PRIVATE_EXPECTED}"
if [[ "${#PRIVATE_SKIPPED[@]}" -gt 0 ]]; then
  printf 'Skipped private checks:\n'
  for item in "${PRIVATE_SKIPPED[@]}"; do
    printf ' - %s\n' "$item"
  done
fi
