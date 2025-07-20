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
        const { env_json_path } = await c.req.json();
        const result = await orchestrateEnvironment(env_json_path);
        return c.json(apiResponse(result.exitCode === 0, result.stdout || result.stderr));
    } catch (error: any) {
        console.error('API: /orchestrate error:', error);
        return c.json(apiResponse(false, error.message || 'Internal Server Error'));
    }
});

export default api;