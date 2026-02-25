# okastr8 Configuration Guide

okastr8 uses **YAML** for all configuration. There are two main files you need to know about.

Quick start templates:

- Minimal system template: `examples/system.minimal.yaml`
- Minimal app template: `examples/okastr8.minimal.yaml`
- Full system template: `examples/system.example.yaml`
- Full app template: `examples/okastr8.yaml`

## 1. System Config (`system.yaml`)

**Scope**: Server/Manager Level.
**Location**: `~/.okastr8/system.yaml`
**Purpose**: The single source of truth for your server. It combines infrastructure setup, authentication, and tunneling.

| Section          | Field           | Description                                  |
| ---------------- | --------------- | -------------------------------------------- |
| `setup`          | `user.username` | The system user created during installation. |
|                  | `ssh.port`      | The custom SSH port (default: 2222).         |
| `manager`        | `port`          | The port the dashboard runs on (41788).      |
|                  | `api_key`       | Secret key protecting the dashboard.         |
| `manager.github` | `client_id`     | GitHub OAuth Client ID.                      |
|                  | `client_secret` | GitHub OAuth Client Secret.                  |
| `tunnel`         | `auth_token`    | Your Cloudflare tunnel token.                |
|                  | `url`           | The public URL of your dashboard.            |

**Example:**

```yaml
setup:
    user: { username: deploy }
    ssh: { port: 2222 }
manager:
    github:
        client_id: "Ov23..."
        client_secret: "..."
tunnel:
    enabled: true
    auth_token: "..."
```

---

## 2. Repository Config (`okastr8.yaml`)

**Scope**: Repository Level.
**Location**: Git Root (`okastr8.yaml` or `okastr8.yml`)
**Purpose**: Defines how to build and run your application.

| Field     | Type     | Description                                              |
| --------- | -------- | -------------------------------------------------------- |
| `runtime` | string   | Required runtime: `node`, `python`, `go`, `bun`, `deno`. |
| `build`   | string[] | List of build commands.                                  |
| `start`   | string   | Start command (e.g. `npm start`).                        |
| `port`    | number   | Internal port the app listens on.                        |
| `domain`         | string   | Public domain name.                                      |
| `tunnel_routing` | boolean  | Use Cloudflare Tunnel sidecar (bypasses Caddy).          |
| `publish_image`  | object   | Opt-in publish of built git deployment image to registry. |

**Example:**

```yaml
runtime: node
build:
    - npm install
    - npm run build
start: npm start
port: 3000
tunnel_routing: true
publish_image:
    enabled: true
    image: ghcr.io/your-org/my-app:latest
    registry_credential: ghcr-main
```

---

## 3. Runtime Environments

okastr8 detects app runtime from repository files during import/deploy (for example `package.json`, `pyproject.toml`, `go.mod`, `bun.lockb`, `deno.json`).

**Supported Runtimes:**

- `node` - Node.js
- `python` - Python 3
- `go` - Go/Golang
- `bun` - Bun runtime
- `deno` - Deno runtime

**How it works:**

1. During deploy, okastr8 reads the `runtime` field from your `okastr8.yaml`
2. It checks if that runtime is installed on the server
3. If missing or unsupported, deployment fails with actionable diagnostics.

Environment variables should be provided through dashboard deploy forms or CLI env commands (`okastr8 app env ...`), not embedded in repository config.
