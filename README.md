# Okastr8

![Okastr8 Logo](assets/logo-light.jpg)

**The Open-Source PaaS for Your Own Servers**

Okastr8 (pronounced "orchestrate") is a self-hosted Platform-as-a-Service that brings the simplicity of Vercel or Railway to your own Linux servers. It provides a beautiful dashboard and a powerful CLI to manage deployments, monitor resources, and handle system configurations without the vendor lock-in.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-orange.svg)
![Status: Beta](https://img.shields.io/badge/Status-Beta-yellow.svg)

---

## 🚀 Features

- **🖥️ Beautiful Dashboard**: Modern, responsive UI to manage apps and users.
- **⚡ Powerful CLI**: Automate everything from deployments to server hardening.
- **🔄 Git-based Deploys**: Connect GitHub repositories, setup webhooks, and auto-deploy on push.
- **🐳 Docker Support**: Native support for Dockerfile-based deployments.
- **🔒 Zero-Trust Security**: Token-based authentication, role-based access, and SSH hardening.
- **📊 Real-time Metrics**: Monitor CPU, RAM, and Disk usage per app and system-wide.
- **🤖 Systemd Integration**: Manages applications as robust systemd services.

---

## 📦 Installation

### Requirements
- A fresh or existing Linux server (Debian/Ubuntu recommended).
- Root or sudo access.

### Quick Install
Run the following command to install Okastr8. This script will install the Bun runtime, set up the necessary services, and configure your environment.

```bash
curl -fsSL https://raw.githubusercontent.com/Makumiii/okastr8/main/scripts/bash/install.sh | bash
```

**What this does:**
1.  Installs **Bun** (if not already present).
2.  Clones the repository to `~/okastr8`.
3.  Installs dependencies.
4.  Creates the `okastr8-manager` systemd service (runs the dashboard/API).
5.  Sets up the `okastr8` global CLI command.

### Post-Install Setup
After installation, you can verify everything is running:

```bash
# Check CLI version
okastr8 --version

# Check manager server status
systemctl status okastr8-manager
```

Access your dashboard at: `http://<your-server-ip>:41788`

---

## 🛠️ Usage

### 1. Authenticate
To access the dashboard, you need a login token. Generate one via the CLI:

```bash
okastr8 auth token
# Output: Copy the token and paste it into the dashboard login screen.
```

### 2. Connect GitHub
Enable seamless deployments by connecting your GitHub account:

```bash
okastr8 github connect
```
Follow the OAuth flow to grant access to your repositories.

### 3. Deploy an App
You can deploy apps directly from your GitHub repositories via the Dashboard or CLI.

**Via CLI:**
```bash
# Interactive repo selection
okastr8 github repos

# Or trigger a deployment if already configured
okastr8 deploy trigger my-awesome-app
```

**Via Dashboard:**
1.  Go to **Apps**.
2.  Click **Import from GitHub**.
3.  Select your repository and configure the port/domain.
4.  Click **Deploy**.

---

## 👨‍💻 Developer & Contribution Guide

We welcome contributions! Okastr8 is built with **TypeScript**, **Bun**, **Hono**, and **SvelteKit**.

### Prerequisite
- [Bun Runtime](https://bun.sh) (latest)

### 1. Clone & Setup
```bash
git clone https://github.com/Makumiii/okastr8.git
cd okastr8
bun install
```

### 2. Build the Dashboard (UI)
The dashboard is a SvelteKit app located in `dashboard/`. It builds to the `public/` directory at the root, which the manager server serves.

```bash
cd dashboard
npm install
npm run build  # Builds to ../public
cd ..
```

### 3. Start Development Server
Run the manager server locally. This serves the API and the static UI from `public/`.

```bash
# Run the manager (API + Static UI)
bun run src/managerServer.ts
```

The server will start at `http://localhost:41788`.

### 4. Running the CLI Locally
To test CLI commands during development:

```bash
# Run commands using bun directly
bun run src/main.ts app list
bun run src/main.ts deploy history my-app
```

---

## 📂 Project Structure

- `src/` - Backend API and CLI logic (Hono, Commander).
    - `commands/` - CLI command implementations.
    - `managerServer.ts` - Main entry point for the API server.
    - `main.ts` - Entry point for the CLI.
- `dashboard/` - SvelteKit frontend application.
- `scripts/` - Installation and system setup scripts.
- `public/` - Compiled frontend assets (gitignored).

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

**Built with ❤️ for the Open Source Community**
