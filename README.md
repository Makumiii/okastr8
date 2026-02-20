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
- **🐳 Containerized Deployments**: All applications are deployed as isolated Docker containers for consistency and security.
- **🔒 Secure Access**: GitHub OAuth login and SSH hardening.
- **📊 Real-time Metrics**: Monitor CPU, RAM, and Disk usage per app and system-wide.

---

## 📦 Installation (For Users)

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

## 🌍 Remote Access & Tunnel Setup (Required for Webhooks)

To access your dashboard remotely and enable GitHub auto-deployments (webhooks), your server needs a public URL. Okastr8 makes this easy with **Cloudflare Tunnel**.

👉 **[Read the Full Tunnel Setup Guide](./TUNNEL_SETUP.md)**

**Quick Summary:**

1.  **Get a Token**: Create a text tunnel in the Cloudflare Dashboard and copy the token.
2.  **Setup Tunnel**: Run `okastr8 tunnel setup <your-token-here>`.
3.  **Note your URL**: e.g., `https://okastr8.yourdomain.com`.

---

## ⚙️ Manual Configuration

Before connecting GitHub or expecting webhooks to work, you must manually configure a few secrets in `~/.okastr8/system.yaml`.

Run:

```bash
nano ~/.okastr8/system.yaml
```

Ensure it looks like this (fill in your real values):

```yaml
manager:
    github:
        # Get these from GitHub -> Settings -> Developer Settings -> OAuth Apps
        client_id: "YOUR_GITHUB_CLIENT_ID"
        client_secret: "YOUR_GITHUB_CLIENT_SECRET"

tunnel:
    # The URL you configured in Cloudflare (must start with https://)
    url: "https://okastr8.yourdomain.com"
```

> **Why is this manual?** For security and simplicity, we don't ask for these sensitive values during the auto-install. You have full control.

---

## 🔗 GitHub Integration Setup

Once your Tunnel is up and `system.yaml` is configured:

### Step 1: Create GitHub OAuth App

1.  **Homepage URL**: Use your tunnel URL (e.g., `https://okastr8.yourdomain.com`).
2.  **Callback URL**: Append `/api/github/callback` (e.g., `https://okastr8.yourdomain.com/api/github/callback`).

### Step 2: Connect

Run the connection command on your server:

```bash
okastr8 github connect
```

This will generate a link to authenticate. Since you are on a headless server, open the link in your local browser. Once approved, the server automatically receives the token and binds the GitHub account as the dashboard admin.

### Step 3: Webhooks

With the tunnel URL configured in `system.yaml`, Okastr8 automatically registers the correct webhook URL (`https://.../api/github/webhook`) when you import repositories.

---

## 🛠️ Usage

### 1. Authenticate

Sign in to the dashboard with GitHub OAuth (admin account bound during `okastr8 github connect`).

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

### 4. Configuring Your App (okastr8.yaml)

To tell Okastr8 how to build and run your app (if not using Docker), add an `okastr8.yaml` file to your repository root:

```yaml
start: "npm start"
port: 3000
build:
    - "npm install"
    - "npm run build"
```

👉 **[See the Full Configuration Guide](./OKASTR8_YAML.md)** for all available options.

---

## 👨‍💻 Developer & Contribution Guide

We welcome contributions! Okastr8 is built with **TypeScript**, **Bun**, **Hono**, and **SvelteKit**.

**Note for Contributors**: Do not run the `install.sh` script on your development machine if you intend to modify the code. That script is for end-users and installs to a specific system path. Instead, follow the manual setup steps below.

### 1. Prerequisite

- [Bun Runtime](https://bun.sh) (latest)
- Git

### 2. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/Makumiii/okastr8.git
cd okastr8

# Install backend/CLI dependencies
bun install

# Install dashboard (frontend) dependencies
cd dashboard
npm install
cd ..
```

### 3. Setup Config & Permissions

Okastr8 relies on running certain system commands (like systemd, docker, or caddy) without password prompts. We include a helper to configure this for you safely (it creates a file in `/etc/sudoers.d/`).

```bash
# Run the sudoers setup (required for fully functional CLI testing)
sudo bun run src/main.ts setup sudoers
```

_You only need to run this once._

### 4. Build the Dashboard

The manager server serves the static UI files from the `public/` directory. You must build the dashboard first:

```bash
cd dashboard
npm run build
cd ..
# Check that 'public/' folder now exists
ls -d public
```

### 5. Running Locally

You can now run the services directly from your source code.

**Start the Manager Server (API + UI):**

```bash
bun run src/managerServer.ts
```

The server will start at `http://localhost:41788`.

**Run CLI Commands:**
Use `bun run src/main.ts` to execute CLI commands against your local code:

```bash
bun run src/main.ts --help
bun run src/main.ts app list
bun run src/main.ts deploy trigger my-test-app
```

### 6. Development Workflow

- **Frontend Changes**: Edit files in `dashboard/src`. Run `npm run build` in `dashboard/` to update the static output, or run `npm run dev` in `dashboard/` for a separate HMR dev server (note: api calls might need proxy configuration if running separately).
- **Backend/CLI Changes**: Edit files in `src/`. Bun runs TypeScript natively, so no build step is needed for testing backend logic.

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
