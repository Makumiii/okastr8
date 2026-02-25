# Okastr8

![Okastr8 Wordmark](assets/okastr8-wordmark-dark.svg)

Self-hosted PaaS workflows for Linux servers you control.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-orange.svg)
![Deploy: Docker](https://img.shields.io/badge/Deploy-Docker-2496ED.svg)

Okastr8 gives you the deployment experience teams expect from managed platforms, but runs on your own infrastructure. It combines a web dashboard and a CLI for GitHub deployments, direct container-image deployments, environment management, rollback, health checks, and server operations.

## Table of Contents

- [What Okastr8 Is](#what-okastr8-is)
- [Core Capabilities](#core-capabilities)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Requirements](#requirements)
- [Installation](#installation)
- [First Login and Admin Binding](#first-login-and-admin-binding)
- [Configuration Model](#configuration-model)
  - [`system.yaml` (host-level)](#systemyaml-host-level)
  - [`okastr8.yaml` (app-level)](#okastr8yaml-app-level)
  - [App Environment Variables](#app-environment-variables)
- [Production Setup (End-to-End)](#production-setup-end-to-end)
  - [1. Public URL and Tunnel](#1-public-url-and-tunnel)
  - [2. GitHub OAuth App](#2-github-oauth-app)
  - [3. Connect GitHub in Okastr8](#3-connect-github-in-okastr8)
  - [4. GHCR / OCI Registry Setup](#4-ghcr--oci-registry-setup)
- [Deployment Flows](#deployment-flows)
  - [Flow A: GitHub Repository Deploy](#flow-a-github-repository-deploy)
  - [Flow B: Container Registry Image Deploy](#flow-b-container-registry-image-deploy)
  - [Flow C: Publish Built Git Deploys to Registry](#flow-c-publish-built-git-deploys-to-registry)
- [Dashboard Flows](#dashboard-flows)
- [CLI Flows and Commands](#cli-flows-and-commands)
- [Routing Modes (Caddy vs Tunnel Routing)](#routing-modes-caddy-vs-tunnel-routing)
- [Managed Services (Database / Cache)](#managed-services-database--cache)
- [Operations and Day-2 Management](#operations-and-day-2-management)
- [Production Hardening Checklist](#production-hardening-checklist)
- [Troubleshooting](#troubleshooting)
- [Additional Documentation](#additional-documentation)
- [Development and Contribution](#development-and-contribution)

## What Okastr8 Is

Okastr8 is a deployment and app-operations tool for Linux servers.

- You can deploy from GitHub repositories or prebuilt container images.
- Deployments run as Docker containers on your own host.
- You manage apps through either a dashboard UI or the `okastr8` CLI.
- It supports webhook-based auto-deploy, rollback, health checks, logs, and runtime metrics.
- It supports both reverse-proxy routing (Caddy) and Cloudflare tunnel-based routing.

## Core Capabilities

- GitHub repository import and deployment
- Direct image deployment from OCI registries (GHCR, Docker Hub, ECR, generic)
- Optional publish of built Git deploy images to registry
- Webhook auto-deploy on pushes
- Deployment history and rollback (git/image strategies)
- App-scoped environment variables (`.env` import/export)
- Per-app tunnel routing with Cloudflare sidecar
- Managed service sidecars (`database`, `cache`) for supported types
- Security controls around auth, OAuth state, webhook verification, and secret storage
- CLI + dashboard operation model for end-to-end app lifecycle

## Architecture at a Glance

- **Manager API + Dashboard UI**: served by `okastr8-manager` (default port `41788`)
- **CLI**: `okastr8` command for automation and server operations
- **Runtime**: Docker containers for app workloads
- **Ingress**:
  - Caddy-based reverse proxy (domain routing)
  - Optional Cloudflare tunnel (manager and/or app-specific)
- **State/config location**: `~/.okastr8`

## Requirements

- Linux host (Debian/Ubuntu recommended)
- `sudo` access
- Internet access to pull dependencies/images
- GitHub account (for OAuth-based dashboard access and Git deploys)
- Optional: Cloudflare account (for tunnel exposure)
- Optional: GHCR or other OCI registry account (for image workflows)

## Installation

Quick install:

```bash
curl -fsSL https://raw.githubusercontent.com/Makumiii/okastr8/main/scripts/bash/install.sh | bash
```

After install:

```bash
okastr8 --version
systemctl status okastr8-manager
```

Manager URL (local): `http://<server-ip>:41788`

## First Login and Admin Binding

Okastr8 uses GitHub OAuth for dashboard authentication.

1. Configure OAuth credentials in `~/.okastr8/system.yaml` (see production setup below).
2. Run:

```bash
okastr8 github connect
```

3. Complete OAuth in browser.
4. The authenticated GitHub identity is bound as admin for dashboard access.

## Configuration Model

### `system.yaml` (host-level)

Path: `~/.okastr8/system.yaml`

Used for host and platform configuration:

- Manager API settings (port, auth)
- GitHub OAuth credentials
- Tunnel settings and public URL
- Notification settings
- Environment detection metadata

Minimal production-oriented example:

```yaml
manager:
  port: 41788
  github:
    client_id: "YOUR_GITHUB_OAUTH_CLIENT_ID"
    client_secret: "YOUR_GITHUB_OAUTH_CLIENT_SECRET"

tunnel:
  enabled: true
  auth_token: "YOUR_CLOUDFLARE_TUNNEL_TOKEN"
  url: "https://okastr8.yourdomain.com"
```

Copy-first minimal template: [`examples/system.minimal.yaml`](examples/system.minimal.yaml)  
Full template: [`examples/system.example.yaml`](examples/system.example.yaml)

### `okastr8.yaml` (app-level)

Path: repository root of the app you deploy.

Defines **how that app builds/runs/routes**.

Common example:

```yaml
runtime: "node:22"
port: 3000
start: "npm run start"
build:
  - "npm ci"
  - "npm run build"
domain: "app.yourdomain.com"
tunnel_routing: false

database: "postgres:15"
cache: "redis:7"

publish_image:
  enabled: true
  image: "ghcr.io/your-org/your-app:latest"
  registry_credential: "ghcr-main"
```

Full reference: [`OKASTR8_YAML.md`](docs/config/OKASTR8_YAML.md)
Minimal template: [`examples/okastr8.minimal.yaml`](examples/okastr8.minimal.yaml)

### App Environment Variables

Do **not** store secrets in `okastr8.yaml`.

Use CLI/UI env management:

```bash
okastr8 app env set myapp KEY=value
okastr8 app env import myapp --file .env.production
okastr8 app env list myapp
okastr8 app env export myapp --file backup.env
okastr8 app env unset myapp OLD_KEY
```

## Production Setup (End-to-End)

### 1. Public URL and Tunnel

If you need remote dashboard access or GitHub webhooks, set a public URL.

Cloudflare tunnel flow:

1. Create tunnel token in Cloudflare Zero Trust.
2. Configure hostname to point to manager (`localhost:41788` by default).
3. Run:

```bash
okastr8 tunnel setup <token>
okastr8 tunnel status
```

4. Set `tunnel.url` in `~/.okastr8/system.yaml`.

Detailed guide: [`TUNNEL_SETUP.md`](docs/networking/TUNNEL_SETUP.md)

### 2. GitHub OAuth App

Create a GitHub OAuth App and set:

- **Homepage URL**: your public dashboard URL (`https://okastr8.yourdomain.com`)
- **Authorization callback URL**: `https://okastr8.yourdomain.com/api/github/callback`

Then write `client_id` and `client_secret` into `~/.okastr8/system.yaml`.

### 3. Connect GitHub in Okastr8

```bash
okastr8 github status
okastr8 github connect
okastr8 github setup-key
```

- `connect`: authenticates and links account
- `setup-key`: provisions deploy SSH key for clone operations

### 4. GHCR / OCI Registry Setup

For private image push/pull and publish-image workflows.

1. Create GHCR PAT (GitHub classic token) with at least:
   - `read:packages`
   - `write:packages` (if pushing)
   - `delete:packages` (optional)

2. Add credential to Okastr8:

```bash
okastr8 registry add ghcr-main ghcr ghcr.io <github-username> <token>
okastr8 registry test ghcr-main
okastr8 registry list
```

3. Optional GHCR discovery:

```bash
okastr8 registry ghcr packages ghcr-main --owner-type user --owner <github-username>
okastr8 registry ghcr tags ghcr-main <package_name> --owner-type user --owner <github-username>
```

## Deployment Flows

### Flow A: GitHub Repository Deploy

CLI:

```bash
okastr8 github import owner/repo --branch main
```

Wizard mode (default) lets you configure:

- runtime/build/start/port/domain/tunnel routing
- environment variables
- optional publish-to-registry settings

After import, redeploy with:

```bash
okastr8 deploy trigger <app>
```

### Flow B: Container Registry Image Deploy

Create app from image:

```bash
okastr8 app create-image myapp ghcr.io/org/app:tag \
  --port 8080 \
  --container-port 3000 \
  --registry-credential ghcr-main
```

Update image later:

```bash
okastr8 app update-image myapp ghcr.io/org/app:new-tag --deploy
```

### Flow C: Publish Built Git Deploys to Registry

When app is git-backed, trigger deploy and publish built image:

```bash
okastr8 deploy trigger myapp \
  --push-image \
  --push-image-ref ghcr.io/org/myapp:release-2026-02-25 \
  --push-registry-credential ghcr-main
```

Equivalent persistent config in `okastr8.yaml`:

```yaml
publish_image:
  enabled: true
  image: "ghcr.io/org/myapp:latest"
  registry_credential: "ghcr-main"
```

## Dashboard Flows

Primary dashboard flows mirror CLI capabilities:

- Login with GitHub OAuth
- GitHub repository import/deploy wizard
- Container image deploy wizard
- Deployment strategy selection (git/image)
- Environment variable entry/import
- Domain routing and tunnel-routing toggles
- App lifecycle actions: start/stop/restart/logs/delete
- Deployment history + rollback
- Metrics and activity views

Suggested operator sequence in UI:

1. Connect GitHub
2. Add registry credential (if using private images or publish-image)
3. Deploy app (GitHub or image)
4. Verify health/logs
5. Configure webhook + rollout process
6. Validate rollback path

## CLI Flows and Commands

Top-level command groups:

- `okastr8 app ...`
- `okastr8 deploy ...`
- `okastr8 github ...`
- `okastr8 registry ...`
- `okastr8 tunnel ...`
- `okastr8 setup ...`
- `okastr8 service ...`
- `okastr8 systemd ...`
- `okastr8 metrics ...`
- `okastr8 system ...`

Useful daily commands:

```bash
okastr8 app list
okastr8 app status <app>
okastr8 app logs <app>
okastr8 deploy history <app>
okastr8 deploy rollback <app>
okastr8 metrics --once
```

Full command reference: [`CLI_REFERENCE.md`](docs/reference/CLI_REFERENCE.md)

## Routing Modes (Caddy vs Tunnel Routing)

### Caddy (default)

- Use `domain` in app config/creation.
- Traffic hits host proxy and routes to app container.

### Tunnel Routing (`tunnel_routing: true`)

- App gets dedicated Cloudflare tunnel sidecar.
- Requires app-level `TUNNEL_TOKEN` env variable.
- Bypasses Caddy for that app route.

## Managed Services (Database / Cache)

You can request managed sidecars directly via app config:

- `database: "postgres:15" | "mysql:8" | "mariadb:10" | "mongo:7"`
- `cache: "redis:7"`

Okastr8 injects connection env vars (e.g. `DATABASE_URL`, `REDIS_URL`) automatically for supported types.

## Operations and Day-2 Management

Service and host operations:

```bash
okastr8 service start-all
okastr8 service stop-all
okastr8 service restart-all

okastr8 systemd list
okastr8 systemd status <service>
okastr8 systemd logs <service>
```

Setup/hardening helpers:

```bash
okastr8 setup full
okastr8 setup sudoers
okastr8 setup firewall
okastr8 setup fail2ban
okastr8 setup ssh-harden
```

Health checks:

```bash
okastr8 deploy health http http://127.0.0.1:3000/health
okastr8 deploy health port 3000
```

## Production Hardening Checklist

Before production cutover:

1. `system.yaml` and auth stores locked to `0600`
2. Correct public URL (`tunnel.url` and/or manager public URL settings)
3. OAuth callback exactly matches deployed URL
4. Tunnel service healthy
5. Registry credentials scoped minimally
6. Rollback flow tested (`deploy rollback`)
7. App logs/metrics verified
8. `okastr8-manager` running under `systemd` in production mode

Security baseline document: [`SECURITY_MODEL.md`](docs/security/SECURITY_MODEL.md)

Extended checklist: [`docs/testing/PROD_READINESS_CHECKLIST.md`](docs/testing/PROD_READINESS_CHECKLIST.md)

## Troubleshooting

### GitHub login fails with redirect/callback errors

- Confirm OAuth callback URL in GitHub exactly equals:
  - `https://<public-url>/api/github/callback`
- Confirm `client_id` / `client_secret` in `~/.okastr8/system.yaml`.

### Webhooks not triggering deploys

- Confirm public URL configured and reachable.
- Confirm app webhook is enabled:

```bash
okastr8 app webhook <app>
okastr8 app webhook <app> on
```

### Image pulls fail from private GHCR

- Confirm credential:

```bash
okastr8 registry test ghcr-main
```

- Confirm token scopes and package visibility.

### Deploy trigger uses wrong git branch

- Re-import app with intended branch:

```bash
okastr8 github import owner/repo --branch <branch>
```

- Then re-run `okastr8 deploy trigger <app>`.

### App not reachable

- Verify container is running and app listens on correct interface/port.
- Confirm routing mode (Caddy domain vs tunnel routing).
- Confirm `port` in app config matches actual container app port mapping.

## Additional Documentation

- `docs/config/OKASTR8_YAML.md` — Full app config reference
- `docs/reference/CLI_REFERENCE.md` — Command-by-command reference
- `docs/networking/TUNNEL_SETUP.md` — Cloudflare tunnel setup and app tunnel routing
- `docs/security/SECURITY_MODEL.md` — Security trust boundaries and controls
- `examples/system.minimal.yaml` — Minimal required `system.yaml` entries to fill
- `examples/system.example.yaml` — Full system config template
- `examples/okastr8.minimal.yaml` — Minimal app deployment config
- `examples/okastr8.yaml` — Full app config example

## Development and Contribution

Local contributor workflow:

```bash
git clone https://github.com/Makumiii/okastr8.git
cd okastr8
bun install
cd dashboard && npm install && cd ..
```

Run manager from source:

```bash
bun run src/managerServer.ts
```

Run CLI from source:

```bash
bun run src/main.ts --help
```

Quality gates:

```bash
bun run lint
bun run typecheck
bun run test
bun run gate:prod:no-e2e
```

For production, run via `systemd` service mode (`okastr8-manager`) rather than source-run mode.

---

Built for teams that want deployment speed without giving up infrastructure ownership.
