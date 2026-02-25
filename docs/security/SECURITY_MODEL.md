# Okastr8 Security Model (Baseline)

## Trust Boundaries
- Browser/UI to Manager API (`/api/*`) over HTTPS/tunnel.
- Manager API to host OS via constrained `sudo` commands.
- Manager API to GitHub OAuth and GitHub API.
- Manager API to Docker daemon and registry endpoints.
- Manager API to Cloudflare tunnel service.

## Primary Assets
- Deployment host integrity and root-level command execution paths.
- GitHub OAuth credentials and access tokens.
- Session tokens and auth secret (`~/.okastr8/auth.json`).
- Registry credentials and tunnel tokens.
- App source/deployment metadata under `~/.okastr8`.

## Current Security Controls
- Signed token auth with expiry and revocation list.
- Admin-only authorization checks on privileged endpoints.
- Webhook HMAC verification with constant-time comparison.
- Session cookie with `HttpOnly`, `SameSite=Strict`, `Secure` on HTTPS.
- OAuth state nonce generation + one-time callback validation.
- Callback origin allowlist from configured public URLs.
- Restrictive file permissions (`0600`) for auth/config/credential stores.
- Secret redaction in structured logs.

## High-Risk Paths
- Any API compromise can pivot into privileged host operations via `sudo`.
- Docker daemon access remains high impact.
- OAuth and webhook endpoints are internet-facing and must stay rate-limited and audited.

## Assumptions
- TLS termination is correctly configured at reverse proxy/tunnel edge.
- `system.yaml` public URL values are correct and controlled by admins.
- Host firewall and SSH hardening are managed via setup scripts.

## Remaining Hardening Backlog
- Reduce `sudo` command surface further (narrow docker paths/args and wrappers).
- Add stricter input validation for all command/script arguments.
- Add hardened systemd sandbox options for manager service.
- Add dependency and container vulnerability scanning to release gates.
