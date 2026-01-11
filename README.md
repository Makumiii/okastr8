# Okastr8

![Okastr8 Logo](assets/logo-light.png)

**The Open-Source PaaS for Your Own Servers**

Deploy, manage, and monitor your applications with a beautiful dashboard and powerful CLI.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-orange.svg)

---

## 🎯 What is Okastr8?

Okastr8 is a self-hosted Platform-as-a-Service (PaaS) that brings the simplicity of Vercel/Railway to your own Linux servers. It combines:

- **🖥️ Beautiful Dashboard** - Modern "Bento Grid" UI for visual monitoring
- **⚡ Powerful CLI** - Automate everything from deployments to user management
- **🔄 Git-based Deploys** - Push to GitHub, auto-deploy with webhooks
- **🔒 Zero-Trust Security** - Token-based auth, role permissions, SSH hardening
- **📊 Real-time Metrics** - CPU, RAM, Disk monitoring with alerts

---

## 📦 Installation

### Method 1: Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/Makumiii/okastr8/main/scripts/bash/install.sh | bash
```

This will:
1. Install Bun runtime (if not present)
2. Clone okastr8 to `~/.okastr8/app`
3. Install dependencies
4. Configure systemd services
5. Set up the `okastr8` command globally

### Method 2: Git Clone

```bash
# Clone the repository
git clone https://github.com/Makumiii/okastr8.git
cd okastr8

# Install dependencies
bun install

# Run the setup (configures sudo permissions for automation)
sudo bun run src/main.ts setup sudoers

# Create global alias
echo 'alias okastr8="bun run ~/okastr8/src/main.ts"' >> ~/.bashrc
source ~/.bashrc
```

### Method 3: Binary (Coming Soon)

We're exploring distributing okastr8 as a standalone binary using Bun's compile feature.

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| **Bun Runtime** | Easy updates, smaller size, full ecosystem | Requires Bun installed |
| **Binary** | Zero dependencies, faster startup | Larger size (~100MB), manual updates |

> **Current Recommendation:** Use the curl installer or git clone. Binary distribution is planned for v2.0.

---

## 🚀 Quick Start

### 1. Start the Dashboard

```bash
# Start the okastr8 manager server
okastr8 # or: bun run src/main.ts

# Access dashboard at http://your-server:8788
```

### 2. Connect GitHub

```bash
# Link your GitHub account for easy imports
okastr8 github connect
```

### 3. Deploy Your First App

```bash
# Interactive import from GitHub
okastr8 github repos

# Or deploy from URL
okastr8 deploy trigger my-app --branch main
```

---

## 📖 CLI Reference

### Application Management

```bash
# List all apps
okastr8 app list

# View app status
okastr8 app status <app-name>

# Start/Stop/Restart
okastr8 app start <app-name>
okastr8 app stop <app-name>
okastr8 app restart <app-name>

# View logs
okastr8 app logs <app-name> --lines 100

# Export logs to file
okastr8 app export-logs <app-name>

# Webhook control
okastr8 app webhook <app-name>         # Check status
okastr8 app webhook <app-name> enable  # Enable auto-deploy
okastr8 app webhook <app-name> disable # Disable auto-deploy
```

### Deployment

```bash
# Trigger deployment
okastr8 deploy trigger <app-name>
okastr8 deploy trigger <app-name> --branch feature-x

# View deployment history
okastr8 deploy history <app-name>

# Health checks
okastr8 deploy health process <app-name>  # Check if process is running
okastr8 deploy health port 3000           # Check if port is listening
okastr8 deploy health http localhost:3000 # HTTP health check

# Rollback to previous version
okastr8 deploy rollback <app-name>
```

### GitHub Integration

```bash
# Check connection status
okastr8 github status

# Connect GitHub account (OAuth)
okastr8 github connect

# Disconnect
okastr8 github disconnect

# Interactive repository browser
okastr8 github repos

# List repos (non-interactive)
okastr8 github repos --plain --limit 20
```

### User Access Control

```bash
# List dashboard users
okastr8 access list

# Add a new user
okastr8 access add user@example.com --role viewer
okastr8 access add admin@example.com --role admin

# View user info
okastr8 access info user@example.com

# Update permissions
okastr8 access update user@example.com --add app:deploy

# Generate new token
okastr8 access token user@example.com
okastr8 access renew user@example.com  # Also emails new token

# Revoke access
okastr8 access revoke user@example.com  # Revoke token only
okastr8 access remove user@example.com  # Remove user entirely

# List active tokens
okastr8 access active
```

### Admin Authentication

```bash
# Generate admin token
okastr8 auth token
okastr8 auth token --expiry 2h

# List all tokens
okastr8 auth list

# View pending login approvals
okastr8 auth pending

# Test email configuration
okastr8 auth test-email
```

### System Users (Linux)

```bash
# Interactive user manager
okastr8 user list-users

# Create new system user
okastr8 user create

# Delete user
okastr8 user delete <username>

# Lock/Unlock accounts
okastr8 user lock <username>
okastr8 user unlock <username>

# View user groups
okastr8 user list-groups <username>
```

### Global Service Control

```bash
# Control all managed services
okastr8 service start-all
okastr8 service stop-all
okastr8 service restart-all
```

### Server Setup & Hardening

```bash
# Configure passwordless sudo for okastr8 (required)
sudo okastr8 setup sudoers

# Install fail2ban for brute-force protection
sudo okastr8 setup fail2ban

# Configure UFW firewall
sudo okastr8 setup firewall

# Harden SSH (disable password auth, root login)
sudo okastr8 setup ssh-harden

# Change SSH port
sudo okastr8 setup ssh-port 2222

# Full server setup (all of the above)
sudo okastr8 setup full
```

### Cloudflare Tunnel

```bash
# Check tunnel status
okastr8 tunnel status

# Setup tunnel with Cloudflare token
okastr8 tunnel setup <cloudflare-tunnel-token>

# Remove tunnel
okastr8 tunnel uninstall
```

### Live Metrics

```bash
# Live dashboard (refreshes every 2s)
okastr8 metrics

# Single snapshot
okastr8 metrics --once
```

---

## 🖥️ Web Dashboard

The dashboard is available at `http://your-server:8788` after starting okastr8.

### Features

- **System Overview**: Real-time CPU, RAM, Disk usage
- **App Grid**: Visual cards for each deployed application
- **One-Click Actions**: Start, stop, restart apps instantly
- **Deployment Logs**: Live streaming logs
- **User Management**: Add/remove dashboard users
- **GitHub Integration**: Import repos with one click
- **Global Controls**: Start/Stop all services

### Authentication

1. Generate a token: `okastr8 auth token`
2. Use the token to log in at the dashboard
3. Tokens expire after 24 hours (configurable)

---

## ⚙️ Configuration

### App Configuration (`okastr8.yaml`)

Place this file in your repository root:

```yaml
# Runtime environment
runtime: node  # node, python, go, bun, deno

# Build steps (run in order)
build:
  - npm install
  - npm run build

# Start command
start: npm start

# Networking
port: 3000
domain: myapp.example.com

# Environment variables
env:
  NODE_ENV: production
  DATABASE_URL: postgres://...
```

### System Configuration (`~/.okastr8/system.yaml`)

```yaml
manager:
  port: 8788
  
  github:
    client_id: your-github-oauth-client-id
    client_secret: your-github-oauth-client-secret

notifications:
  brevo:
    api_key: your-brevo-api-key
    from_email: noreply@yourdomain.com
    from_name: Okastr8
    
  alerts:
    admin_email: admin@yourdomain.com
    resources:
      enabled: true
      cpu_threshold: 80
      ram_threshold: 85
      disk_threshold: 90
```

---

## 🔒 Security

### Permission Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access (`*`) |
| `deployer` | Deploy apps, view logs |
| `viewer` | Read-only access |

### Custom Permissions

```bash
# Grant specific permissions
okastr8 access update user@example.com --add app:deploy,app:logs

# Available permissions:
# - view:* (read access)
# - app:* (app management)
# - app:deploy, app:logs, app:restart
# - user:* (user management)
# - system:* (server controls)
```

---

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Backend**: TypeScript, Hono
- **Frontend**: Vanilla JS, CSS3 (no build step)
- **Process Manager**: systemd
- **Reverse Proxy**: Caddy
- **Auth**: JWT tokens with HMAC-SHA256

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Development
git clone https://github.com/Makumiii/okastr8.git
cd okastr8
bun install
bun run src/main.ts
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ for developers who want control over their infrastructure.**

[Documentation](https://github.com/Makumiii/okastr8/wiki) · [Report Bug](https://github.com/Makumiii/okastr8/issues) · [Request Feature](https://github.com/Makumiii/okastr8/issues)
