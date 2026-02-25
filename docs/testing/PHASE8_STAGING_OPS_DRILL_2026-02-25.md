# Phase 8 Staging/Ops Drill Run - February 25, 2026

## Scope
Operational readiness validation for production checklist items:
- Service/tunnel runtime status
- Auth/token recovery behavior
- Backup/restore integrity
- Rollback readiness contract
- Legacy permission hardening verification

Environment timestamp (UTC): `2026-02-25T12:46:13Z`

## Drill Cases and Results

1. Manager API availability contract
- Probe: `GET http://127.0.0.1:41788/api/auth/me`
- Result: `401` + `{"success":false,"message":"Not authenticated"}`
- Status: Pass (manager reachable and auth middleware active)

2. Service manager status consistency
- Probe: `systemctl is-active okastr8-manager`
- Result: `inactive`
- Probe: `systemctl is-active cloudflared`
- Result: `inactive`
- Status: Warning (service units inactive while API was reachable, implying non-systemd launch path)

3. Token rotation / revocation recovery behavior
- Method: generate token A then token B for same user (`ops-drill-user`) and call protected endpoint with each.
- Token A result: `401` message `Token revoked or not found`
- Token B result: `200` message `System status`
- Status: Pass (single-token policy and revocation enforcement are working)

4. Backup and restore integrity (non-destructive)
- Archive: `/tmp/okastr8-backup-20260225-154706.tar.gz`
- Restore target: `/tmp/okastr8-restore-20260225-154706/extracted/.okastr8`
- File set diff lines: `0`
- SHA comparison: `SHA_MATCH=yes`
- Status: Pass (backup/restore content integrity confirmed)

5. Rollback readiness error contract
- Command: `bun run src/main.ts deploy rollback ops-drill-nonexistent-app`
- Result: exit `1`, message `Rollback failed: App ops-drill-nonexistent-app not found or corrupted`
- Status: Pass (fails fast with actionable error, no hang)

6. Legacy permission hardening verification
- Initial observation: `~/.okastr8/system.yaml` was `0644` from older state.
- Fix implemented: auto-heal permissions on config/auth load path.
- Verification after reload: both files are `0600`
  - `/home/maks/.okastr8/system.yaml` -> `-rw-------`
  - `/home/maks/.okastr8/auth.json` -> `-rw-------`
- Status: Pass (remediated)

## Test/Gate Validation
- `bun run typecheck` -> pass
- `bun run lint` -> pass
- `bun run test:integration` -> pass
- `bun run test:smoke` -> pass
- `bun run gate:prod:no-e2e` -> pass

## Findings
1. Sev 3 ops consistency gap:
- `okastr8-manager` systemd service is inactive while API is live, indicating manager may be running outside systemd.
- Risk: restart/reboot behavior may diverge from operational runbook expectations.
- Recommendation: standardize runtime ownership to systemd in staging/prod and verify `systemctl is-active okastr8-manager` as a release gate check.

2. Legacy security drift fixed:
- Existing `system.yaml` permissions from older installs can be too broad.
- Mitigation has been added in code to auto-heal file mode to `0600` on load/save.

## Exit Criteria Status
- Security and reliability code gates: ✅
- Backup/restore integrity: ✅
- Token recovery behavior: ✅
- Service/tunnel operational consistency on this host: ⚠️ follow-up needed before production sign-off
