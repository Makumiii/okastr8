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
#   --git-repo <url>            Git repository URL
#   --git-branch <branch>       Git branch (default: main)

# Example:
okastr8 app create myapp "bun run start" -p 3000 --domain myapp.example.com
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
okastr8 app webhook <name> [on|off]

# Examples:
okastr8 app webhook myapp        # Show current status
okastr8 app webhook myapp on     # Enable auto-deploy
okastr8 app webhook myapp off    # Disable auto-deploy
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
#   -o, --output <path>   Output file path

# Example:
okastr8 app env export myapp -o backup.env
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
#   -b, --branch <branch>         Git branch to deploy
#   --build <steps>               Build steps (comma-separated)
#   --health-method <method>      Health check: http, process, port, command
#   --health-target <target>      Health check target
#   --health-timeout <seconds>    Timeout (default: 30)
#   --skip-health                 Skip health check

# Examples:
okastr8 deploy trigger myapp
okastr8 deploy trigger myapp -b develop
okastr8 deploy trigger myapp --skip-health
```

### Rollback
```bash
okastr8 deploy rollback <app> [options]

# Options:
#   -c, --commit <hash>   Specific commit to rollback to

# Examples:
okastr8 deploy rollback myapp
okastr8 deploy rollback myapp -c abc1234
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
#   -p, --page <n>   Page number
```

### Import repository
```bash
okastr8 github import <repo> [options]

# Options:
#   -b, --branch <branch>   Branch (default: main)
#   -p, --port <port>       App port

# Examples:
okastr8 github import owner/repo
okastr8 github import owner/repo -b develop -p 8080
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
#   --disable-password    Disable password auth
#   --disable-root        Disable root login
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
#   --allow <ports>   Comma-separated ports to allow
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
