import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';
import {
    createUser,
    deleteUser,
    getLastLogin,
    listGroups,
    listUsers,
    lockUser,
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

const api = new Hono();

// Helper for consistent API responses
const apiResponse = (success: boolean, message: string, data?: any) => ({
    success,
    message,
    data,
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
        const host = c.req.header('host') || 'localhost:8788';
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
            return c.redirect(`/github.html?error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return c.redirect('/github.html?error=no_code');
        }

        const { getGitHubConfig, exchangeCodeForToken, getGitHubUser, saveGitHubConfig } = await import('./commands/github');
        const config = await getGitHubConfig();

        if (!config.clientId || !config.clientSecret) {
            return c.redirect('/github.html?error=not_configured');
        }

        // Exchange code for token
        const tokenResult = await exchangeCodeForToken(config.clientId, config.clientSecret, code);

        if (tokenResult.error || !tokenResult.accessToken) {
            return c.redirect(`/github.html?error=${encodeURIComponent(tokenResult.error || 'token_exchange_failed')}`);
        }

        // Get user info
        const user = await getGitHubUser(tokenResult.accessToken);

        // Save to config
        await saveGitHubConfig({
            accessToken: tokenResult.accessToken,
            username: user.login,
            connectedAt: new Date().toISOString(),
        });

        // Redirect to UI with success
        return c.redirect(`/github.html?connected=true&user=${encodeURIComponent(user.login)}`);
    } catch (error: any) {
        console.error('API: /github/callback error:', error);
        return c.redirect(`/github.html?error=${encodeURIComponent(error.message)}`);
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

api.post('/github/import', async (c) => {
    console.log('API: /github/import hit');
    try {
        const { importRepo } = await import('./commands/github');
        const options = await c.req.json();
        const result = await importRepo(options);
        return c.json(apiResponse(result.success, result.message, {
            appName: result.appName,
            config: result.config,
        }));
    } catch (error: any) {
        console.error('API: /github/import error:', error);
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
            console.log(`🚀 Webhook trigger: Auto-deploying ${targetApp.name}...`);

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

export default api;