# Okastr8 Configuration File (`okastr8.yaml`)

The `okastr8.yaml` file tells the system how to build and run your application. Place it in the root of your project.

## Basic Example

```yaml
# The command to start your application
start: "npm start"

# The port your application listens on
port: 3000

# Optional: Build commands to run before starting
build:
  - "npm install"
  - "npm run build"
```

## Deployment Configuration Reference

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `start` | string | **Yes** | The command to start your server (e.g., `node dist/server.js`, `python app.py`). |
| `port` | number | **Yes** | The internal port your app listens on. Defaults to `3000` if omitted. |
| `build` | string[] | No | List of shell commands to run during the build phase (e.g., install dependencies, compile assets). |
| `runtime` | string | No | Explicitly set the runtime (e.g., `node`, `python`, `docker`). If omitted, Okastr8 auto-detects it. |
| `domain` | string | No | Custom domain to bind to this app (e.g., `api.myapp.com`). |
| `database` | string | No | Request a managed database (e.g., `postgres:15`, `mysql:8`, `mongodb:7`). |
| `cache` | string | No | Request a managed cache instance (e.g., `redis:7`). |

## Managed Services (Database & Cache)

If you specify a `database` or `cache`, Okastr8 automatically:
1.  Creates a Docker Compose setup for your app.
2.  Spins up the requested service container.
3.  Injects the connection string into your app's environment variables.

### Supported Databases

| Type | Example | Injected Env Var |
| :--- | :--- | :--- |
| **PostgreSQL** | `database: postgres:15` | `DATABASE_URL` |
| **MySQL** | `database: mysql:8` | `DATABASE_URL` |
| **MariaDB** | `database: mariadb:10` | `DATABASE_URL` |
| **MongoDB** | `database: mongo:7` | `MONGODB_URI` |

### Supported Caches

| Type | Example | Injected Env Var |
| :--- | :--- | :--- |
| **Redis** | `cache: redis:7` | `REDIS_URL` |


## Advanced Example

```yaml
# For a Node.js App
start: "node dist/main.js"
port: 8080
runtime: "node"
domain: "api.myservice.com"

build:
  - "npm ci"
  - "npx prisma generate"
  - "npm run build"

environment:
  NODE_ENV: "production"
```

## Docker Deployments

If you have a `Dockerfile` in your repository, Okastr8 handles it automatically. `okastr8.yaml` is optional in this case, but can still be used to override defaults like the port.

```yaml
# If you use Docker, just specify the port exposed by your container
port: 80
```
