# Okastr8 CLI Reference

Complete command reference with usage examples.

---

## Global Options

```bash
okastr8 --version    # Show version
okastr8 --help       # Show all commands
```

---

## App Management (`okastr8 app`)

### List all apps

```bash
okastr8 app list
```

### Create an app

```bash
okastr8 app create <name> <exec_start> [options]

# Options:
#   -d, --description <desc>    Service description
#   -u, --user <user>           User to run as
#   -w, --working-dir <dir>     Working directory
#   -p, --port <port>           Application port
#   --domain <domain>           Domain for reverse proxy
#   --tunnel-routing            Use Cloudflare Tunnel instead of Caddy routing
#   --git-repo <url>            Git repository URL
#   --git-branch <branch>       Git branch (default: main)
#   --database <type:version>   Database service (e.g., 'postgres:15')
#   --cache <type:version>      Cache service (e.g., 'redis:7')
#   --env <vars...>             Environment variables (KEY=VALUE)
#   --env-file <path>           Path to .env file

# Example:
okastr8 app create myapp "bun run start" -p 3000 --domain myapp.example.com
```

### Create from Image

```bash
okastr8 app create-image <name> <image_ref> [options]

# Options:
#   -p, --port <port>             Container port (e.g. 80)
#   --container-port <port>       Container internal port (default: same as --port)
#   --domain <domain>             Domain for reverse proxy
#   --tunnel-routing              Use Cloudflare Tunnel instead of Caddy for routing
#   --database <type:version>     Managed database (e.g., 'postgres:15')
#   --cache <type:version>        Managed cache (e.g., 'redis:7')
#   --env <vars...>               Environment variables (KEY=VALUE)
#   --env-file <path>             Path to .env file
#   --pull-policy <policy>        Image pull policy (always, if-not-present)
#   --registry-credential <id>    Credential ID for private registries
#   --registry-server <server>    Registry server override (e.g., ghcr.io)
#   --registry-provider <type>    Provider: ghcr|dockerhub|ecr|generic
#   --release-retention <count>   Number of image releases to keep

# Example:
okastr8 app create-image myapp nginx:latest -p 80 --domain myapp.example.com --database postgres:15
```

### Delete an app

```bash
okastr8 app delete <name>

# Example:
okastr8 app delete myapp
```

### App status

```bash
okastr8 app status <name>

# Example:
okastr8 app status myapp
```

### App logs

```bash
okastr8 app logs <name> [options]

# Options:
#   -n, --lines <n>   Number of lines (default: 50)

# Example:
okastr8 app logs myapp -n 100
```

### Start/Stop/Restart

```bash
okastr8 app start <name>
okastr8 app stop <name>
okastr8 app restart <name>
```

### Webhook toggle

```bash
okastr8 app webhook <name> [state]

# Examples:
okastr8 app webhook myapp        # Show current status
okastr8 app webhook myapp on     # Enable auto-deploy
okastr8 app webhook myapp off    # Disable auto-deploy
okastr8 app webhook myapp --branch main
```

---

## Environment Variables (`okastr8 app env`)

### Set variables

```bash
okastr8 app env set <appName> <key=value...>

# Example:
okastr8 app env set myapp DATABASE_URL=postgres://... API_KEY=secret123
```

### List variables

```bash
okastr8 app env list <appName>
```

### Import from .env file

```bash
okastr8 app env import <appName> [options]

# Options:
#   -f, --file <path>   Path to .env file (default: .env)

# Example:
okastr8 app env import myapp -f .env.production
```

### Export to file

```bash
okastr8 app env export <appName> [options]

# Options:
#   -f, --file <path>   Output file path

# Example:
okastr8 app env export myapp -f backup.env
```

### Unset variable

```bash
okastr8 app env unset <appName> <key>

# Example:
okastr8 app env unset myapp OLD_VAR
```

---

## Deployment (`okastr8 deploy`)

### Trigger deployment

```bash
okastr8 deploy trigger <app> [options]

# Options:
#   --env <vars...>                     Environment variables (KEY=VALUE)
#   --env-file <path>                   Path to .env file
#   --push-image                        Push image to registry after successful deployment
#   --push-image-ref <ref>              Target image ref (e.g., ghcr.io/org/app:tag)
#   --push-registry-credential <id>     Registry credential id

# Examples:
okastr8 deploy trigger myapp
okastr8 deploy trigger myapp --env NODE_ENV=production
okastr8 deploy trigger myapp --env-file .env.prod
okastr8 deploy trigger myapp --push-image --push-image-ref ghcr.io/acme/myapp:latest --push-registry-credential ghcr-main
```

### Rollback

```bash
okastr8 deploy rollback <app> [options]

# Options:
#   -c, --commit <hash>   Specific commit hash prefix or git version id
#   -t, --target <target> Image rollback target (release id, image ref, or digest)

# Examples:
okastr8 deploy rollback myapp
okastr8 deploy rollback myapp -c abc1234
okastr8 deploy rollback myapp -t sha256:abc123...
```

### View history

```bash
okastr8 deploy history <app>
```

### Health check

```bash
okastr8 deploy health <method> <target> [options]

# Options:
#   -t, --timeout <seconds>   Timeout (default: 30)

# Methods: http, process, port, command

# Examples:
okastr8 deploy health http http://localhost:3000/health
okastr8 deploy health port 3000
```

---

## GitHub Integration (`okastr8 github`)

### Check connection

```bash
okastr8 github status
```

### Connect via OAuth

```bash
okastr8 github connect
```

### Browse repositories

```bash
okastr8 github repos [options]

# Options:
#   --plain          Plain list output (no interactive mode)
```

### Import repository

```bash
okastr8 github import <repo> [options]

# Options:
#   -b, --branch <branch>   Branch (default: main)
#   --env <vars...>         Environment variables (KEY=VALUE)
#   --env-file <path>       Path to .env file
#   --no-interactive        Disable guided wizard prompts

# Examples:
okastr8 github import owner/repo
okastr8 github import owner/repo -b develop
okastr8 github import owner/repo --env NODE_ENV=production
```

### Setup SSH deploy key

```bash
okastr8 github setup-key
```

### Disconnect

```bash
okastr8 github disconnect
```

---

## Server Setup (`okastr8 setup`)

### Full setup

```bash
okastr8 setup full
```

### SSH hardening

```bash
okastr8 setup ssh-harden [options]

# Options:
#   -p, --port <port>    Optionally change SSH port
```

### Change SSH port

```bash
okastr8 setup ssh-port <port>

# Example:
okastr8 setup ssh-port 2222
```

### Configure firewall

```bash
okastr8 setup firewall [options]

# Options:
#   -p, --ssh-port <port>   SSH port to allow (default: 2222)
```

### Setup fail2ban

```bash
okastr8 setup fail2ban
```

### Fix sudo permissions

```bash
okastr8 setup sudoers
```

---

## Tunnel Management (`okastr8 tunnel`)

Securely expose your instance to the internet for remote dashboard access and GitHub webhooks using Cloudflare Tunnel.

See [TUNNEL_SETUP.md](../networking/TUNNEL_SETUP.md) for a complete setup guide.

### Setup Tunnel

```bash
okastr8 tunnel setup <token>

# Example:
okastr8 tunnel setup eyJhIjoi...
```

### Check Status

```bash
okastr8 tunnel status
```

### Uninstall Tunnel

```bash
okastr8 tunnel uninstall
```

---

## Metrics (`okastr8 metrics`)

```bash
okastr8 metrics           # Live htop-style view
okastr8 metrics --once    # Single snapshot, then exit
```

---

## System Commands

### Global service controls

```bash
okastr8 service start-all     # Start all apps
okastr8 service stop-all      # Stop all apps
okastr8 service restart-all   # Restart all apps
```

### System level

```bash
okastr8 system nuke        # ⚠️ DESTROY all apps and data
okastr8 system uninstall   # Nuke + show uninstall instructions
```

---

## Systemd (Low-level)

For direct systemd service management:

```bash
okastr8 systemd list
okastr8 systemd status <service>
okastr8 systemd start <service>
okastr8 systemd stop <service>
okastr8 systemd restart <service>
okastr8 systemd logs <service>
okastr8 systemd enable <service>
okastr8 systemd disable <service>
okastr8 systemd reload
```
