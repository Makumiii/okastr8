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
| `build` | string[] | List of build commands. |
| `start` | string | Start command (e.g. `npm start`). |
| `port` | number | Internal port the app listens on. |
| `domain` | string | Public domain name. |
| `env` | object | Environment variables (KEY: VALUE). |

**Example:**
```yaml
name: my-app
build:
  - npm install
  - npm run build
start: npm start
port: 3000
env:
  NODE_ENV: production
```
