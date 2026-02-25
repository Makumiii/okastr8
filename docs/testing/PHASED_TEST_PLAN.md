# Okastr8 Phased Test Plan

## Scope
This plan establishes a pragmatic testing pyramid for the CLI, API, dashboard, and deployment flows.

## Tooling Baseline (Phase 0)
- Root unit/smoke/integration: `bun test`
- Dashboard unit/component: `vitest` + `@testing-library/svelte`
- End-to-end scaffold: `@playwright/test`

## Phase Gates
1. Phase 0: Tooling, scripts, and baseline green test commands.
2. Phase 1: Fast smoke checks for highest-risk flows.
3. Phase 2: Unit coverage for core decision logic.
4. Phase 3: Integration harness across CLI/API boundaries.
5. Phase 4: Automated IRL E2E on disposable infra.
6. Phase 5: Manual exploratory and abuse testing cadence.
7. Phase 6: Reliability/security drills and recovery validation.
8. Phase 7: CI quality gates and flake governance.

## Command Matrix
- Root:
  - `bun run test`
  - `bun run test:unit`
  - `bun run test:smoke`
  - `bun run test:integration`
  - `bun run test:e2e`
- Dashboard:
  - `npm test --prefix dashboard`
  - `npm run test:unit --prefix dashboard`

## Current Status
- Phase 0 implemented with real starter tests and e2e scaffold.
- Phase 1 implemented with API/CLI/dashboard smoke coverage on core auth and command paths.
- Phase 2 implemented with unit coverage for runtime/container generation and auth token policy.
- Phase 3 initial integration harness implemented for auth middleware, token transport (Bearer/Cookie), and CLI/API coexistence checks.
- Phase 4 initial live E2E smoke implemented against a running manager (dashboard load, auth route contracts, and CLI surface checks).
- Phase 5 started with manual charter definition and first non-destructive drill run recorded on February 20, 2026.
- Phase 5 continued with additional signed webhook negative-path drills, token revocation checks, and live login error-path UI verification.
- Phase 5 now includes a controlled manager restart drill and a standardized dev restart helper (`scripts/dev/restart-manager.sh`).
- Phase 5 now also includes a real app webhook branch-mismatch drill and restart-under-active-load probe.
- Phase 6 started with security/recovery drills: signed webhook replay checks, auth edge-case hardening validation, and repeated restart consistency measurements.
- Phase 6 now includes bounded CPU/disk pressure drills with live API responsiveness measurements.
- Phase 7 implemented with production gate scripts and CI workflow enforcement for push/PR checks.
- Phase 8 started with staging/ops drill run on February 25, 2026 (service status, token recovery, backup/restore integrity, rollback contract).
