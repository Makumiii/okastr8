# Okastr8 Configuration File (`okastr8.yaml`)

The `okastr8.yaml` file tells Okastr8 how to build and run your application. Place it in the root of your repository.

## Quick Start

### For apps WITHOUT Docker files (auto-generated):
```yaml
start: "npm start"
port: 3000
```

### For apps WITH Dockerfile or docker-compose.yml:
```yaml
port: 3000
domain: myapp.example.com  # optional
```

## Configuration By Deploy Type

Okastr8 supports four deployment strategies. The required fields depend on whether you provide your own Docker files:

### Auto-Generated Deployments

When you don't have a Dockerfile or docker-compose.yml, Okastr8 generates them for you:

```yaml
# Required
start: "npm start"      # Command to start your app
port: 3000              # Port for health checks and routing

# Optional
runtime: "node:22"      # Runtime with version (auto-detected if omitted)
domain: "myapp.com"     # Custom domain for Caddy routing
build:                  # Build commands to run before starting
  - "npm ci"
  - "npm run build"
database: "postgres:15" # Triggers auto-compose with database
cache: "redis:7"        # Triggers auto-compose with cache
```

### User-Provided Dockerfile

When you have a `Dockerfile` in your repository:

```yaml
# Required
port: 3000              # Port exposed by your container (for health checks)

# Optional
domain: "myapp.com"     # Custom domain for Caddy routing

# Not needed (defined in your Dockerfile)
# start: ...            # Already in Dockerfile CMD
# build: ...            # Already in Dockerfile RUN
# runtime: ...          # Already in Dockerfile FROM
```

### User-Provided docker-compose.yml

When you have a `docker-compose.yml` in your repository:

```yaml
# Required
port: 3000              # Primary service port (for health checks)

# Optional
domain: "myapp.com"     # Custom domain for Caddy routing

# Not needed (defined in your docker-compose.yml)
# start: ...
# build: ...
# runtime: ...
# database: ...
# cache: ...
```

## Field Reference

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `start` | string | **When no Docker files** | Command to start your server. |
| `port` | number | **Always** | Port your app listens on. Required for health checks and Caddy routing. |
| `build` | string[] | No | Build commands (only for auto-generated Dockerfile). |
| `runtime` | string | No | Runtime with version (auto-detected if omitted). |
| `domain` | string | No | Custom domain for Caddy reverse proxy. |
| `database` | string | No | Managed database (triggers auto-compose). |
| `cache` | string | No | Managed cache (triggers auto-compose). |

## Environment Variables

Environment variables should **NOT** be stored in `okastr8.yaml` as this file is committed to your repository.

### Via Dashboard UI
Add environment variables through the deployment form when importing or deploying.

### Via CLI
```bash
# Set individual variables
okastr8 app env set myapp NODE_ENV=production API_KEY=secret

# Import from a local .env file
okastr8 app env import myapp --file .env.local

# During deployment
okastr8 deploy trigger myapp --env NODE_ENV=production --env API_KEY=secret
okastr8 deploy trigger myapp --env-file .env.production
```

Environment variables are stored securely in `/var/okastr8/apps/{appName}/.env.production` with restricted permissions (mode 0600).

## Managed Services

If you specify a `database` or `cache` (auto-compose only), Okastr8 automatically:

1. Generates a Docker Compose setup
2. Spins up the service container alongside your app
3. Injects the connection string into your app's environment

### Supported Databases

| Type | Config Value | Injected Env Var |
| :--- | :--- | :--- |
| **PostgreSQL** | `database: "postgres:15"` | `DATABASE_URL` |
| **MySQL** | `database: "mysql:8"` | `DATABASE_URL` |
| **MariaDB** | `database: "mariadb:10"` | `DATABASE_URL` |
| **MongoDB** | `database: "mongo:7"` | `MONGODB_URI` |

### Supported Caches

| Type | Config Value | Injected Env Var |
| :--- | :--- | :--- |
| **Redis** | `cache: "redis:7"` | `REDIS_URL` |

## Runtime Auto-Detection

If `runtime` is not specified, Okastr8 detects it based on files in your repository:

| File | Detected Runtime |
| :--- | :--- |
| `package.json` | `node` |
| `bun.lockb` | `bun` |
| `deno.json` / `deno.lock` | `deno` |
| `requirements.txt` / `pyproject.toml` | `python` |
| `go.mod` | `go` |

## Deployment Priority

Okastr8 selects the deployment strategy in this order:

1. **User docker-compose.yml** - Uses your compose file directly
2. **User Dockerfile** - Builds and runs your Dockerfile
3. **Auto-generated Compose** - When `database` or `cache` is specified
4. **Auto-generated Dockerfile** - Default for simple deployments

## Examples

### Node.js with Auto-Generated Docker

```yaml
runtime: "node:22"
port: 8080
start: "node dist/main.js"
domain: "api.myservice.com"

build:
  - "npm ci"
  - "npm run build"
```

### Full-Stack with Database (Auto-Compose)

```yaml
runtime: "node"
port: 3000
start: "npm start"
domain: "myapp.example.com"

build:
  - "npm ci"
  - "npm run build"

database: "postgres:15"
cache: "redis:7"
```

### With User Dockerfile

```yaml
port: 80
domain: "myapp.example.com"
```

### With User docker-compose.yml

```yaml
port: 3000
domain: "myapp.example.com"
```
