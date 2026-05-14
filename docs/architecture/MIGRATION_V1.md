# Migration to Okastr8 Zero-Config (v1.0)

Okastr8 has fundamentally shifted how authentication and GitHub integration works. We have removed the burden of creating your own GitHub OAuth Applications and managing SSH keys.

This migration guide is for users updating from any version before `v1.0.0`.

## What Changed?

1. **Central Broker:** We now host a central Convex broker (`okastr8.com`). This handles the OAuth dance and webhook routing. 
2. **Device Code Auth:** The `okastr8 github connect` command is gone. You now run `okastr8 login`, which uses a Smart-TV style device code.
3. **HTTPS Clones:** We no longer generate or upload SSH keys. The Central Broker generates secure, short-lived (1-hour) HTTPS installation tokens for cloning your repositories.
4. **Dashboard as an App:** The dashboard is no longer a hidden port-forwarded service. It is now a public-facing application you deploy behind your own domain (e.g., `dash.my-domain.com`).

## Migration Steps

### Step 1: Remove Old GitHub Integrations

1. Go to **GitHub > Settings > Developer Settings > OAuth Apps**.
2. Find the OAuth app you created for Okastr8 and **delete it**.
3. Go to your GitHub repositories that Okastr8 deployed.
4. Go to **Settings > Webhooks** and remove the webhook pointing to your Okastr8 tunnel.
5. Go to **Settings > Deploy Keys** and remove the `Okastr8 Deploy Key`.

### Step 2: Update Your System

Run the update command to pull the latest manager and CLI:

```bash
okastr8 system update
```

### Step 3: Login via the Broker

Run the new login command. This will generate a code and give you a URL. 

```bash
okastr8 login
```

Open the URL on your local computer, enter the code, and click "Continue with GitHub".

### Step 4: Deploy Your Dashboard

Now that your server is authenticated, you can deploy your dashboard publicly so you can access it anywhere:

```bash
okastr8 dashboard deploy dash.your-domain.com
```

### Step 5: Install the Okastr8 GitHub App

Go to your new dashboard URL. When you try to deploy a new application, you will be prompted to install the **Okastr8 GitHub App**.

Click the link, select the repositories you want to allow Okastr8 to deploy, and you are done. Auto-deploys and webhooks will instantly start working via our real-time broker!

---

**That's it! You are now running on the Zero-Config architecture.**
