# Phase 6 Drill Run - February 20, 2026

## Scope
Reliability, security, and recovery drills on live dev manager at `http://127.0.0.1:41788`.

## Security Drills

1. Webhook replay behavior (valid signature, real app metadata, branch mismatch)
- Setup: temporary app `phase6-webhook-replay` tracked `Makumiii/okastr8-test-app`, webhook branch `v1-simple`.
- Action: send identical signed push webhook twice for `refs/heads/v2-with-db`.
- First response: `200` + `{"ignored":true,"message":"Branch mismatch: refs/heads/v2-with-db != v1-simple"}`.
- Second response: same as first.
- Result: Pass (deterministic ignore, no unintended deploy trigger).

2. Token tamper/format edge cases on protected endpoint (`/api/system/status`)
- `Authorization: Bearer not-a-real-token` -> `401` + `Invalid token format`.
- `Authorization: Bearer ` (empty) -> `401` + `Authentication required`.
- `Authorization: Bearer a.b.c` -> `401` + `Invalid token format`.
- Result: Pass.

3. Alert-test endpoint auth gate (`POST /api/system/alerts/test`)
- With valid session token -> `200` + `Resource alert test triggered`.
- Without auth -> `401` + `Authentication required`.
- Result: Pass.

## Recovery Drills

4. Repeated manager restart consistency (`scripts/dev/restart-manager.sh`)
- Cycle 1: `duration_ms=1265`, post probe `401`.
- Cycle 2: `duration_ms=1260`, post probe `401`.
- Cycle 3: `duration_ms=1249`, post probe `401`.
- Result: Pass (stable restart and recovery timing).

## Findings
- No Sev 1 / Sev 2 issues in this Phase 6 run.
- Sev 3 operability observation: certain CLI invocations (`app list` / webhook branch command) can hang in this non-interactive automation context; mitigated in drills by direct metadata/API path and timeout wrappers.

## Cleanup
- Temporary app metadata removed (`phase6-webhook-replay`).

---

## Phase 6 Continuation (Bounded Resource Pressure)

### 5. CPU burst under live API polling
- Method:
  - Spawned 4 short-lived CPU workers (`yes > /dev/null`) while probing:
    - `GET /api/system/status`
    - `GET /api/system/metrics`
  - Probe cadence: 40 samples at ~200ms intervals, 2s per-request timeout.
- Result summary:
  - `cpu_total_samples=40`
  - `cpu_status_ok=38`
  - `cpu_metrics_ok=40`
  - `cpu_status_fail=2`
  - `cpu_metrics_fail=0`
- Interpretation:
  - Minor transient degradation observed on `/api/system/status` under CPU stress.
  - `/api/system/metrics` remained fully responsive in this run.

### 6. Disk I/O burst under live API polling
- Method:
  - Wrote a bounded 512MB file to `/tmp` (`dd`, fsync) while probing same endpoints.
- Result summary:
  - `disk_file_bytes=536870912`
  - `disk_total_samples=40`
  - `disk_status_ok=40`
  - `disk_metrics_ok=40`
  - `disk_status_fail=0`
  - `disk_metrics_fail=0`
- Interpretation:
  - No visible API availability regression during this bounded disk write drill.

### Cleanup
- Pressure file removed successfully (`disk_file_leftover=0`).

### Findings Update
- No Sev 1 / Sev 2 issues.
- Sev 3 reliability signal: `/api/system/status` can show brief timeouts under CPU saturation bursts.
