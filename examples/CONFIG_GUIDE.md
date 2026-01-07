# okastr8 Configuration Guide

okastr8 uses **YAML** for all configuration. There are two main files you need to know about.

## 1. System Config (`system.yaml`)
**Scope**: Server/Manager Level.
**Location**: `~/.okastr8/system.yaml`
**Purpose**: The single source of truth for your server. It combines infrastructure setup, authentication, and tunneling.

| Section | Field | Description |
|---------|-------|-------------|
| `setup` | `user.username` | The system user created during installation. |
| | `ssh.port` | The custom SSH port (default: 2222). |
| `manager` | `port` | The port the dashboard runs on (8788). |
| | `api_key` | Secret key protecting the dashboard. |
| `manager.github` | `client_id` | GitHub OAuth Client ID. |
| | `client_secret` | GitHub OAuth Client Secret. |
| `tunnel` | `auth_token` | Your Ngrok authtoken. |
| | `url` | The public URL of your dashboard. |

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
**Location**: Git Root (`okastr8.yaml` or `okastr8.json`)
**Purpose**: Defines how to build and run your application.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | App name override. |
| `runtime` | string | Required runtime: `node`, `python`, `go`, `bun`, `deno`. |
| `build` | string[] | List of build commands. |
| `start` | string | Start command (e.g. `npm start`). |
| `port` | number | Internal port the app listens on. |
| `domain` | string | Public domain name. |
| `env` | object | Environment variables (KEY: VALUE). |

**Example:**
```yaml
name: my-app
runtime: node
build:
  - npm install
  - npm run build
start: npm start
port: 3000
env:
  NODE_ENV: production
```

---

## 3. Runtime Environments

okastr8 automatically detects installed runtimes and stores them in `system.yaml`.

**Supported Runtimes:**
- `node` - Node.js
- `python` - Python 3
- `go` - Go/Golang
- `bun` - Bun runtime
- `deno` - Deno runtime

**Scan for runtimes:**
```bash
okastr8 env scan
```

**How it works:**
1. During deploy, okastr8 reads the `runtime` field from your `okastr8.yaml`
2. It checks if that runtime is installed on the server
3. If missing, the deploy fails with helpful install instructions

**Example output when runtime is missing:**
```
❌ Runtime 'python' is required but not installed.

To install python:
  sudo dnf install python3

After installing, run: okastr8 env scan
```
