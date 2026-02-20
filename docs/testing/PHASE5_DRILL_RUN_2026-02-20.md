# Phase 5 Drill Run - February 20, 2026

## Context
- Environment: Live-like development manager running at `http://127.0.0.1:41788`
- Tunnel/OAuth/Webhook: Configured
- Goal: Non-destructive failure-path probe for auth/session/webhook/CLI error contracts

## Drill Cases and Results

1. Protected API without auth token
- Command: `curl http://127.0.0.1:41788/api/system/status`
- Expected: 401
- Actual: 401 with `{"success":false,"message":"Authentication required"}`
- Result: Pass

2. Session introspection without cookie
- Command: `curl http://127.0.0.1:41788/api/auth/me`
- Expected: 401
- Actual: 401 with `{"success":false,"message":"Not authenticated"}`
- Result: Pass

3. Webhook request missing signature
- Command: `POST /api/github/webhook` without `X-Hub-Signature-256`
- Expected: Rejected
- Actual: 401 body `Signature missing`
- Result: Pass

4. Webhook request with invalid signature
- Command: `POST /api/github/webhook` with `X-Hub-Signature-256: sha256=deadbeef`
- Expected: Rejected
- Actual: 401 body `Invalid signature`
- Result: Pass

5. Protected API with valid cookie token
- Command: generate token via `src/commands/auth.ts`, call `/api/system/status` with cookie
- Expected: 200
- Actual: 200 with `{"success":true,"message":"System status",...}`
- Result: Pass

6. Protected API with tampered bearer token
- Command: mutate one token character, call `/api/system/status` with bearer
- Expected: 401
- Actual: 401 with `{"success":false,"message":"Invalid signature"}`
- Result: Pass

7. CLI unknown command
- Command: `bun run src/main.ts definitely-unknown-command`
- Expected: non-zero + actionable error
- Actual: exit code 1, `error: unknown command 'definitely-unknown-command'`
- Result: Pass

## Findings
- No Sev 1 / Sev 2 issues observed in this drill run.
- Observed behavior aligns with expected auth and webhook rejection contracts.

## Follow-up Drill Candidates
1. Manager process restart during active dashboard session.
2. Webhook payload branch mismatch and deploy suppression verification.
3. Deliberate deployment failure and rollback/recovery messaging quality.
4. Invalid/missing `system.yaml` keys and startup behavior.

---

## Drill Run 2 (Later on February 20, 2026)

### Additional Cases and Results

8. Signed push webhook for unknown repository
- Setup: Valid `X-Hub-Signature-256` generated from configured webhook secret.
- Payload: push for `phase5/fake-repo` clone URL.
- Expected: Ignore without deploy trigger.
- Actual: 200 with `{"ignored":true,"message":"No app found for phase5/fake-repo"}`.
- Result: Pass

9. Signed non-push webhook event
- Setup: Valid signature, header `X-GitHub-Event: ping`.
- Expected: Ignore as unsupported event.
- Actual: 200 with `{"ignored":true,"message":"Not a push event"}`.
- Result: Pass

10. Signed push webhook missing repository clone URL
- Setup: Valid signature, push event payload without `clone_url`.
- Expected: Ignore as invalid repository info.
- Actual: 200 with `{"ignored":true,"message":"No repository info"}`.
- Result: Pass

11. Token revocation enforcement
- Setup: Generate token A then token B for same user (single-token policy).
- Expected: token A rejected, token B accepted.
- Actual: token A -> 401 `Token revoked or not found`; token B -> 200 `Session valid`.
- Result: Pass

12. Login UI mapped OAuth error rendering
- Check: `/login?error=github_not_configured` in live Playwright session.
- Expected: User-friendly mapped message visible.
- Actual: Message rendered: \"GitHub OAuth is not configured...\".
- Result: Pass

### Findings After Drill Run 2
- No Sev 1 / Sev 2 issues observed.
- Webhook handler behavior is robust on signed negative paths and avoids accidental deploys for unknown repos/events.

---

## Drill Run 3 (Manager Restart Under Active Use)

### Case
13. Controlled manager restart and recovery verification
- Baseline: `GET /api/auth/me` returned 401 (expected unauthenticated contract).
- Action: terminated active manager process bound to port 41788, then restarted in detached mode.
- First attempt outcome: detached launch method did not keep the process alive reliably; manager became unreachable until manual restore.
- Mitigation added: `scripts/dev/restart-manager.sh` with robust PID detection, `setsid` launch, and HTTP health polling.
- Verification: script executed successfully and restored manager with probe code 401 on `/api/auth/me`.

### Result
- Functional recovery: Pass (after mitigation script).
- Finding: operational restart procedure was brittle without a standardized helper.
- Severity: Sev 3 (operability risk, not data/security impact).
- Status: Mitigated with `scripts/dev/restart-manager.sh`.

---

## Drill Run 4 (Real App Branch-Mismatch + Active-Load Restart)

### Case
14. Real app webhook branch-mismatch using `Makumiii/okastr8-test-app`
- Setup:
  - Registered temporary app `phase5-webhook-real` (metadata only, no deploy).
  - `gitRepo=https://github.com/Makumiii/okastr8-test-app.git`
  - webhook branch set to `v1-simple`.
- Action:
  - Sent validly signed push webhook for `refs/heads/v2-with-db`.
- Expected:
  - Webhook should be ignored due to branch mismatch.
- Actual:
  - `200` with `{"ignored":true,"message":"Branch mismatch: refs/heads/v2-with-db != v1-simple"}`.
- Result: Pass

15. Restart manager during active request loop
- Setup:
  - Continuous probe loop against `/login` and `/api/auth/me` at ~200ms intervals.
  - Triggered restart via `scripts/dev/restart-manager.sh`.
- Observed summary:
  - `total_samples=120`
  - `login_down_samples=1`
  - `auth_down_samples=1`
  - transient outage observed for a single sample window.
- Result: Pass (short transient disruption, expected for hard restart).

### Cleanup
- Deleted temporary app registration:
  - `bun run src/main.ts app delete phase5-webhook-real`
  - Verified with `bun run src/main.ts app list` -> `No apps found.`

### Findings After Drill Run 4
- No new Sev 1 / Sev 2 issues.
- Branch-mismatch protection works correctly on a real app metadata path.
- Restart helper keeps recovery fast and consistent under active polling.
