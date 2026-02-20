import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import {
    createUser,
    deleteUser,
    getLastLogin,
    listGroups,
    listUsers,
    lockUser,
    unlockUser,
} from "./commands/user";
import {
    createService,
    deleteService,
    startService,
    stopService,
    restartService,
    statusService,
    logsService,
    enableService,
    disableService,
    reloadDaemon,
    listServices,
} from "./commands/systemd";
import { orchestrateEnvironment } from "./commands/orchestrate";
import {
    runFullSetup,
    hardenSsh,
    changeSshPort,
    configureFirewall,
    configureFail2ban,
} from "./commands/setup";
import { validateToken, isUserAdmin } from "./commands/auth";
import { writeUnifiedEntry } from "./utils/structured-logger";

const api = new Hono();

// Helper for consistent API responses
const apiResponse = (success: boolean, message: string, data?: any) => ({
    success,
    message,
    data,
});

// ============ Request Logging ============
api.use("*", async (c, next) => {
    const start = Date.now();
    try {
        await next();
        const durationMs = Date.now() - start;
        const status = c.res?.status ?? 200;
        const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        void writeUnifiedEntry({
            timestamp: new Date().toISOString(),
            level,
            source: "api",
            service: "okastr8-api",
            message: `${c.req.method} ${c.req.path}`,
            action: "request",
            request: {
                method: c.req.method,
                path: c.req.path,
                status,
                durationMs,
                ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || undefined,
                userAgent: c.req.header("user-agent") || undefined,
            },
        });
    } catch (error: any) {
        const durationMs = Date.now() - start;
        void writeUnifiedEntry({
            timestamp: new Date().toISOString(),
            level: "error",
            source: "api",
            service: "okastr8-api",
            message: `${c.req.method} ${c.req.path} failed`,
            action: "request-error",
            request: {
                method: c.req.method,
                path: c.req.path,
                status: 500,
                durationMs,
                ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || undefined,
                userAgent: c.req.header("user-agent") || undefined,
            },
            error:
                error instanceof Error
                    ? { name: error.name, message: error.message, stack: error.stack }
                    : { message: String(error) },
        });
        throw error;
    }
});

// ============ Global Auth Middleware ============
// Automatically enforces authentication and permissions on all routes

// Routes that don't require authentication
const PUBLIC_ROUTES = [
    "POST:/auth/logout",
    "GET:/auth/me",
    "GET:/auth/github",
    "POST:/github/webhook", // Webhook has its own HMAC verification
    "GET:/github/callback", // OAuth callback - no auth yet!
];

api.use("*", async (c, next) => {
    const method = c.req.method;
    const path = c.req.path.replace("/api", ""); // Remove /api prefix
    const routeKey = `${method}:${path}`;

    // Skip auth for public routes
    if (PUBLIC_ROUTES.some((r) => routeKey === r) || path === "/github/webhook") {
        return next();
    }

    // Extract token from cookie or header
    let token: string | null = null;
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
    } else {
        const cookie = c.req.header("Cookie");
        if (cookie) {
            const match = cookie.match(/okastr8_session=([^;]+)/);
            if (match && match[1]) {
                token = match[1];
            }
        }
    }

    // Require authentication
    if (!token) {
        return c.json(apiResponse(false, "Authentication required"), 401);
    }

    // Validate token
    const result = await validateToken(token);
    if (!result.valid) {
        return c.json(apiResponse(false, result.error || "Invalid token"), 401);
    }

    // Store user info in context (no permission checks - all authenticated users have full access)
    c.set("userId", result.userId!);

    return next();
});

async function enforceAdmin(c: any) {
    const userId = c.get("userId");
    if (!userId) {
        return c.json(apiResponse(false, "Authentication required"), 401);
    }
    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
        return c.json(apiResponse(false, "Admin access required"), 403);
    }
    return null;
}

// ============ System Status Endpoints ============

api.get("/system/status", async (c) => {
    try {
        const { getSystemConfig } = await import("./config");
        const { getRecentLogs, getLogCounts, getHealthStatus } = await import("./utils/logger");
        const { runCommand } = await import("./utils/command");
        const os = await import("os");

        // Get system uptime
        const uptimeSeconds = os.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;

        // Get current user (prefer SUDO_USER to show actual admin, not root)
        const user = process.env.SUDO_USER || process.env.USER || "unknown";

        // Get environments
        const systemConfig = await getSystemConfig();
        const environments = systemConfig.environments ?? {};

        // Get okastr8 manager service status (still uses systemd for manager itself)
        const services = [];
        const serviceNames = ["okastr8-manager"];
        for (const name of serviceNames) {
            const result = await runCommand("systemctl", ["is-active", name]);
            services.push({
                name,
                status: result.stdout.trim() || "unknown",
                running: result.exitCode === 0,
            });
        }

        // Get deployed apps
        const { listApps } = await import("./commands/app");
        let apps: any[] = [];
        try {
            const result = await listApps();
            apps = result.success && Array.isArray(result.apps) ? result.apps : [];
        } catch {}

        // Check Docker container statuses for apps
        const { containerStatus, getProjectContainers } = await import("./commands/docker");
        for (const app of apps) {
            if (app && app.name) {
                // First try direct container name (for auto-dockerfile strategy)
                let status = await containerStatus(app.name);

                // If not found, try compose project containers (for user-compose / auto-compose)
                if (!status.running && status.status === "not found") {
                    const projectContainers = await getProjectContainers(app.name);
                    if (projectContainers.length > 0) {
                        // Check if any container in the project is running
                        const anyRunning = projectContainers.some((c) => c.status === "running");
                        status = {
                            running: anyRunning,
                            status: anyRunning
                                ? "running"
                                : projectContainers[0]?.status || "unknown",
                        };
                    }
                }

                services.push({
                    name: app.name,
                    status: status.status,
                    running: status.running,
                    isApp: true,
                });
            }
        }

        // Get log health
        const { getActivityStats } = await import("./utils/activity");
        const activityStats = await getActivityStats();
        const logCounts = getLogCounts();
        const health = getHealthStatus();

        return c.json(
            apiResponse(true, "System status", {
                user,
                uptime,
                serverTime: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                locale: Intl.DateTimeFormat().resolvedOptions().locale,
                hostname: os.hostname(),
                platform: os.platform(),
                environments,
                services,
                health: {
                    status: health,
                    counts: logCounts,
                },
                activityStats,
            })
        );
    } catch (error: any) {
        console.error("API /system/status error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

api.get("/logs/recent", async (c) => {
    try {
        const { getRecentLogs } = await import("./utils/logger");
        const count = parseInt(c.req.query("count") || "10");
        const logs = getRecentLogs(count);
        return c.json(apiResponse(true, "Recent logs", { logs }));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.get("/system/metrics", async (c) => {
    try {
        const { collectMetrics } = await import("./commands/metrics");
        const metrics = await collectMetrics();
        return c.json(apiResponse(true, "System metrics", metrics));
    } catch (error: any) {
        console.error("API /system/metrics error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

// Activity Routes
api.get("/activity/list", async (c) => {
    try {
        const { getRecentActivity } = await import("./utils/activity");
        const type = c.req.query("type") as any;
        const date = c.req.query("date");
        const limit = parseInt(c.req.query("limit") || "50");
        const activities = await getRecentActivity(limit, type, date);
        return c.json(apiResponse(true, "Activity log", activities));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.get("/activity/stats", async (c) => {
    try {
        const { getActivityStats } = await import("./utils/activity");
        const stats = await getActivityStats();
        return c.json(apiResponse(true, "Activity stats", stats));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.get("/activity/log/:id", async (c) => {
    try {
        const id = c.req.param("id");
        const { getDeploymentLog } = await import("./utils/activity");
        const content = await getDeploymentLog(id);
        if (!content) {
            return c.json(apiResponse(false, "Log not found"), 404);
        }
        return c.json(apiResponse(true, "Deployment log", { log: content }));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

// Unified logs query
api.get("/logs/query", async (c) => {
    try {
        const { readUnifiedEntries } = await import("./utils/structured-logger");
        const levels = (c.req.query("level") || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        const sources = (c.req.query("source") || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        const search = (c.req.query("q") || "").toLowerCase();
        const limit = parseInt(c.req.query("limit") || "200");
        const offset = parseInt(c.req.query("offset") || "0");
        const date = c.req.query("date");
        const from = c.req.query("from") || "00:00";
        const to = c.req.query("to") || "23:59";
        const traceId = c.req.query("traceId");

        let startTime: number | null = null;
        let endTime: number | null = null;
        if (date) {
            const start = new Date(`${date}T${from}`);
            const end = new Date(`${date}T${to}`);
            startTime = start.getTime();
            endTime = end.getTime();
            if (!Number.isFinite(endTime) || endTime === startTime) {
                endTime = startTime + 24 * 60 * 60 * 1000 - 1;
            }
        }

        const entries = await readUnifiedEntries();
        const filtered = entries.filter((entry) => {
            if (levels.length && !levels.includes(entry.level)) return false;
            if (sources.length && !sources.includes(entry.source)) return false;
            if (traceId && entry.traceId !== traceId) return false;
            if (search && !entry.message.toLowerCase().includes(search)) return false;
            if (startTime !== null && endTime !== null) {
                const ts = new Date(entry.timestamp).getTime();
                if (ts < startTime || ts > endTime) return false;
            }
            return true;
        });

        const sorted = filtered.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const total = sorted.length;
        const sliced = sorted.slice(offset, offset + limit);
        const accept = c.req.header("Accept") || "";
        if (accept.includes("text/plain")) {
            const content = sliced.map((entry) => JSON.stringify(entry)).join("\n");
            return new Response(content, {
                status: 200,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Content-Disposition": 'attachment; filename=\"okastr8-logs.jsonl\"',
                },
            });
        }

        return c.json(apiResponse(true, "Logs", { logs: sliced, total }));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message || "Failed to load logs"));
    }
});

// User routes
api.post("/user/create", async (c) => {
    try {
        const { username, password, distro } = await c.req.json();
        const result = await createUser(username, password, distro);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /user/create error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/user/delete", async (c) => {
    try {
        const { username } = await c.req.json();
        const result = await deleteUser(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /user/delete error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/user/last-login", async (c) => {
    try {
        const { username } = await c.req.json();
        const result = await getLastLogin(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /user/last-login error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/user/list-groups", async (c) => {
    try {
        const { username } = await c.req.json();
        const result = await listGroups(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /user/list-groups error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.get("/user/list-users", async (c) => {
    try {
        const result = await listUsers();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /user/list-users error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/user/lock", async (c) => {
    try {
        const { username } = await c.req.json();
        const result = await lockUser(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /user/lock error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/user/unlock", async (c) => {
    try {
        const { username } = await c.req.json();
        const result = await unlockUser(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /user/unlock error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Systemd routes
api.post("/systemd/create", async (c) => {
    try {
        const {
            service_name,
            description,
            exec_start,
            working_directory,
            user,
            wanted_by,
            auto_start,
        } = await c.req.json();
        const result = await createService(
            service_name,
            description,
            exec_start,
            working_directory,
            user,
            wanted_by,
            auto_start
        );
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/create error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/delete", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await deleteService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/delete error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/start", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await startService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/start error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/stop", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await stopService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/stop error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/restart", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await restartService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/restart error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/status", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await statusService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/status error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/logs", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await logsService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/logs error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/enable", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await enableService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/enable error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/systemd/disable", async (c) => {
    try {
        const { service_name } = await c.req.json();
        const result = await disableService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/disable error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.get("/systemd/reload", async (c) => {
    try {
        const result = await reloadDaemon();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/reload error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.get("/systemd/list", async (c) => {
    try {
        const result = await listServices();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /systemd/list error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Orchestrate route
api.post("/orchestrate", async (c) => {
    try {
        // orchestrateEnvironment takes no arguments - reads from ~/.okastr8/environment.json
        const result = await orchestrateEnvironment();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /orchestrate error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Setup routes
api.post("/setup/full", async (c) => {
    try {
        const result = await runFullSetup();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /setup/full error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/setup/ssh-harden", async (c) => {
    try {
        const { port } = await c.req.json().catch(() => ({}));
        const result = await hardenSsh(port);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /setup/ssh-harden error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/setup/ssh-port", async (c) => {
    try {
        const { port } = await c.req.json();
        if (!port) {
            return c.json(apiResponse(false, "port is required"));
        }
        const result = await changeSshPort(parseInt(port, 10));
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /setup/ssh-port error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/setup/firewall", async (c) => {
    try {
        const { ssh_port } = await c.req.json().catch(() => ({}));
        const result = await configureFirewall(ssh_port);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /setup/firewall error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/setup/fail2ban", async (c) => {
    try {
        const result = await configureFail2ban();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /setup/fail2ban error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// App management routes
api.post("/app/create", async (c) => {
    try {
        const { createApp } = await import("./commands/app");
        const config = await c.req.json();
        const result = await createApp(config);
        return c.json(apiResponse(result.success, result.message, { appDir: result.appDir }));
    } catch (error: any) {
        console.error("API: /app/create error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/delete", async (c) => {
    try {
        const { deleteApp } = await import("./commands/app");
        const { name } = await c.req.json();
        const result = await deleteApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /app/delete error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.get("/app/list", async (c) => {
    try {
        const { listApps } = await import("./commands/app");
        const result = await listApps();
        return c.json(apiResponse(result.success, "Apps listed", { apps: result.apps }));
    } catch (error: any) {
        console.error("API: /app/list error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/status", async (c) => {
    try {
        const { getAppStatus } = await import("./commands/app");
        const { name } = await c.req.json();
        const result = await getAppStatus(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /app/status error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/logs", async (c) => {
    try {
        const { getAppLogs } = await import("./commands/app");
        const { name, lines } = await c.req.json();
        const result = await getAppLogs(name, lines || 50);
        return c.json(apiResponse(result.success, result.logs));
    } catch (error: any) {
        console.error("API: /app/logs error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/export-logs", async (c) => {
    try {
        const { exportAppLogs } = await import("./commands/app");
        const { name } = await c.req.json();
        const result = await exportAppLogs(name);
        return c.json(apiResponse(result.success, result.message, { logFile: result.logFile }));
    } catch (error: any) {
        console.error("API: /app/export-logs error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/start", async (c) => {
    try {
        const { startApp } = await import("./commands/app");
        const { name } = await c.req.json();
        const result = await startApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /app/start error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/stop", async (c) => {
    try {
        const { stopApp } = await import("./commands/app");
        const { name } = await c.req.json();
        const result = await stopApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /app/stop error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/webhook-toggle", async (c) => {
    try {
        const { setAppWebhookAutoDeploy } = await import("./commands/app");
        const { name, enabled } = await c.req.json();
        const result = await setAppWebhookAutoDeploy(name, enabled);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /app/webhook-toggle error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/webhook-branch", async (c) => {
    try {
        const { setAppWebhookBranch } = await import("./commands/app");
        const { name, branch } = await c.req.json();
        const result = await setAppWebhookBranch(name, branch);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /app/webhook-branch error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/restart", async (c) => {
    try {
        const { restartApp } = await import("./commands/app");
        const { name } = await c.req.json();
        const result = await restartApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /app/restart error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/versions", async (c) => {
    try {
        const { name } = await c.req.json();
        const { getVersions } = await import("./commands/version");
        const versions = await getVersions(name);
        return c.json(apiResponse(true, "", versions));
    } catch (error: any) {
        console.error("API: /app/versions error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/app/rollback", async (c) => {
    try {
        const { name, versionId } = await c.req.json();
        const { rollback, getCurrentVersion } = await import("./commands/version");
        const { restartApp } = await import("./commands/app");

        const result = await rollback(name, parseInt(versionId));
        if (result.success) {
            // Restart the app to pick up changes
            await restartApp(name);
            return c.json(apiResponse(true, result.message));
        } else {
            return c.json(apiResponse(false, result.message));
        }
    } catch (error: any) {
        console.error("API: /app/rollback error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Deploy history endpoint (parity with CLI `deploy history`)
api.get("/deploy/history/:appName", async (c) => {
    try {
        const appName = c.req.param("appName");
        const { getDeploymentHistory } = await import("./commands/deploy");

        const result = await getDeploymentHistory(appName);
        return c.json(
            apiResponse(true, `Deployment history for ${appName}`, { history: result.history })
        );
    } catch (error: any) {
        console.error("API: /deploy/history error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Health check endpoint (parity with CLI `deploy health`)
api.post("/deploy/health", async (c) => {
    try {
        const { method, target, timeout = 30 } = await c.req.json();
        const { runHealthCheck } = await import("./commands/deploy");

        const result = await runHealthCheck(method, target, timeout);
        const success = result.exitCode === 0;

        return c.json(
            apiResponse(success, success ? "Health check passed" : "Health check failed", {
                output: result.stdout || result.stderr,
                exitCode: result.exitCode,
            })
        );
    } catch (error: any) {
        console.error("API: /deploy/health error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Deploy routes
api.post("/deploy/trigger", async (c) => {
    try {
        const { deployApp } = await import("./commands/deploy");
        const options = await c.req.json();
        const result = await deployApp(options);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /deploy/trigger error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/deploy/rollback", async (c) => {
    try {
        const { rollbackApp } = await import("./commands/deploy");
        const { appName, commitHash } = await c.req.json();
        const result = await rollbackApp(appName, commitHash);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error("API: /deploy/rollback error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/deploy/history", async (c) => {
    try {
        const { getDeploymentHistory } = await import("./commands/deploy");
        const { appName } = await c.req.json();
        const result = await getDeploymentHistory(appName);
        return c.json(
            apiResponse(result.success, "Deployment history", { history: result.history })
        );
    } catch (error: any) {
        console.error("API: /deploy/history error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/deploy/health", async (c) => {
    try {
        const { runHealthCheck } = await import("./commands/deploy");
        const { method, target, timeout } = await c.req.json();
        const result = await runHealthCheck(method, target, timeout || 30);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error("API: /deploy/health error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// GitHub routes
api.get("/github/status", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getConnectionStatus } = await import("./commands/github");
        const status = await getConnectionStatus();
        return c.json(apiResponse(true, status.connected ? "Connected" : "Not connected", status));
    } catch (error: any) {
        console.error("API: /github/status error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.get("/github/auth-url", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getGitHubConfig, getAuthUrl } = await import("./commands/github");
        const config = await getGitHubConfig();

        if (!config.clientId) {
            return c.json(
                apiResponse(false, "GitHub OAuth not configured. Set clientId in config.")
            );
        }

        // Build callback URL from request
        const host = c.req.header("host") || "localhost:41788";
        const protocol = c.req.header("x-forwarded-proto") || "http";
        const callbackUrl = `${protocol}://${host}/api/github/callback`;

        const authUrl = getAuthUrl(config.clientId, callbackUrl, "connect");
        return c.json(apiResponse(true, "Auth URL generated", { authUrl, callbackUrl }));
    } catch (error: any) {
        console.error("API: /github/auth-url error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.get("/auth/github", async (c) => {
    try {
        const { getGitHubConfig, getAuthUrl } = await import("./commands/github");
        const { getSystemConfig } = await import("./config");
        const config = await getGitHubConfig();
        const systemConfig = await getSystemConfig();

        if (!config.clientId) {
            return c.redirect("/login?error=github_not_configured");
        }

        const githubAdminId = systemConfig.manager?.auth?.github_admin_id;
        if (!githubAdminId) {
            return c.redirect("/login?error=github_admin_not_set");
        }

        const host = c.req.header("host") || "localhost:41788";
        const protocol = c.req.header("x-forwarded-proto") || "http";
        const callbackUrl = `${protocol}://${host}/api/github/callback`;

        const authUrl = getAuthUrl(config.clientId, callbackUrl, "login");
        return c.redirect(authUrl);
    } catch (error: any) {
        console.error("API: /auth/github error:", error);
        return c.redirect("/login?error=github_auth_failed");
    }
});

api.get("/github/callback", async (c) => {
    let isLoginFlow = false;
    try {
        const code = c.req.query("code");
        const error = c.req.query("error");
        const state = c.req.query("state") || "";
        isLoginFlow = state.startsWith("login_");

        if (error) {
            // Redirect to UI with error
            return c.redirect(
                isLoginFlow
                    ? `/login?error=${encodeURIComponent(error)}`
                    : `/github?error=${encodeURIComponent(error)}`
            );
        }

        if (!code) {
            return c.redirect(isLoginFlow ? "/login?error=no_code" : "/github?error=no_code");
        }

        const {
            getGitHubConfig,
            exchangeCodeForToken,
            getGitHubUser,
            saveGitHubConfig,
            saveGitHubAdminIdentity,
        } = await import("./commands/github");
        const config = await getGitHubConfig();

        if (!config.clientId || !config.clientSecret) {
            return c.redirect(
                isLoginFlow ? "/login?error=config_missing" : "/github?error=config_missing"
            );
        }

        // Exchange code for token
        const tokenData = await exchangeCodeForToken(config.clientId, config.clientSecret, code);

        if (tokenData.error || !tokenData.accessToken) {
            return c.redirect(
                isLoginFlow
                    ? `/login?error=${encodeURIComponent(tokenData.error || "token_exchange_failed")}`
                    : `/github?error=${encodeURIComponent(tokenData.error || "token_exchange_failed")}`
            );
        }

        // Get user profile
        const userProfile = await getGitHubUser(tokenData.accessToken);

        if (isLoginFlow) {
            const { getSystemConfig } = await import("./config");
            const { generateToken } = await import("./commands/auth");
            const systemConfig = await getSystemConfig();
            const githubAdminId = systemConfig.manager?.auth?.github_admin_id;

            if (!githubAdminId) {
                return c.redirect("/login?error=github_admin_not_set");
            }

            if (String(userProfile.id) !== String(githubAdminId)) {
                return c.redirect("/login?error=github_not_allowed");
            }

            await saveGitHubConfig({
                ...config,
                accessToken: tokenData.accessToken,
                username: userProfile.login,
                connectedAt: new Date().toISOString(),
            });

            const { token } = await generateToken(`github:${userProfile.id}`);
            const cookieOpts = "Path=/; HttpOnly; SameSite=Strict; Max-Age=86400";
            c.header("Set-Cookie", `okastr8_session=${token}; ${cookieOpts}`);

            return c.redirect("/");
        }

        // Save config with new token
        await saveGitHubConfig({
            ...config,
            accessToken: tokenData.accessToken,
            username: userProfile.login,
            connectedAt: new Date().toISOString(),
        });

        await saveGitHubAdminIdentity(userProfile.id, userProfile.login);
        console.log(`GitHub connected for user: ${userProfile.login}`);
        return c.redirect(`/github?connected=true&user=${userProfile.login}`);
    } catch (error: any) {
        console.error("API: /github/callback error:", error);
        return c.redirect(
            isLoginFlow
                ? `/login?error=${encodeURIComponent(error.message)}`
                : `/github?error=${encodeURIComponent(error.message)}`
        );
    }
});

api.get("/github/repos", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getGitHubConfig, listRepos } = await import("./commands/github");
        const config = await getGitHubConfig();

        if (!config.accessToken) {
            return c.json(apiResponse(false, "GitHub not connected"));
        }

        const repos = await listRepos(config.accessToken);
        return c.json(apiResponse(true, `Found ${repos.length} repositories`, { repos }));
    } catch (error: any) {
        console.error("API: /github/repos error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Setup SSH deploy key for autonomous deploys
api.post("/github/setup-deploy-key", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getGitHubConfig, hasOkastr8DeployKey, createSSHKey } =
            await import("./commands/github");
        const { runCommand } = await import("./utils/command");
        const { existsSync } = await import("fs");
        const { readFile } = await import("fs/promises");
        const { homedir } = await import("os");
        const { join } = await import("path");

        const config = await getGitHubConfig();
        if (!config.accessToken) {
            return c.json(apiResponse(false, "GitHub not connected"));
        }

        // Check if key already exists in GitHub
        const keyExists = await hasOkastr8DeployKey(config.accessToken);
        if (keyExists) {
            return c.json(
                apiResponse(true, "Deploy key already configured!", { alreadyExists: true })
            );
        }

        // Generate local key if it doesn't exist
        const sshDir = join(homedir(), ".ssh");
        const keyPath = join(sshDir, "okastr8_deploy_key");
        const pubKeyPath = `${keyPath}.pub`;

        if (!existsSync(pubKeyPath)) {
            console.log("Generating new SSH deploy key...");
            // Create .ssh dir if needed
            await runCommand("mkdir", ["-p", sshDir]);
            await runCommand("chmod", ["700", sshDir]);

            // Generate key without passphrase
            const genResult = await runCommand("ssh-keygen", [
                "-t",
                "ed25519",
                "-f",
                keyPath,
                "-N",
                "", // Empty passphrase
                "-C",
                "okastr8-deploy-key",
            ]);

            if (genResult.exitCode !== 0) {
                return c.json(apiResponse(false, `Failed to generate key: ${genResult.stderr}`));
            }
        }

        // Read public key
        const publicKey = (await readFile(pubKeyPath, "utf-8")).trim();

        // Push to GitHub
        const hostname = await runCommand("hostname", []);
        const keyTitle = `Okastr8 Deploy Key (${hostname.stdout.trim()})`;

        const result = await createSSHKey(config.accessToken, keyTitle, publicKey);

        if (!result.success) {
            return c.json(apiResponse(false, result.message));
        }

        // Configure Git to use SSH for GitHub
        await runCommand("git", [
            "config",
            "--global",
            "url.git@github.com:.insteadOf",
            "https://github.com/",
        ]);

        return c.json(apiResponse(true, "Deploy key configured successfully!", { publicKey }));
    } catch (error: any) {
        console.error("API: /github/setup-deploy-key error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/github/branches", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getGitHubConfig, listBranches } = await import("./commands/github");
        const config = await getGitHubConfig();
        if (!config.accessToken) return c.json(apiResponse(false, "Not connected"));

        const { repoFullName } = await c.req.json();
        const branches = await listBranches(config.accessToken, repoFullName);
        return c.json(apiResponse(true, "Branches fetched", { branches }));
    } catch (error: any) {
        console.error("API /github/branches Error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

api.post("/github/check-config", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getGitHubConfig, checkRepoConfig } = await import("./commands/github");
        const config = await getGitHubConfig();
        if (!config.accessToken) return c.json(apiResponse(false, "Not connected"));

        const { repoFullName, ref } = await c.req.json();
        const hasConfig = await checkRepoConfig(config.accessToken, repoFullName, ref);
        return c.json(apiResponse(true, "Check complete", { hasConfig }));
    } catch (error: any) {
        console.error("API /github/check-config Error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

api.post("/github/inspect-config", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getGitHubConfig, inspectRepoConfig } = await import("./commands/github");
        const config = await getGitHubConfig();
        if (!config.accessToken) return c.json(apiResponse(false, "Not connected"));

        const { repoFullName, ref } = await c.req.json();
        const result = await inspectRepoConfig(config.accessToken, repoFullName, ref);
        return c.json(apiResponse(true, "Config inspected", result));
    } catch (error: any) {
        console.error("API /github/inspect-config Error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

// Check if deploying to a different branch than originally configured
api.post("/github/check-branch-change", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { getAppMetadata } = await import("./commands/app");
        const { repoFullName, branch, appName } = await c.req.json();

        // Derive app name from repo if not provided
        const derivedAppName =
            appName ||
            repoFullName
                .split("/")[1]
                ?.toLowerCase()
                .replace(/[^a-z0-9-]/g, "-");

        if (!derivedAppName) {
            return c.json(
                apiResponse(true, "No app name derivable", { exists: false, branchChanged: false })
            );
        }

        try {
            const metadata = await getAppMetadata(derivedAppName);

            const webhookBranch = metadata.webhookBranch || metadata.gitBranch;
            // App exists - check branch vs webhook branch
            if (webhookBranch && webhookBranch !== branch) {
                return c.json(
                    apiResponse(true, "Branch change detected", {
                        exists: true,
                        branchChanged: true,
                        currentBranch: webhookBranch,
                        requestedBranch: branch,
                        appName: derivedAppName,
                        webhookBranch: webhookBranch,
                        warning: `This app's webhook branch is "${webhookBranch}". You selected "${branch}". Auto-deploy will keep using "${webhookBranch}" unless you change it in the app settings.`,
                    })
                );
            }

            return c.json(
                apiResponse(true, "No branch change", {
                    exists: true,
                    branchChanged: false,
                    currentBranch: webhookBranch || metadata.gitBranch,
                    webhookBranch: webhookBranch,
                    appName: derivedAppName,
                })
            );
        } catch {
            // App doesn't exist yet
            return c.json(
                apiResponse(true, "New app", {
                    exists: false,
                    branchChanged: false,
                    appName: derivedAppName,
                })
            );
        }
    } catch (error: any) {
        console.error("API /github/check-branch-change Error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

api.post("/github/prepare-deploy", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { prepareRepoImport } = await import("./commands/github");
        const { startDeploymentStream, endDeploymentStream, streamLog } =
            await import("./utils/deploymentLogger");
        const { randomBytes } = await import("crypto");

        const options = await c.req.json();

        // Generates a temp deployment ID for the prepare phase logs
        const deploymentId = randomBytes(16).toString("hex");
        startDeploymentStream(deploymentId);

        // We wrap the async work to return the result via JSON + stream logs
        // But we need to await it here to return the config to the UI
        try {
            const result = await prepareRepoImport(options, deploymentId);

            streamLog(
                deploymentId,
                `Preparation ${result.success ? "succeeded" : "failed"}: ${result.message}`
            );
            setTimeout(() => endDeploymentStream(deploymentId), 500);

            if (result.success) {
                return c.json(
                    apiResponse(true, "Ready for configuration", {
                        deploymentId, // ID of the prepare logs
                        appName: result.appName,
                        versionId: result.versionId,
                        config: result.config,
                        detectedRuntime: result.detectedRuntime,
                        hasUserDocker: result.hasUserDocker,
                    })
                );
            } else {
                return c.json(apiResponse(false, result.message));
            }
        } catch (e: any) {
            streamLog(deploymentId, `Error: ${e.message}`);
            setTimeout(() => endDeploymentStream(deploymentId), 500);
            throw e;
        }
    } catch (error: any) {
        console.error("API: /github/prepare-deploy error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/github/finalize-deploy", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { finalizeRepoImport } = await import("./commands/github");
        const { startDeploymentStream, endDeploymentStream, streamLog } =
            await import("./utils/deploymentLogger");
        const { randomBytes } = await import("crypto");

        const { appName, versionId, config } = await c.req.json();

        // New deployment ID for the build/deploy phase
        const deploymentId = randomBytes(16).toString("hex");
        startDeploymentStream(deploymentId);

        // Run finalize async
        finalizeRepoImport(appName, versionId, config, deploymentId)
            .then((result) => {
                streamLog(
                    deploymentId,
                    `Deployment ${result.success ? "succeeded" : "failed"}: ${result.message}`
                );
                setTimeout(() => endDeploymentStream(deploymentId), 1000);
            })
            .catch((error) => {
                streamLog(deploymentId, `Deployment error: ${error.message}`);
                setTimeout(() => endDeploymentStream(deploymentId), 1000);
            });

        return c.json(
            apiResponse(true, "Deployment finalized", {
                deploymentId,
            })
        );
    } catch (error: any) {
        console.error("API: /github/finalize-deploy error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/github/deploy", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { prepareRepoImport, finalizeRepoImport } = await import("./commands/github");
        const { startDeploymentStream, endDeploymentStream, streamLog } =
            await import("./utils/deploymentLogger");
        const { randomBytes } = await import("crypto");

        const { repoFullName, branch, config } = await c.req.json();

        const deploymentId = randomBytes(16).toString("hex");
        startDeploymentStream(deploymentId);

        try {
            const prep = await prepareRepoImport({ repoFullName, branch }, deploymentId);
            if (!prep.success || !prep.appName || !prep.versionId) {
                streamLog(deploymentId, `Prepare failed: ${prep.message}`);
                setTimeout(() => endDeploymentStream(deploymentId), 500);
                return c.json(apiResponse(false, prep.message));
            }

            finalizeRepoImport(prep.appName, prep.versionId, config, deploymentId)
                .then((result) => {
                    streamLog(
                        deploymentId,
                        `Deployment ${result.success ? "succeeded" : "failed"}: ${result.message}`
                    );
                    setTimeout(() => endDeploymentStream(deploymentId), 1000);
                })
                .catch((error) => {
                    streamLog(deploymentId, `Deployment error: ${error.message}`);
                    setTimeout(() => endDeploymentStream(deploymentId), 1000);
                });

            return c.json(apiResponse(true, "Deployment started", { deploymentId }));
        } catch (e: any) {
            streamLog(deploymentId, `Error: ${e.message}`);
            setTimeout(() => endDeploymentStream(deploymentId), 500);
            throw e;
        }
    } catch (error: any) {
        console.error("API: /github/deploy error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// Legacy import (kept for backward compatibility, wrapped)
api.post("/github/import", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { importRepo } = await import("./commands/github");
        const { startDeploymentStream, endDeploymentStream, streamLog } =
            await import("./utils/deploymentLogger");
        const { randomBytes } = await import("crypto");

        const options = await c.req.json();

        // Generate unique deployment ID
        const deploymentId = randomBytes(16).toString("hex");

        // Start the deployment stream
        startDeploymentStream(deploymentId);

        // Run deployment asynchronously
        importRepo(options, deploymentId)
            .then((result) => {
                streamLog(
                    deploymentId,
                    `Deployment ${result.success ? "succeeded" : "failed"}: ${result.message}`
                );
                setTimeout(() => endDeploymentStream(deploymentId), 1000);
            })
            .catch((error) => {
                streamLog(deploymentId, `Deployment error: ${error.message}`);
                setTimeout(() => endDeploymentStream(deploymentId), 1000);
            });

        // Return immediately with deployment ID
        return c.json(
            apiResponse(true, "Deployment started", {
                deploymentId,
                message: "Deployment started. Connect to stream for real-time logs.",
            })
        );
    } catch (error: any) {
        console.error("API: /github/import error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// GitHub Deployment Log Stream (SSE)
api.get("/github/deploy-stream/:deploymentId", async (c) => {
    const adminCheck = await enforceAdmin(c);
    if (adminCheck) return adminCheck;
    const deploymentId = c.req.param("deploymentId");
    console.log(`[SSE] Client connecting to deployment stream: ${deploymentId}`);

    const { subscribe } = await import("./utils/deploymentLogger");

    // Create a readable stream for SSE
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            let heartbeatInterval: Timer | null = null;
            let isClosed = false;

            // Helper to safely enqueue data
            const safeEnqueue = (data: Uint8Array) => {
                if (!isClosed) {
                    try {
                        controller.enqueue(data);
                    } catch (error) {
                        // Client disconnected - this is expected, silently stop
                        isClosed = true;
                        if (heartbeatInterval) clearInterval(heartbeatInterval);
                    }
                }
            };

            // Send heartbeat every 5 seconds to keep connection alive
            heartbeatInterval = setInterval(() => {
                // SSE comment format - ignored by EventSource but keeps connection alive
                safeEnqueue(encoder.encode(": heartbeat\n\n"));
            }, 5000);

            // Subscribe to deployment logs
            const unsubscribe = subscribe(deploymentId, (message: string) => {
                if (isClosed) return;

                // Check if stream should end
                if (message === "[DEPLOYMENT_STREAM_END]") {
                    // Clear heartbeat FIRST to prevent race condition
                    if (heartbeatInterval) clearInterval(heartbeatInterval);
                    isClosed = true;

                    // Now safe to send final message and close
                    try {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: "end" })}\n\n`)
                        );
                    } catch (e) {
                        // Ignore - controller may already be closing
                    }

                    try {
                        controller.close();
                    } catch (e) {
                        // Ignore - controller may already be closed
                    }

                    unsubscribe();
                    return;
                }

                // Send log message to client
                safeEnqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "log", message })}\n\n`)
                );
            });

            // Send initial connection message
            safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "connected", deploymentId })}\n\n`)
            );

            console.log(`[SSE] Client subscribed to: ${deploymentId}`);

            // Cleanup on stream cancel
            return () => {
                console.log(`[SSE] Stream cancelled for: ${deploymentId}`);
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                isClosed = true;
                unsubscribe();
            };
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
});

// Cancel a running deployment
api.post("/github/cancel-deployment/:deploymentId", async (c) => {
    const deploymentId = c.req.param("deploymentId");

    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { cancelDeployment, endDeploymentStream } = await import("./utils/deploymentLogger");

        const cancelled = cancelDeployment(deploymentId);

        if (cancelled) {
            // End the stream after a short delay to allow the cancel message to be sent
            setTimeout(() => endDeploymentStream(deploymentId), 500);
            return c.json(apiResponse(true, "Deployment cancelled"));
        } else {
            return c.json(apiResponse(false, "Deployment not found or already completed"));
        }
    } catch (error: any) {
        console.error("API: /github/cancel-deployment error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

api.post("/github/disconnect", async (c) => {
    try {
        const adminCheck = await enforceAdmin(c);
        if (adminCheck) return adminCheck;
        const { disconnectGitHub } = await import("./commands/github");
        await disconnectGitHub();
        return c.json(apiResponse(true, "GitHub disconnected"));
    } catch (error: any) {
        console.error("API: /github/disconnect error:", error);
        return c.json(apiResponse(false, error.message || "Internal Server Error"));
    }
});

// GitHub Webhook Handler
api.post("/github/webhook", async (c) => {
    try {
        const { getSystemConfig } = await import("./config");
        const { listApps, updateApp } = await import("./commands/app");

        const config = await getSystemConfig();
        const secret = config.manager?.github?.webhook_secret;

        if (!secret) {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "error",
                source: "webhook",
                service: "github-webhook",
                message: "Webhook secret not configured",
                action: "webhook-rejected",
            });
            return c.text("Webhook secret not configured", 500);
        }

        const signature = c.req.header("X-Hub-Signature-256");
        if (!signature) {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "warn",
                source: "webhook",
                service: "github-webhook",
                message: "Signature missing",
                action: "webhook-rejected",
            });
            return c.text("Signature missing", 401);
        }

        const payload = await c.req.text();

        // Verify Signature
        const hmac = createHmac("sha256", secret);
        const digest = "sha256=" + hmac.update(payload).digest("hex");

        const sigBuffer = Buffer.from(signature);
        const digestBuffer = Buffer.from(digest);

        if (sigBuffer.length !== digestBuffer.length || !timingSafeEqual(sigBuffer, digestBuffer)) {
            console.error("Webhook signature mismatch");
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "warn",
                source: "webhook",
                service: "github-webhook",
                message: "Webhook signature mismatch",
                action: "webhook-rejected",
            });
            return c.text("Invalid signature", 401);
        }

        const event = JSON.parse(payload);

        // Only handle push events for now
        const githubEvent = c.req.header("X-GitHub-Event");
        if (githubEvent !== "push") {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "info",
                source: "webhook",
                service: "github-webhook",
                message: `Ignored non-push event: ${githubEvent}`,
                action: "webhook-ignored",
            });
            return c.json({ ignored: true, message: "Not a push event" });
        }

        const repoUrl = event.repository?.clone_url;
        const repoName = event.repository?.full_name;

        if (!repoUrl) {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "warn",
                source: "webhook",
                service: "github-webhook",
                message: "No repository info in webhook payload",
                action: "webhook-ignored",
            });
            return c.json({ ignored: true, message: "No repository info" });
        }

        // Look for matching app
        // Apps store `gitRepo`. We match against that.
        const { apps } = await listApps();

        // Simple matching strategy
        // TODO: We should probably store repo ID to be precise, but clone_url is fine unique identifier usually.
        const targetApp = apps.find(
            (a) => a.gitRepo === repoUrl || (a.gitRepo && a.gitRepo.includes(repoName))
        );

        if (targetApp) {
            // Check Auto-Deploy Flag
            if (targetApp.webhookAutoDeploy === false) {
                void writeUnifiedEntry({
                    timestamp: new Date().toISOString(),
                    level: "info",
                    source: "webhook",
                    service: "github-webhook",
                    message: `Auto-deploy disabled for ${targetApp.name}`,
                    action: "webhook-ignored",
                    app: {
                        name: targetApp.name,
                        repo: targetApp.gitRepo,
                        branch: targetApp.gitBranch,
                    },
                });
                return c.json({ ignored: true, message: "Auto-deploy disabled for this app" });
            }

            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "info",
                source: "webhook",
                service: "github-webhook",
                message: `Auto-deploy triggered for ${targetApp.name}`,
                action: "webhook-trigger",
                app: { name: targetApp.name, repo: targetApp.gitRepo, branch: targetApp.gitBranch },
            });

            // Check branch if possible
            const webhookBranch = targetApp.webhookBranch || targetApp.gitBranch;
            if (webhookBranch && event.ref) {
                const pushRef = event.ref; // e.g., "refs/heads/main"
                const appRef = `refs/heads/${webhookBranch}`;
                if (!pushRef.endsWith(webhookBranch)) {
                    void writeUnifiedEntry({
                        timestamp: new Date().toISOString(),
                        level: "info",
                        source: "webhook",
                        service: "github-webhook",
                        message: `Branch mismatch: ${pushRef} != ${webhookBranch}`,
                        action: "webhook-ignored",
                        app: {
                            name: targetApp.name,
                            repo: targetApp.gitRepo,
                            branch: webhookBranch,
                        },
                        data: { pushRef },
                    });
                    return c.json({
                        ignored: true,
                        message: `Branch mismatch: ${pushRef} != ${webhookBranch}`,
                    });
                }
            }

            // Trigger Update (async)
            updateApp(targetApp.name)
                .then(() => {
                    void writeUnifiedEntry({
                        timestamp: new Date().toISOString(),
                        level: "info",
                        source: "webhook",
                        service: "github-webhook",
                        message: `Auto-deploy ${targetApp.name} complete`,
                        action: "webhook-deploy-success",
                        app: {
                            name: targetApp.name,
                            repo: targetApp.gitRepo,
                            branch: targetApp.gitBranch,
                        },
                    });
                })
                .catch((err) => {
                    void writeUnifiedEntry({
                        timestamp: new Date().toISOString(),
                        level: "error",
                        source: "webhook",
                        service: "github-webhook",
                        message: `Auto-deploy ${targetApp.name} failed`,
                        action: "webhook-deploy-failed",
                        app: {
                            name: targetApp.name,
                            repo: targetApp.gitRepo,
                            branch: targetApp.gitBranch,
                        },
                        error:
                            err instanceof Error
                                ? { name: err.name, message: err.message, stack: err.stack }
                                : { message: String(err) },
                    });
                });

            return c.json({ success: true, app: targetApp.name, message: "Deployment triggered" });
        }

        void writeUnifiedEntry({
            timestamp: new Date().toISOString(),
            level: "info",
            source: "webhook",
            service: "github-webhook",
            message: `No app found for ${repoName}`,
            action: "webhook-ignored",
            data: { repoName },
        });
        return c.json({ ignored: true, message: `No app found for ${repoName}` });
    } catch (error: any) {
        console.error("API: /github/webhook error:", error);
        if (error instanceof Error) {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "error",
                source: "webhook",
                service: "github-webhook",
                message: "Webhook handler error",
                action: "webhook-error",
                error: { name: error.name, message: error.message, stack: error.stack },
            });
        }
        return c.text(error.message, 500);
    }
});

// ============ Auth Endpoints ============

// Get current session info
api.get("/auth/me", async (c) => {
    try {
        // Extract token from cookie
        const cookie = c.req.header("Cookie");
        let token = null;
        if (cookie) {
            const match = cookie.match(/okastr8_session=([^;]+)/);
            if (match && match[1]) {
                token = match[1];
            }
        }

        if (!token) {
            return c.json(apiResponse(false, "Not authenticated"), 401);
        }

        const { validateToken } = await import("./commands/auth");
        const result = await validateToken(token);

        if (!result.valid) {
            return c.json(apiResponse(false, result.error || "Invalid session"), 401);
        }

        return c.json(
            apiResponse(true, "Session valid", {
                userId: result.userId,
            })
        );
    } catch (error: any) {
        console.error("API /auth/me error:", error);
        return c.json(apiResponse(false, error.message), 500);
    }
});

// Logout (clear session cookie)
api.post("/auth/logout", async (c) => {
    c.header("Set-Cookie", "okastr8_session=; Path=/; HttpOnly; Max-Age=0");
    return c.json(apiResponse(true, "Logged out"));
});

// ================ Global Service Controls ================

api.post("/services/start-all", async (c) => {
    const { controlAllServices } = await import("./commands/system");
    await controlAllServices("start");
    return c.json(apiResponse(true, "Initiated start sequence for all services"));
});

api.post("/services/stop-all", async (c) => {
    const { controlAllServices } = await import("./commands/system");
    await controlAllServices("stop");
    return c.json(apiResponse(true, "Initiated stop sequence for all services"));
});

api.post("/services/restart-all", async (c) => {
    const { controlAllServices } = await import("./commands/system");
    await controlAllServices("restart");
    return c.json(apiResponse(true, "Initiated restart sequence for all services"));
});

// Manual test endpoint for resource alerts (dev use)
api.post("/system/alerts/test", async (c) => {
    try {
        const { triggerResourceAlertTest } = await import("./services/monitor");
        await triggerResourceAlertTest();
        return c.json(apiResponse(true, "Resource alert test triggered"));
    } catch (error: any) {
        console.error("API /system/alerts/test error:", error);
        return c.json(
            apiResponse(false, error.message || "Failed to trigger resource alert test"),
            500
        );
    }
});
// ================ Tunnel Controls ================

api.get("/tunnel/status", async (c) => {
    try {
        const { getTunnelStatus } = await import("./commands/tunnel");
        const status = await getTunnelStatus();
        return c.json(apiResponse(true, "Tunnel status", status));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.post("/tunnel/setup", async (c) => {
    try {
        const { installTunnel } = await import("./commands/tunnel");
        const { token } = await c.req.json();

        if (!token) return c.json(apiResponse(false, "Token is required"));

        const result = await installTunnel(token);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.post("/tunnel/uninstall", async (c) => {
    try {
        const { uninstallTunnel } = await import("./commands/tunnel");
        const result = await uninstallTunnel();
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

export default api;
