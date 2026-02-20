# Phase 5 Manual Exploratory Charter

## Purpose
Run structured exploratory sessions against a live Okastr8 environment to uncover functional, reliability, security, and operability issues not covered by automated tests.

## Session Cadence
- Frequency: 2 sessions per week during active development, then weekly.
- Duration: 45-60 minutes per session.
- Environment: Live-like development stack (manager + dashboard + CLI + tunnel + OAuth/webhooks).

## Core Charters

### 1) Auth and Session Integrity
- Validate login redirect paths and callback errors.
- Validate protected routes reject missing/tampered tokens.
- Validate logout/session expiry behavior across dashboard and API.
- Probe for auth bypass via headers/cookies mismatch.

### 2) Deploy Flow Resilience
- Import repo, select branch, trigger deploy, inspect logs.
- Interrupt deploy mid-run (cancel/retry), verify recovery behavior.
- Trigger failure (bad build command), verify message quality and rollback posture.

### 3) Webhook Safety
- Send malformed webhook payloads.
- Send missing/invalid signatures.
- Validate branch mismatch warnings and no unintended deploys.

### 4) Runtime and Service Faults
- Simulate manager restart during active dashboard usage.
- Validate UI/API behavior under transient unavailability.
- Confirm health/status surfaces are accurate after restart.

### 5) CLI and UX Error Surfaces
- Run invalid CLI commands and malformed arguments.
- Verify non-zero exits and actionable errors.
- Validate command help and discoverability of recovery steps.

## Severity Rubric
- Sev 1: Security exposure, data loss, remote command risk.
- Sev 2: Core workflow broken (auth, deploy, rollback, webhook).
- Sev 3: Partial degradation, confusing behavior, weak observability.
- Sev 4: Cosmetic/low impact.

## Evidence Requirements
- For each finding capture:
  - Exact timestamp (UTC)
  - Command/request used
  - Expected vs actual behavior
  - Service logs excerpt (if relevant)
  - Severity and reproduction confidence

## Exit Criteria for Phase 5
- At least 5 full exploratory sessions executed.
- No open Sev 1 issues.
- Sev 2 issues either fixed or have accepted mitigation and owner.
