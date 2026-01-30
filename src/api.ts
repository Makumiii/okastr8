import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';
import {
    createUser,
    deleteUser,
    getLastLogin,
    listGroups,
    listUsers,
    lockUser,
    unlockUser,
} from './commands/user';
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
} from './commands/systemd';
import { orchestrateEnvironment } from './commands/orchestrate';
import {
    runFullSetup,
    hardenSsh,
    changeSshPort,
    configureFirewall,
    configureFail2ban,
} from './commands/setup';
import { validateToken } from './commands/auth';

const api = new Hono();

// Helper for consistent API responses
const apiResponse = (success: boolean, message: string, data?: any) => ({
    success,
    message,
    data,
});

// ============ Global Auth Middleware ============
// Automatically enforces authentication and permissions on all routes

// Routes that don't require authentication
const PUBLIC_ROUTES = [
    'POST:/auth/verify',
    'POST:/auth/logout',
    'GET:/auth/me',
    'POST:/github/webhook', // Webhook has its own HMAC verification
    'GET:/github/callback',  // OAuth callback - no auth yet!
    'GET:/github/auth-url',  // Auth URL generation
    // Dynamic routes handled in middleware, but explicitly allowing this pattern not possible here easily
    // We will check for /auth/approval/ prefix in middleware
];

api.use('*', async (c, next) => {
    const method = c.req.method;
    const path = c.req.path.replace('/api', ''); // Remove /api prefix
    const routeKey = `${method}:${path}`;

    // Skip auth for public routes or approval status polling
    if (PUBLIC_ROUTES.some(r => routeKey === r) || path === '/github/webhook' || path.startsWith('/auth/approval/')) {
        return next();
    }

    // Extract token from cookie or header
    let token: string | null = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    } else {
        const cookie = c.req.header('Cookie');
        if (cookie) {
            const match = cookie.match(/okastr8_session=([^;]+)/);
            if (match && match[1]) {
                token = match[1];
            }
        }
    }

    // Require authentication
    if (!token) {
        return c.json(apiResponse(false, 'Authentication required'), 401);
    }

    // Validate token
    const result = await validateToken(token);
    if (!result.valid) {
        return c.json(apiResponse(false, result.error || 'Invalid token'), 401);
    }

    // Store user info in context (no permission checks - all authenticated users have full access)
    c.set('userId', result.userId!);

    return next();
});

// ============ System Status Endpoints ============

api.get('/system/status', async (c) => {
    try {
        const { detectAllRuntimes } = await import('./commands/env');
        const { getRecentLogs, getLogCounts, getHealthStatus } = await import('./utils/logger');
        const { runCommand } = await import('./utils/command');
        const os = await import('os');

        // Get system uptime
        const uptimeSeconds = os.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;

        // Get current user (prefer SUDO_USER to show actual admin, not root)
        const user = process.env.SUDO_USER || process.env.USER || 'unknown';

        // Get environments
        const environments = await detectAllRuntimes();

        // Get okastr8 manager service status (still uses systemd for manager itself)
        const services = [];
        const serviceNames = ['okastr8-manager'];
        for (const name of serviceNames) {
            const result = await runCommand('systemctl', ['is-active', name]);
            services.push({
                name,
                status: result.stdout.trim() || 'unknown',
                running: result.exitCode === 0
            });
        }

        // Get deployed apps
        const { listApps } = await import('./commands/app');
        let apps: any[] = [];
        try {
            const result = await listApps();
            apps = result.success && Array.isArray(result.apps) ? result.apps : [];
        } catch { }

        // Check Docker container statuses for apps
        const { containerStatus, getProjectContainers } = await import('./commands/docker');
        for (const app of apps) {
            if (app && app.name) {
                // First try direct container name (for auto-dockerfile strategy)
                let status = await containerStatus(app.name);

                // If not found, try compose project containers (for user-compose / auto-compose)
                if (!status.running && status.status === 'not found') {
                    const projectContainers = await getProjectContainers(app.name);
                    if (projectContainers.length > 0) {
                        // Check if any container in the project is running
                        const anyRunning = projectContainers.some(c => c.status === 'running');
                        status = {
                            running: anyRunning,
                            status: anyRunning ? 'running' : projectContainers[0]?.status || 'unknown',
                        };
                    }
                }

                services.push({
                    name: app.name,
                    status: status.status,
                    running: status.running,
                    isApp: true
                });
            }
        }

        // Get log health
        const logCounts = getLogCounts();
        const health = getHealthStatus();

        return c.json(apiResponse(true, 'System status', {
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
                counts: logCounts
            }
        }));
    } catch (error: any) {
        console.error('API /system/status error:', error);
        return c.json(apiResponse(false, error.message));
    }
});

api.get('/logs/recent', async (c) => {
    try {
        const { getRecentLogs } = await import('./utils/logger');
        const count = parseInt(c.req.query('count') || '10');
        const logs = getRecentLogs(count);
        return c.json(apiResponse(true, 'Recent logs', { logs }));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.get('/system/metrics', async (c) => {
    try {
        const { collectMetrics } = await import('./commands/metrics');
        const metrics = await collectMetrics();
        return c.json(apiResponse(true, 'System metrics', metrics));
    } catch (error: any) {
        console.error('API /system/metrics error:', error);
        return c.json(apiResponse(false, error.message));
    }
});

// User routes
api.post('/user/create', async (c) => {
    console.log('API: /user/create hit');
    try {
        const { username, password, distro } = await c.req.json();
        const result = await createUser(username, password, distro);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /user/create error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/user/delete', async (c) => {
    console.log('API: /user/delete hit');
    try {
        const { username } = await c.req.json();
        const result = await deleteUser(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /user/delete error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/user/last-login', async (c) => {
    console.log('API: /user/last-login hit');
    try {
        const { username } = await c.req.json();
        const result = await getLastLogin(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /user/last-login error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/user/list-groups', async (c) => {
    console.log('API: /user/list-groups hit');
    try {
        const { username } = await c.req.json();
        const result = await listGroups(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /user/list-groups error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.get('/user/list-users', async (c) => {
    console.log('API: /user/list-users hit');
    try {
        const result = await listUsers();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /user/list-users error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/user/lock', async (c) => {
    console.log('API: /user/lock hit');
    try {
        const { username } = await c.req.json();
        const result = await lockUser(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /user/lock error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/user/unlock', async (c) => {
    console.log('API: /user/unlock hit');
    try {
        const { username } = await c.req.json();
        const result = await unlockUser(username);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /user/unlock error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// Systemd routes
api.post('/systemd/create', async (c) => {
    console.log('API: /systemd/create hit');
    try {
        const { service_name, description, exec_start, working_directory, user, wanted_by, auto_start } = await c.req.json();
        const result = await createService(service_name, description, exec_start, working_directory, user, wanted_by, auto_start);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/create error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/delete', async (c) => {
    console.log('API: /systemd/delete hit');
    try {
        const { service_name } = await c.req.json();
        const result = await deleteService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/delete error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/start', async (c) => {
    console.log('API: /systemd/start hit');
    try {
        const { service_name } = await c.req.json();
        const result = await startService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/start error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/stop', async (c) => {
    console.log('API: /systemd/stop hit');
    try {
        const { service_name } = await c.req.json();
        const result = await stopService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/stop error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/restart', async (c) => {
    console.log('API: /systemd/restart hit');
    try {
        const { service_name } = await c.req.json();
        const result = await restartService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/restart error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/status', async (c) => {
    console.log('API: /systemd/status hit');
    try {
        const { service_name } = await c.req.json();
        const result = await statusService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/status error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/logs', async (c) => {
    console.log('API: /systemd/logs hit');
    try {
        const { service_name } = await c.req.json();
        const result = await logsService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/logs error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/enable', async (c) => {
    console.log('API: /systemd/enable hit');
    try {
        const { service_name } = await c.req.json();
        const result = await enableService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/enable error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/systemd/disable', async (c) => {
    console.log('API: /systemd/disable hit');
    try {
        const { service_name } = await c.req.json();
        const result = await disableService(service_name);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/disable error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.get('/systemd/reload', async (c) => {
    console.log('API: /systemd/reload hit');
    try {
        const result = await reloadDaemon();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/reload error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.get('/systemd/list', async (c) => {
    console.log('API: /systemd/list hit');
    try {
        const result = await listServices();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /systemd/list error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// Orchestrate route
api.post('/orchestrate', async (c) => {
    console.log('API: /orchestrate hit');
    try {
        // orchestrateEnvironment takes no arguments - reads from ~/.okastr8/environment.json
        const result = await orchestrateEnvironment();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /orchestrate error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// Setup routes
api.post('/setup/full', async (c) => {
    console.log('API: /setup/full hit');
    try {
        const result = await runFullSetup();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /setup/full error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/setup/ssh-harden', async (c) => {
    console.log('API: /setup/ssh-harden hit');
    try {
        const { port } = await c.req.json().catch(() => ({}));
        const result = await hardenSsh(port);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /setup/ssh-harden error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/setup/ssh-port', async (c) => {
    console.log('API: /setup/ssh-port hit');
    try {
        const { port } = await c.req.json();
        if (!port) {
            return c.json(apiResponse(false, 'port is required'));
        }
        const result = await changeSshPort(parseInt(port, 10));
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /setup/ssh-port error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/setup/firewall', async (c) => {
    console.log('API: /setup/firewall hit');
    try {
        const { ssh_port } = await c.req.json().catch(() => ({}));
        const result = await configureFirewall(ssh_port);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /setup/firewall error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/setup/fail2ban', async (c) => {
    console.log('API: /setup/fail2ban hit');
    try {
        const result = await configureFail2ban();
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /setup/fail2ban error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// App management routes
api.post('/app/create', async (c) => {
    console.log('API: /app/create hit');
    try {
        const { createApp } = await import('./commands/app');
        const config = await c.req.json();
        const result = await createApp(config);
        return c.json(apiResponse(result.success, result.message, { appDir: result.appDir }));
    } catch (error: any) {
        console.error('API: /app/create error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/delete', async (c) => {
    console.log('API: /app/delete hit');
    try {
        const { deleteApp } = await import('./commands/app');
        const { name } = await c.req.json();
        const result = await deleteApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /app/delete error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.get('/app/list', async (c) => {
    console.log('API: /app/list hit');
    try {
        const { listApps } = await import('./commands/app');
        const result = await listApps();
        return c.json(apiResponse(result.success, 'Apps listed', { apps: result.apps }));
    } catch (error: any) {
        console.error('API: /app/list error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/status', async (c) => {
    console.log('API: /app/status hit');
    try {
        const { getAppStatus } = await import('./commands/app');
        const { name } = await c.req.json();
        const result = await getAppStatus(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /app/status error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/logs', async (c) => {
    console.log('API: /app/logs hit');
    try {
        const { getAppLogs } = await import('./commands/app');
        const { name, lines } = await c.req.json();
        const result = await getAppLogs(name, lines || 50);
        return c.json(apiResponse(result.success, result.logs));
    } catch (error: any) {
        console.error('API: /app/logs error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/export-logs', async (c) => {
    console.log('API: /app/export-logs hit');
    try {
        const { exportAppLogs } = await import('./commands/app');
        const { name } = await c.req.json();
        const result = await exportAppLogs(name);
        return c.json(apiResponse(result.success, result.message, { logFile: result.logFile }));
    } catch (error: any) {
        console.error('API: /app/export-logs error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/start', async (c) => {
    console.log('API: /app/start hit');
    try {
        const { startApp } = await import('./commands/app');
        const { name } = await c.req.json();
        const result = await startApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /app/start error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/stop', async (c) => {
    console.log('API: /app/stop hit');
    try {
        const { stopApp } = await import('./commands/app');
        const { name } = await c.req.json();
        const result = await stopApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /app/stop error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/webhook-toggle', async (c) => {
    console.log('API: /app/webhook-toggle hit');
    try {
        const { setAppWebhookAutoDeploy } = await import('./commands/app');
        const { name, enabled } = await c.req.json();
        const result = await setAppWebhookAutoDeploy(name, enabled);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /app/webhook-toggle error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/restart', async (c) => {
    console.log('API: /app/restart hit');
    try {
        const { restartApp } = await import('./commands/app');
        const { name } = await c.req.json();
        const result = await restartApp(name);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /app/restart error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/versions', async (c) => {
    console.log('API: /app/versions hit');
    try {
        const { name } = await c.req.json();
        const { getVersions } = await import('./commands/version');
        const versions = await getVersions(name);
        return c.json(apiResponse(true, "", versions));
    } catch (error: any) {
        console.error('API: /app/versions error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/app/rollback', async (c) => {
    console.log('API: /app/rollback hit');
    try {
        const { name, versionId } = await c.req.json();
        const { rollback, getCurrentVersion } = await import('./commands/version');
        const { restartApp } = await import('./commands/app');

        const result = await rollback(name, parseInt(versionId));
        if (result.success) {
            // Restart the app to pick up changes
            await restartApp(name);
            return c.json(apiResponse(true, result.message));
        } else {
            return c.json(apiResponse(false, result.message));
        }
    } catch (error: any) {
        console.error('API: /app/rollback error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// Deploy history endpoint (parity with CLI `deploy history`)
api.get('/deploy/history/:appName', async (c) => {
    console.log('API: /deploy/history hit');
    try {
        const appName = c.req.param('appName');
        const { getDeploymentHistory } = await import('./commands/deploy');

        const result = await getDeploymentHistory(appName);
        return c.json(apiResponse(true, `Deployment history for ${appName}`, { history: result.history }));
    } catch (error: any) {
        console.error('API: /deploy/history error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// Health check endpoint (parity with CLI `deploy health`)
api.post('/deploy/health', async (c) => {
    console.log('API: /deploy/health hit');
    try {
        const { method, target, timeout = 30 } = await c.req.json();
        const { runHealthCheck } = await import('./commands/deploy');

        const result = await runHealthCheck(method, target, timeout);
        const success = result.exitCode === 0;

        return c.json(apiResponse(success, success ? 'Health check passed' : 'Health check failed', {
            output: result.stdout || result.stderr,
            exitCode: result.exitCode
        }));
    } catch (error: any) {
        console.error('API: /deploy/health error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// Deploy routes
api.post('/deploy/trigger', async (c) => {
    console.log('API: /deploy/trigger hit');
    try {
        const { deployApp } = await import('./commands/deploy');
        const options = await c.req.json();
        const result = await deployApp(options);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /deploy/trigger error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/deploy/rollback', async (c) => {
    console.log('API: /deploy/rollback hit');
    try {
        const { rollbackApp } = await import('./commands/deploy');
        const { appName, commitHash } = await c.req.json();
        const result = await rollbackApp(appName, commitHash);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        console.error('API: /deploy/rollback error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/deploy/history', async (c) => {
    console.log('API: /deploy/history hit');
    try {
        const { getDeploymentHistory } = await import('./commands/deploy');
        const { appName } = await c.req.json();
        const result = await getDeploymentHistory(appName);
        return c.json(apiResponse(result.success, 'Deployment history', { history: result.history }));
    } catch (error: any) {
        console.error('API: /deploy/history error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/deploy/health', async (c) => {
    console.log('API: /deploy/health hit');
    try {
        const { runHealthCheck } = await import('./commands/deploy');
        const { method, target, timeout } = await c.req.json();
        const result = await runHealthCheck(method, target, timeout || 30);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /deploy/health error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// GitHub routes
api.get('/github/status', async (c) => {
    console.log('API: /github/status hit');
    try {
        const { getConnectionStatus } = await import('./commands/github');
        const status = await getConnectionStatus();
        return c.json(apiResponse(true, status.connected ? 'Connected' : 'Not connected', status));
    } catch (error: any) {
        console.error('API: /github/status error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.get('/github/auth-url', async (c) => {
    console.log('API: /github/auth-url hit');
    try {
        const { getGitHubConfig, getAuthUrl } = await import('./commands/github');
        const config = await getGitHubConfig();

        if (!config.clientId) {
            return c.json(apiResponse(false, 'GitHub OAuth not configured. Set clientId in config.'));
        }

        // Build callback URL from request
        const host = c.req.header('host') || 'localhost:41788';
        const protocol = c.req.header('x-forwarded-proto') || 'http';
        const callbackUrl = `${protocol}://${host}/api/github/callback`;

        const authUrl = getAuthUrl(config.clientId, callbackUrl);
        return c.json(apiResponse(true, 'Auth URL generated', { authUrl, callbackUrl }));
    } catch (error: any) {
        console.error('API: /github/auth-url error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.get('/github/callback', async (c) => {
    console.log('API: /github/callback hit');
    try {
        const code = c.req.query('code');
        const error = c.req.query('error');

        if (error) {
            // Redirect to UI with error
            return c.redirect(`/github?error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return c.redirect('/github?error=no_code');
        }

        const { getGitHubConfig, exchangeCodeForToken, getGitHubUser, saveGitHubConfig } = await import('./commands/github');
        const config = await getGitHubConfig();

        if (!config.clientId || !config.clientSecret) {
            return c.redirect('/github?error=config_missing');
        }

        // Exchange code for token
        const tokenData = await exchangeCodeForToken(config.clientId, config.clientSecret, code);

        if (tokenData.error || !tokenData.accessToken) {
            return c.redirect(`/github?error=${encodeURIComponent(tokenData.error || 'token_exchange_failed')}`);
        }

        // Get user profile
        const userProfile = await getGitHubUser(tokenData.accessToken);

        // Save config with new token
        await saveGitHubConfig({
            ...config,
            accessToken: tokenData.accessToken,
            username: userProfile.login,
            connectedAt: new Date().toISOString()
        });

        console.log(`GitHub connected for user: ${userProfile.login}`);
        return c.redirect(`/github?connected=true&user=${userProfile.login}`);
    } catch (error: any) {
        console.error('API: /github/callback error:', error);
        return c.redirect(`/github?error=${encodeURIComponent(error.message)}`);
    }
});

api.get('/github/repos', async (c) => {
    console.log('API: /github/repos hit');
    try {
        const { getGitHubConfig, listRepos } = await import('./commands/github');
        const config = await getGitHubConfig();

        if (!config.accessToken) {
            return c.json(apiResponse(false, 'GitHub not connected'));
        }

        const repos = await listRepos(config.accessToken);
        return c.json(apiResponse(true, `Found ${repos.length} repositories`, { repos }));
    } catch (error: any) {
        console.error('API: /github/repos error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// Setup SSH deploy key for autonomous deploys
api.post('/github/setup-deploy-key', async (c) => {
    console.log('API: /github/setup-deploy-key hit');
    try {
        const { getGitHubConfig, hasOkastr8DeployKey, createSSHKey } = await import('./commands/github');
        const { runCommand } = await import('./utils/command');
        const { existsSync } = await import('fs');
        const { readFile } = await import('fs/promises');
        const { homedir } = await import('os');
        const { join } = await import('path');

        const config = await getGitHubConfig();
        if (!config.accessToken) {
            return c.json(apiResponse(false, 'GitHub not connected'));
        }

        // Check if key already exists in GitHub
        const keyExists = await hasOkastr8DeployKey(config.accessToken);
        if (keyExists) {
            return c.json(apiResponse(true, 'Deploy key already configured!', { alreadyExists: true }));
        }

        // Generate local key if it doesn't exist
        const sshDir = join(homedir(), '.ssh');
        const keyPath = join(sshDir, 'okastr8_deploy_key');
        const pubKeyPath = `${keyPath}.pub`;

        if (!existsSync(pubKeyPath)) {
            console.log('Generating new SSH deploy key...');
            // Create .ssh dir if needed
            await runCommand('mkdir', ['-p', sshDir]);
            await runCommand('chmod', ['700', sshDir]);

            // Generate key without passphrase
            const genResult = await runCommand('ssh-keygen', [
                '-t', 'ed25519',
                '-f', keyPath,
                '-N', '',  // Empty passphrase
                '-C', 'okastr8-deploy-key'
            ]);

            if (genResult.exitCode !== 0) {
                return c.json(apiResponse(false, `Failed to generate key: ${genResult.stderr}`));
            }
        }

        // Read public key
        const publicKey = (await readFile(pubKeyPath, 'utf-8')).trim();

        // Push to GitHub
        const hostname = await runCommand('hostname', []);
        const keyTitle = `Okastr8 Deploy Key (${hostname.stdout.trim()})`;

        const result = await createSSHKey(config.accessToken, keyTitle, publicKey);

        if (!result.success) {
            return c.json(apiResponse(false, result.message));
        }

        // Configure Git to use SSH for GitHub
        await runCommand('git', ['config', '--global', 'url.git@github.com:.insteadOf', 'https://github.com/']);

        return c.json(apiResponse(true, 'Deploy key configured successfully! ✨', { publicKey }));
    } catch (error: any) {
        console.error('API: /github/setup-deploy-key error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/github/branches', async (c) => {
    try {
        const { getGitHubConfig, listBranches } = await import('./commands/github');
        const config = await getGitHubConfig();
        if (!config.accessToken) return c.json(apiResponse(false, 'Not connected'));

        const { repoFullName } = await c.req.json();
        const branches = await listBranches(config.accessToken, repoFullName);
        return c.json(apiResponse(true, 'Branches fetched', { branches }));
    } catch (error: any) {
        console.error("API /github/branches Error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

api.post('/github/check-config', async (c) => {
    try {
        const { getGitHubConfig, checkRepoConfig } = await import('./commands/github');
        const config = await getGitHubConfig();
        if (!config.accessToken) return c.json(apiResponse(false, 'Not connected'));

        const { repoFullName, ref } = await c.req.json();
        const hasConfig = await checkRepoConfig(config.accessToken, repoFullName, ref);
        return c.json(apiResponse(true, 'Check complete', { hasConfig }));
    } catch (error: any) {
        console.error("API /github/check-config Error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

// Check if deploying to a different branch than originally configured
api.post('/github/check-branch-change', async (c) => {
    console.log('API: /github/check-branch-change hit');
    try {
        const { getAppMetadata } = await import('./commands/app');
        const { repoFullName, branch, appName } = await c.req.json();

        // Derive app name from repo if not provided
        const derivedAppName = appName || repoFullName.split('/')[1]?.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        if (!derivedAppName) {
            return c.json(apiResponse(true, 'No app name derivable', { exists: false, branchChanged: false }));
        }

        try {
            const metadata = await getAppMetadata(derivedAppName);

            // App exists - check branch
            if (metadata.gitBranch && metadata.gitBranch !== branch) {
                return c.json(apiResponse(true, 'Branch change detected', {
                    exists: true,
                    branchChanged: true,
                    currentBranch: metadata.gitBranch,
                    requestedBranch: branch,
                    appName: derivedAppName,
                    warning: `This app is currently deployed from "${metadata.gitBranch}". You selected "${branch}". Webhooks will only trigger for the new branch.`
                }));
            }

            return c.json(apiResponse(true, 'No branch change', {
                exists: true,
                branchChanged: false,
                currentBranch: metadata.gitBranch,
                appName: derivedAppName
            }));
        } catch {
            // App doesn't exist yet
            return c.json(apiResponse(true, 'New app', { exists: false, branchChanged: false, appName: derivedAppName }));
        }
    } catch (error: any) {
        console.error("API /github/check-branch-change Error:", error);
        return c.json(apiResponse(false, error.message));
    }
});

api.post('/github/import', async (c) => {
    console.log('API: /github/import hit');
    try {
        const { importRepo } = await import('./commands/github');
        const { startDeploymentStream, endDeploymentStream, streamLog } = await import('./utils/deploymentLogger');
        const { randomBytes } = await import('crypto');

        const options = await c.req.json();

        // Generate unique deployment ID
        const deploymentId = randomBytes(16).toString('hex');

        // Start the deployment stream
        startDeploymentStream(deploymentId);

        // Run deployment asynchronously
        importRepo(options, deploymentId)
            .then((result) => {
                streamLog(deploymentId, `✅ Deployment ${result.success ? 'succeeded' : 'failed'}: ${result.message}`);
                setTimeout(() => endDeploymentStream(deploymentId), 1000);
            })
            .catch((error) => {
                streamLog(deploymentId, `❌ Deployment error: ${error.message}`);
                setTimeout(() => endDeploymentStream(deploymentId), 1000);
            });

        // Return immediately with deployment ID
        return c.json(apiResponse(true, 'Deployment started', {
            deploymentId,
            message: 'Deployment started. Connect to stream for real-time logs.',
        }));
    } catch (error: any) {
        console.error('API: /github/import error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// GitHub Deployment Log Stream (SSE)
api.get('/github/deploy-stream/:deploymentId', async (c) => {
    const deploymentId = c.req.param('deploymentId');
    console.log(`[SSE] Client connecting to deployment stream: ${deploymentId}`);

    const { subscribe } = await import('./utils/deploymentLogger');

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
                safeEnqueue(encoder.encode(': heartbeat\n\n'));
            }, 5000);

            // Subscribe to deployment logs
            const unsubscribe = subscribe(deploymentId, (message: string) => {
                if (isClosed) return;

                // Check if stream should end
                if (message === '[DEPLOYMENT_STREAM_END]') {
                    // Clear heartbeat FIRST to prevent race condition
                    if (heartbeatInterval) clearInterval(heartbeatInterval);
                    isClosed = true;

                    // Now safe to send final message and close
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end' })}\n\n`));
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
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message })}\n\n`));
            });

            // Send initial connection message
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', deploymentId })}\n\n`));

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
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
});

// Cancel a running deployment
api.post('/github/cancel-deployment/:deploymentId', async (c) => {
    const deploymentId = c.req.param('deploymentId');
    console.log(`API: /github/cancel-deployment hit for: ${deploymentId}`);

    try {
        const { cancelDeployment, endDeploymentStream } = await import('./utils/deploymentLogger');

        const cancelled = cancelDeployment(deploymentId);

        if (cancelled) {
            // End the stream after a short delay to allow the cancel message to be sent
            setTimeout(() => endDeploymentStream(deploymentId), 500);
            return c.json(apiResponse(true, 'Deployment cancelled'));
        } else {
            return c.json(apiResponse(false, 'Deployment not found or already completed'));
        }
    } catch (error: any) {
        console.error('API: /github/cancel-deployment error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

api.post('/github/disconnect', async (c) => {
    console.log('API: /github/disconnect hit');
    try {
        const { disconnectGitHub } = await import('./commands/github');
        await disconnectGitHub();
        return c.json(apiResponse(true, 'GitHub disconnected'));
    } catch (error: any) {
        console.error('API: /github/disconnect error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

// GitHub Webhook Handler
api.post('/github/webhook', async (c) => {
    try {
        const { getSystemConfig } = await import('./config');
        const { listApps, updateApp } = await import('./commands/app');

        const config = await getSystemConfig();
        const secret = config.manager?.github?.webhook_secret;

        if (!secret) {
            return c.text('Webhook secret not configured', 500);
        }

        const signature = c.req.header('X-Hub-Signature-256');
        if (!signature) {
            return c.text('Signature missing', 401);
        }

        const payload = await c.req.text();

        // Verify Signature
        const hmac = createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(payload).digest('hex');

        const sigBuffer = Buffer.from(signature);
        const digestBuffer = Buffer.from(digest);

        if (sigBuffer.length !== digestBuffer.length || !timingSafeEqual(sigBuffer, digestBuffer)) {
            console.error('Webhook signature mismatch');
            return c.text('Invalid signature', 401);
        }

        const event = JSON.parse(payload);

        // Only handle push events for now
        const githubEvent = c.req.header('X-GitHub-Event');
        if (githubEvent !== 'push') {
            return c.json({ ignored: true, message: 'Not a push event' });
        }

        const repoUrl = event.repository?.clone_url;
        const repoName = event.repository?.full_name;

        if (!repoUrl) return c.json({ ignored: true, message: 'No repository info' });

        // Look for matching app
        // Apps store `gitRepo`. We match against that.
        const { apps } = await listApps();

        // Simple matching strategy
        // TODO: We should probably store repo ID to be precise, but clone_url is fine unique identifier usually.
        const targetApp = apps.find(a =>
            a.gitRepo === repoUrl ||
            (a.gitRepo && a.gitRepo.includes(repoName))
        );

        if (targetApp) {
            // Check Auto-Deploy Flag
            if (targetApp.webhookAutoDeploy === false) {
                console.log(`⚠️ Auto-deploy disabled for ${targetApp.name}. Ignoring webhook.`);
                return c.json({ ignored: true, message: 'Auto-deploy disabled for this app' });
            }

            console.log(`Webhook trigger: Auto-deploying ${targetApp.name}...`);

            // Check branch if possible
            if (targetApp.gitBranch && event.ref) {
                const pushRef = event.ref; // e.g., "refs/heads/main"
                const appRef = `refs/heads/${targetApp.gitBranch}`;
                if (!pushRef.endsWith(targetApp.gitBranch)) {
                    console.log(`Webhook ignored: Push to ${pushRef} does not match app branch ${targetApp.gitBranch}`);
                    return c.json({ ignored: true, message: `Branch mismatch: ${pushRef} != ${targetApp.gitBranch}` });
                }
            }

            // Trigger Update (async)
            updateApp(targetApp.name)
                .then(res => console.log(`✅ Auto-deploy ${targetApp.name} complete:`, res.message))
                .catch(err => console.error(`❌ Auto-deploy ${targetApp.name} failed:`, err));

            return c.json({ success: true, app: targetApp.name, message: 'Deployment triggered' });
        }

        console.log(`Webhook ignored: No app found matching ${repoName}`);
        return c.json({ ignored: true, message: `No app found for ${repoName}` });

    } catch (error: any) {
        console.error('API: /github/webhook error:', error);
        return c.text(error.message, 500);
    }
});

// ============ Auth Endpoints ============

// Verify token and set session cookie
api.post('/auth/verify', async (c) => {
    try {
        const body = await c.req.json();
        const { token } = body;

        if (!token) {
            return c.json(apiResponse(false, 'Token is required'), 400);
        }

        const {
            validateToken,
            isLoginApprovalRequired,
            isTrustedUser,
            createPendingApproval,
            isCurrentUserAdmin,
            getAdminUser
        } = await import('./commands/auth');

        const result = await validateToken(token);

        if (!result.valid) {
            return c.json(apiResponse(false, result.error || 'Invalid token'), 401);
        }

        // Check if login approval is needed
        const needsApproval = await isLoginApprovalRequired();
        const isAdmin = result.userId === (await getAdminUser()); // Basic check
        const isTrusted = await isTrustedUser(result.userId || '');

        if (needsApproval && !isAdmin && !isTrusted) {
            console.log(`Login approval required for ${result.userId}`);

            // Create pending approval
            const approval = await createPendingApproval(result.userId!, token);

            // Send email to admin
            const { sendLoginApprovalEmail } = await import('./services/email');
            await sendLoginApprovalEmail(
                result.userId!,
                approval.id,
                new Date(approval.requestedAt).toLocaleString()
            );

            return c.json(apiResponse(true, 'Approval required', {
                pendingApproval: true,
                requestId: approval.id,
                userId: result.userId
            }));
        }

        // Set session cookie (httpOnly for security)
        const cookieOpts = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400';
        c.header('Set-Cookie', `okastr8_session=${token}; ${cookieOpts}`);

        return c.json(apiResponse(true, 'Authenticated', {
            userId: result.userId
        }));
    } catch (error: any) {
        console.error('API /auth/verify error:', error);
        return c.json(apiResponse(false, error.message), 500);
    }
});

// Check approval status
api.get('/auth/approval/:id', async (c) => {
    try {
        const requestId = c.req.param('id');
        const { checkApprovalStatus } = await import('./commands/auth');

        const result = await checkApprovalStatus(requestId);

        if (!result.found) {
            return c.json(apiResponse(false, 'Request not found'), 404);
        }

        if (result.status === 'approved' && result.token) {
            // Set session cookie
            const cookieOpts = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400';
            c.header('Set-Cookie', `okastr8_session=${result.token}; ${cookieOpts}`);

            return c.json(apiResponse(true, 'Approved', { status: 'approved' }));
        }

        return c.json(apiResponse(true, 'Status check', { status: result.status }));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message), 500);
    }
});

// Get current session info
api.get('/auth/me', async (c) => {
    try {
        // Extract token from cookie
        const cookie = c.req.header('Cookie');
        let token = null;
        if (cookie) {
            const match = cookie.match(/okastr8_session=([^;]+)/);
            if (match && match[1]) {
                token = match[1];
            }
        }

        if (!token) {
            return c.json(apiResponse(false, 'Not authenticated'), 401);
        }

        const { validateToken } = await import('./commands/auth');
        const result = await validateToken(token);

        if (!result.valid) {
            return c.json(apiResponse(false, result.error || 'Invalid session'), 401);
        }

        return c.json(apiResponse(true, 'Session valid', {
            userId: result.userId
        }));
    } catch (error: any) {
        console.error('API /auth/me error:', error);
        return c.json(apiResponse(false, error.message), 500);
    }
});

// Logout (clear session cookie)
api.post('/auth/logout', async (c) => {
    c.header('Set-Cookie', 'okastr8_session=; Path=/; HttpOnly; Max-Age=0');
    return c.json(apiResponse(true, 'Logged out'));
});

// Revoke all tokens (Emergency)
api.post('/auth/revoke-all', async (c) => {
    const { revokeAllTokens } = await import('./commands/auth');
    const count = await revokeAllTokens();
    return c.json(apiResponse(true, `Revoked ${count} tokens. All sessions invalidated.`));
});

// ================ Global Service Controls ================

api.post('/services/start-all', async (c) => {
    const { controlAllServices } = await import('./commands/system');
    await controlAllServices('start');
    return c.json(apiResponse(true, 'Initiated start sequence for all services'));
});

api.post('/services/stop-all', async (c) => {
    const { controlAllServices } = await import('./commands/system');
    await controlAllServices('stop');
    return c.json(apiResponse(true, 'Initiated stop sequence for all services'));
});

api.post('/services/restart-all', async (c) => {
    const { controlAllServices } = await import('./commands/system');
    await controlAllServices('restart');
    return c.json(apiResponse(true, 'Initiated restart sequence for all services'));
});
// ================ Tunnel Controls ================

api.get('/tunnel/status', async (c) => {
    try {
        const { getTunnelStatus } = await import('./commands/tunnel');
        const status = await getTunnelStatus();
        return c.json(apiResponse(true, 'Tunnel status', status));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.post('/tunnel/setup', async (c) => {
    try {
        const { installTunnel } = await import('./commands/tunnel');
        const { token } = await c.req.json();

        if (!token) return c.json(apiResponse(false, 'Token is required'));

        const result = await installTunnel(token);
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.post('/tunnel/uninstall', async (c) => {
    try {
        const { uninstallTunnel } = await import('./commands/tunnel');
        const result = await uninstallTunnel();
        return c.json(apiResponse(result.success, result.message));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

// ================ Access User Management ================

api.get('/access/list', async (c) => {
    try {
        const { listUsers } = await import('./commands/auth');
        const users = await listUsers();
        // Hide tokens if present in basic list, return safe view
        const safeUsers = users.map(u => ({
            email: u.email,
            createdAt: u.createdAt,
            createdBy: u.createdBy
        }));
        return c.json(apiResponse(true, 'Access Users', { users: safeUsers }));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.get('/access/tokens', async (c) => {
    try {
        const { listTokens } = await import('./commands/auth');
        const tokens = await listTokens();
        const tokenList = tokens.map(t => ({
            userId: t.userId,
            tokenId: t.id,
            expiresAt: t.expiresAt
        }));
        return c.json(apiResponse(true, 'Active Tokens', { tokens: tokenList }));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

api.post('/access/revoke-token', async (c) => {
    try {
        const { revokeToken } = await import('./commands/auth');
        const { tokenId } = await c.req.json();
        const success = await revokeToken(tokenId);
        return c.json(apiResponse(success, success ? 'Token revoked' : 'Token not found'));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

// Revoke all tokens for a user (wrapper around removing user basically, or filtering listTokens)
api.post('/access/revoke-user', async (c) => {
    try {
        const { listTokens, revokeToken } = await import('./commands/auth');
        const { email } = await c.req.json();

        const allTokens = await listTokens();
        const userTokens = allTokens.filter(t => t.userId === email);

        if (userTokens.length === 0) {
            return c.json(apiResponse(false, 'No active tokens found for user'));
        }

        let count = 0;
        for (const t of userTokens) {
            await revokeToken(t.id);
            count++;
        }

        return c.json(apiResponse(true, `Revoked ${count} tokens for ${email}`));
    } catch (error: any) {
        return c.json(apiResponse(false, error.message));
    }
});

export default api;