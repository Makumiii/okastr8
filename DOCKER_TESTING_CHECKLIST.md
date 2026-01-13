# Docker Backend Testing Checklist

Use this checklist to verify the Docker deployment implementation is working correctly.

---

## Prerequisites

- [ ] Docker installed: `docker --version`
- [ ] Docker Compose installed: `docker-compose --version` or `docker compose version`
- [ ] Okastr8 CLI built: `bun run build` or `npm run build`
- [ ] A test GitHub repo with `okastr8.yaml` (can use any simple Node/Bun app)

---

## Test 1: Simple User Flow (Auto-generated Dockerfile)

**Scenario**: App has only `okastr8.yaml`, no Docker files.

```bash
# 1. Import app from GitHub
okastr8 github import <owner>/<repo>

# 2. Check app was created
okastr8 app list

# 3. Check app status
okastr8 app status <app-name>

# 4. Verify container is running
docker ps | grep okastr8-<app-name>
```

- [ ] App imports successfully
- [ ] Container is running
- [ ] Logs show: `Generated Dockerfile`

---

## Test 2: Pro User Flow (Custom Dockerfile)

**Scenario**: App has `okastr8.yaml` AND a custom `Dockerfile`.

```bash
# 1. Add Dockerfile to repo and push
# 2. Trigger deployment
okastr8 deploy trigger <app-name>

# 3. Check logs for "Using existing Dockerfile"
okastr8 app logs <app-name>
```

- [ ] Deployment succeeds
- [ ] Logs show: `Using existing Dockerfile`
- [ ] Container is healthy

---

## Test 3: Docker Compose Flow

**Scenario**: App has `okastr8.yaml` AND `docker-compose.yml`.

```bash
# 1. Add docker-compose.yml to repo and push
# 2. Trigger deployment
okastr8 deploy trigger <app-name>

# 3. Check all services are running
docker ps --filter "label=com.docker.compose.project=<app-name>"
```

- [ ] Deployment succeeds
- [ ] Multiple services running (if defined in compose)
- [ ] Logs show: `Docker strategy: user-compose`

---

## Test 4: Environment Variables

```bash
# 1. Set environment variable
okastr8 app env set <app-name> TEST_VAR=hello_world

# 2. Redeploy
okastr8 deploy trigger <app-name>

# 3. Verify in container
docker exec okastr8-<app-name> env | grep TEST_VAR
```

- [ ] Env var set successfully
- [ ] Env var visible inside container

---

## Test 5: App Lifecycle Commands

```bash
# Stop app
okastr8 app stop <app-name>
docker ps -a | grep okastr8-<app-name>  # Should show "Exited"

# Start app
okastr8 app start <app-name>
docker ps | grep okastr8-<app-name>  # Should show "Up"

# Restart app
okastr8 app restart <app-name>

# View logs
okastr8 app logs <app-name>
```

- [ ] Stop works
- [ ] Start works
- [ ] Restart works
- [ ] Logs display correctly

---

## Test 6: App Deletion

```bash
# Delete app
okastr8 app delete <app-name>

# Verify cleanup
docker ps -a | grep <app-name>  # Should return nothing
ls ~/.okastr8/apps/<app-name>   # Should not exist
```

- [ ] App deleted successfully
- [ ] Docker containers removed
- [ ] App directory removed

---

## Test 7: Strategy Switching

**Scenario**: Switch from Dockerfile to docker-compose.yml

```bash
# 1. Deploy with Dockerfile first (Test 2)
# 2. Add docker-compose.yml to repo, remove Dockerfile
# 3. Redeploy
okastr8 deploy trigger <app-name>

# 4. Verify old container gone, new compose services running
docker ps -a | grep okastr8-<app-name>  # Single container should be gone
docker ps --filter "label=com.docker.compose.project=<app-name>"
```

- [ ] Old container cleaned up
- [ ] New compose services running

---

## Troubleshooting Commands

```bash
# View all okastr8 containers
docker ps -a --filter name=okastr8-

# View okastr8 images
docker images 'okastr8-*'

# Check Docker daemon
docker info

# Manual cleanup
docker system prune -f
```

---

## Notes

_Use this section to record any issues or observations during testing._

- 

