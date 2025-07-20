import { Hono } from 'hono';
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

const api = new Hono();

// User routes
api.post('/user/create', async (c) => {
    const { username, password, distro } = await c.req.json();
    const result = await createUser(username, password, distro);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/user/delete', async (c) => {
    const { username } = await c.req.json();
    const result = await deleteUser(username);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/user/last-login', async (c) => {
    const { username } = await c.req.json();
    const result = await getLastLogin(username);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/user/list-groups', async (c) => {
    const { username } = await c.req.json();
    const result = await listGroups(username);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.get('/user/list-users', async (c) => {
    const result = await listUsers();
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/user/lock', async (c) => {
    const { username } = await c.req.json();
    const result = await lockUser(username);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

// Systemd routes
api.post('/systemd/create', async (c) => {
    const { service_name, description, exec_start, working_directory, user, wanted_by, auto_start } = await c.req.json();
    const result = await createService(service_name, description, exec_start, working_directory, user, wanted_by, auto_start);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/delete', async (c) => {
    const { service_name } = await c.req.json();
    const result = await deleteService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/start', async (c) => {
    const { service_name } = await c.req.json();
    const result = await startService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/stop', async (c) => {
    const { service_name } = await c.req.json();
    const result = await stopService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/restart', async (c) => {
    const { service_name } = await c.req.json();
    const result = await restartService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/status', async (c) => {
    const { service_name } = await c.req.json();
    const result = await statusService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/logs', async (c) => {
    const { service_name } = await c.req.json();
    const result = await logsService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/enable', async (c) => {
    const { service_name } = await c.req.json();
    const result = await enableService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.post('/systemd/disable', async (c) => {
    const { service_name } = await c.req.json();
    const result = await disableService(service_name);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.get('/systemd/reload', async (c) => {
    const result = await reloadDaemon();
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

api.get('/systemd/list', async (c) => {
    const result = await listServices();
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

// Orchestrate route
api.post('/orchestrate', async (c) => {
    const { env_json_path } = await c.req.json();
    const result = await orchestrateEnvironment(env_json_path);
    return c.json({ success: result.exitCode === 0, message: result.stdout || result.stderr });
});

export default api;
