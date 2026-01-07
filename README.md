# okastr

**okastr8** is a powerful, open-source CLI and dashboard tool designed to simplify the deployment, management, and orchestration of applications on your Linux servers.

It combines a robust CLI for automation with a beautiful, modern "Bento Grid" dashboard for visual monitoring and management.

---

## ✨ Features

- **Dashboard:** A stunning, responsive web UI to monitor system health, services, and apps.
- **App Management:** Create, deploy, start, stop, and manage apps (Node.js, Python, Go, etc.) with ease.
- **Zero-Downtime Deployment:** Seamless git-based deployments with build steps and health checks.
- **Server Setup:** Automate server hardening, firewall configuration, and dependency installation.
- **User Management:** Manage system users and permissions directly from the UI.
- **Orchestration:** Define your entire infrastructure in a simple YAML config.

---

## 📦 Installation

### Quick Install (Recommended)

You can install `okastr8` with a single command. This script will clone the repository, install dependencies, and set up the systemd services.

```bash
curl -fsSL https://raw.githubusercontent.com/Makumiii/okastr8/main/scripts/bash/install.sh | bash
```

> **Note:** The installation script usually requires `sudo` privileges to set up systemd services and install system dependencies.

### Manual Installation

If you prefer to install manually:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Makumiii/okastr8.git ~/okastr8
    cd ~/okastr8
    ```

2.  **Install dependencies:**
    This project uses [Bun](https://bun.sh/).
    ```bash
    bun install
    ```

3.  **Build & Setup:**
    ```bash
    # Run the setup script to install system dependencies (Caddy, Redis, etc.)
    ./scripts/setup.sh
    
    # Create the okastr8 alias
    sudo ln -s $(pwd)/src/main.ts /usr/local/bin/okastr8
    ```

---

## 🚀 Usage

### Command Line Interface (CLI)

`okastr8` provides a rich set of commands to manage your server.

#### Application Management
```bash
# Create a new app
okastr8 app create my-app --port 3000 --domain app.example.com

# Deploy an app
okastr8 deploy trigger my-app --branch main

# View app status
okastr8 app status my-app

# View app logs
okastr8 app logs my-app
```

#### Server Setup
```bash
# Run full server setup (hardening, firewall, etc.)
okastr8 setup full

# Configure firewall
okastr8 setup firewall --ssh-port 2222
```

#### Deployment History
```bash
# View deployment history
okastr8 deploy history my-app

# Rollback to a specific commit
okastr8 deploy rollback my-app --commit <hash>
```

### Web Dashboard

Once installed, the `okastr8` dashboard is available at your server's public IP or configured domain.

- **System Overview:** Monitor CPU, RAM, and disk usage.
- **App Grid:** See all running applications and their status.
- **One-Click Actions:** Start, stop, or restart apps instantly.
- **User Management:** Add or remove system users.

---

## ⚙️ Configuration (`okastr8.yaml`)

You can define your application's deployment configuration in an `okastr8.yaml` file at the root of your repository.

```yaml
name: my-node-app
description: "A sample Node.js application"
runtime: node

build:
  - npm install
  - npm run build

start: npm start
port: 3000
domain: myapp.example.com

env:
  NODE_ENV: production
  API_KEY: your-secret-api-key
```

---

## 🛠️ Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Backend:** TypeScript, Hono, Baash
- **Frontend:** HTML5, CSS3, Vanilla JS (No build step required)

- **Services:** Systemd, Caddy (Reverse Proxy)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
