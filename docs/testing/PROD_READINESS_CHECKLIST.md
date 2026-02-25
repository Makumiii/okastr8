# Okastr8 Production Readiness Checklist

Last updated: 2026-02-25

## 1. Security Baseline
- [ ] `manager.public_url` (or `tunnel.url`) is set correctly in `~/.okastr8/system.yaml`.
- [ ] GitHub OAuth app callback URL exactly matches `${PUBLIC_URL}/api/github/callback`.
- [ ] `~/.okastr8/system.yaml` and `~/.okastr8/auth.json` are `0600`.
- [ ] Admin GitHub identity is configured (`manager.auth.github_admin_id`).
- [ ] Cloudflare tunnel token and registry credentials are scoped minimally.
- [ ] `scripts/setup-sudoers.sh` has been reviewed before applying on production.

## 2. Reliability Gates
- [ ] Run `bun run gate:prod` successfully.
- [ ] If scanners are unavailable locally, run `bun run gate:prod:no-scan` and execute equivalent scanner checks in CI.
- [ ] No failing tests in:
  - [ ] unit
  - [ ] smoke
  - [ ] integration
  - [ ] e2e

## 3. Deployment Strategy Coverage
- [ ] Dashboard GitHub deploy path validated.
- [ ] Dashboard container deploy path validated.
- [ ] CLI deploy trigger/rollback path validated.
- [ ] At least one rollback test executed on staging.

## 4. Operational Readiness
- [ ] `okastr8-manager` service is enabled and running.
- [ ] Tunnel service status is healthy.
- [ ] Log rotation and disk usage are within limits.
- [ ] Alerting email provider (if used) is configured and test alert sent.

## 5. Recovery / Incident Readiness
- [ ] Admin can revoke OAuth token and reconnect.
- [ ] Registry credential rotation playbook tested.
- [ ] App rollback command tested (`okastr8 deploy rollback <app> ...`).
- [ ] Backup strategy for `~/.okastr8` defined and tested.

## 6. Release Sign-off
- [ ] No open P0 issues.
- [ ] No unresolved HIGH/CRITICAL vulnerabilities accepted without documented exception.
- [ ] Final deploy approved by maintainer.
