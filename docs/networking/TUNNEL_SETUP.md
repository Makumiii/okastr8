# Setting up Tunnels & Webhooks

Okastr8 natively supports **Cloudflare Tunnel** to expose your local instance to the public internet securely. This enables:

1.  **Global Dashboard Access**: Manage your apps from anywhere.
2.  **Automated Webhooks**: Receive push events from GitHub to trigger deployments.

---

## Prerequisites

1.  A **Cloudflare Account** (Free).
2.  A domain name managed by Cloudflare (or a subdomain).

---

## Step 1: Create a Tunnel Token

1.  Go to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2.  Navigate to **Networks > Tunnels**.
3.  Click **Create a Tunnel**.
4.  Choose **Cloudflared** as the connector.
5.  Name your tunnel (e.g., `okastr8-home`).
6.  **Copy the Token**: You will see a command like `cloudflared service install <token>`. You only need the **token** string (the long string of characters starting with `ey...`).

---

## Step 2: Configure the Public Hostname

In the Cloudflare Dashboard (same tunnel creation flow):

1.  Click **Next** to go to the "Public Hostnames" tab.
2.  Add a public hostname (e.g., `okastr8.yourdomain.com`).
3.  **Service**:
    - **Type**: `HTTP`
    - **URL**: `localhost:41788` (Default Okastr8 Port)

> **Note**: This tells Cloudflare to forward traffic from `okastr8.yourdomain.com` to your local Okastr8 instance.

---

## Step 3: Setup Tunnel on Okastr8

Run the following command on your server/machine:

```bash
okastr8 tunnel setup <your-token>
```

This will:

- Install `cloudflared`.
- Register the service.
- Start the tunnel.

Verify it's running:

```bash
okastr8 tunnel status
```

---

## Step 4: Update Configuration (Critical Manual Step)

⚠️ **Important**: Okastr8 needs to know your public URL to register webhooks correctly. This is currently a manual step.

1.  Open your system configuration file:

    ```bash
    nano ~/.okastr8/system.yaml
    ```

2.  Add or update the `tunnel` section to include your `url`:

    ```yaml
    tunnel:
        enabled: true
        auth_token: "ey..."
        url: "https://okastr8.yourdomain.com" # <--- CORE: Add this line!
    ```

    _Replace `https://okastr8.yourdomain.com` with the hostname you configured in Step 2._

---

## Step 5: Setup Webhooks

Now that your tunnel is running and Okastr8 knows your public URL, you can connect your repositories.

1.  **Connect GitHub** (if not already done):

    ```bash
    okastr8 github connect
    ```

2.  **Import a Repo**:

    ```bash
    okastr8 github import <owner>/<repo> --branch main
    ```

    - Or, if you already imported an app, toggle the webhook:

    ```bash
    okastr8 app webhook <app-name> on
    ```

Okastr8 will now automatically register a webhook on GitHub pointing to:
`https://okastr8.yourdomain.com/api/github/webhook`

---

## Troubleshooting

- **Tunnel Status**: `okastr8 tunnel status`
- **Logs**: `journalctl -u cloudflared -f`
- **Webhook Failures**: Check `okastr8 app logs <name>` to see if the deployment triggered.

---

## App-Specific Cloudflare Tunnels (Bypassing the Caddy Proxy)

Okastr8 natively supports exposing individual applications securely to the internet through isolated Cloudflare Tunnels. This bypasses the default Caddy reverse proxy on your server, offering enhanced security and direct edge routing.

### 1. Generate an App Tunnel Token
Follow the same steps as above (Step 1) to create a new Tunnel in the Cloudflare Zero Trust Dashboard specifically for your app (e.g., `okastr8-my-app-tunnel`). 
1. Copy the **Token** string (`ey...`).
2. Go to the **Public Hostnames** tab, and configure your hostname (e.g. `api.yourdomain.com`).
3. Set the **Service** to:
   - **Type**: `HTTP`
   - **URL**: `localhost:<YOUR_APP_PORT>` (Replace `<YOUR_APP_PORT>` with the port defined in your `okastr8.yaml` or `-p` flag).

### 2. Configure the App Environment
For security reasons, Cloudflare Tokens are **never** committed to `okastr8.yaml`. You must inject the token into your app's environment variables. 
Set the environment variable `TUNNEL_TOKEN` with your token:
```bash
# via CLI
okastr8 app env set myapp TUNNEL_TOKEN="ey..."

# or pass it during deployment
okastr8 deploy trigger myapp --env TUNNEL_TOKEN="ey..."
```

*(You can also set this via the Environment Variables tab in the Okastr8 Dashboard before deploying).*

### 3. Deploy with Tunnel Routing Enabled
Now, instruct Okastr8 to spin up a Cloudflare sidecar for your app.

**For Git Deployments:**
Add `tunnel_routing: true` to your `okastr8.yaml` file:
```yaml
port: 3000
tunnel_routing: true
```

**For Image Deployments:**
Pass the `--tunnel-routing` flag:
```bash
okastr8 app create-image myapp nginx:latest -p 80 --tunnel-routing
```

*(You can also toggle this via the "Use Cloudflare Tunnel routing" checkbox in the Dashboard UI).*

Okastr8 will now deploy a dedicated `cloudflared` agent alongside your application linked specifically to your provided token!
