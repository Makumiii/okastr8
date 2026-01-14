import { Command } from 'commander';
import { runCommand } from '../utils/command';
import * as path from 'path';

const SCRIPT_BASE_PATH = path.join(process.cwd(), 'scripts', 'systemd');

// Core Functions
// Core Functions

// Helper to check if service exists (to match script behavior of failing if not found)
async function serviceExists(service_name: string): Promise<boolean> {
    const serviceFile = `/etc/systemd/system/${service_name}.service`;
    const { runCommand } = await import('../utils/command');
    // We can use 'test -f' via sudo to check existence
    const result = await runCommand('sudo', ['test', '-f', serviceFile]);
    return result.exitCode === 0;
}

export async function createService(service_name: string, description: string, exec_start: string, working_directory: string, user: string, wanted_by: string, auto_start: boolean) {
    // create.sh does complex file writing, keeping it as script for now but guarding with existence check might be needed?
    // Actually, create.sh is likely the most problematic if not whitelisted.
    // Ideally we rewrite this to use 'tee' or similar, but let's stick to the critical fixes first.
    return await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'create.sh'),
        service_name,
        description,
        exec_start,
        working_directory,
        user,
        wanted_by,
    auto_start ? 'true' : 'false'
    ]);
}

export async function deleteService(service_name: string) {
    // delete.sh just enables and removes file.
    // Let's do it manually to be safe.
    await stopService(service_name).catch(() => { });
    await disableService(service_name).catch(() => { });

    // Remove file
    const result = await runCommand('sudo', ['rm', '-f', `/etc/systemd/system/${service_name}.service`]);
    await reloadDaemon();
    return result;
}

export async function startService(service_name: string) {
    return await runCommand('sudo', ['systemctl', 'start', service_name]);
}

export async function stopService(service_name: string) {
    return await runCommand('sudo', ['systemctl', 'stop', service_name]);
}

export async function restartService(service_name: string) {
    return await runCommand('sudo', ['systemctl', 'restart', service_name]);
}

export async function statusService(service_name: string) {
    // Replicating status.sh logic
    if (!(await serviceExists(service_name))) {
        return { exitCode: 4, stdout: "", stderr: `Error: Service file not found at /etc/systemd/system/${service_name}.service\n` };
    }

    const isActive = await runCommand('sudo', ['systemctl', 'is-active', '--quiet', service_name]);
    if (isActive.exitCode === 0) {
        return { exitCode: 0, stdout: `✅ ${service_name} is running\n`, stderr: "" };
    }

    const isFailed = await runCommand('sudo', ['systemctl', 'is-failed', '--quiet', service_name]);
    if (isFailed.exitCode === 0) { // is-failed returns 0 if failed
        return { exitCode: 2, stdout: `❌ ${service_name} has failed\n`, stderr: "" };
    }

    return { exitCode: 3, stdout: `⏹️  ${service_name} is stopped\n`, stderr: "" };
}

export async function logsService(service_name: string) {
    return await runCommand('sudo', ['journalctl', '-u', service_name, '-n', '50', '--no-pager']);
}

export async function enableService(service_name: string) {
    return await runCommand('sudo', ['systemctl', 'enable', service_name]);
}

export async function disableService(service_name: string) {
    return await runCommand('sudo', ['systemctl', 'disable', service_name]);
}

export async function reloadDaemon() {
    return await runCommand('sudo', ['systemctl', 'daemon-reload']);
}

export async function listServices() {
    // ls requires read permission on /etc/systemd/system
    // sudo ls is likely safe
    return await runCommand('sudo', ['ls', '/etc/systemd/system/okastr8-*.service']);
}


// Commander Integration
export function addSystemdCommands(program: Command) {
    const systemd = program.command('systemd').description('Manage systemd services');

    systemd.command('create')
        .description('Create a systemd service unit file')
        .argument('<service_name>', 'Name of the service')
        .argument('<description>', 'Description of the service')
        .argument('<exec_start>', 'Command to execute')
        .argument('<working_directory>', 'Working directory for the service')
        .argument('<user>', 'User to run the service as')
        .argument('<wanted_by>', 'Target to be wanted by (e.g., multi-user.target)')
        .option('-a, --auto-start <boolean>', 'Whether to enable and start the service automatically (default: true)', 'true')
        .action(async (service_name, description, exec_start, working_directory, user, wanted_by, options) => {
            const result = await createService(service_name, description, exec_start, working_directory, user, wanted_by, options.autoStart === 'true');
            console.log(result.stdout || result.stderr);
        });

    systemd.command('delete')
        .description('Delete a systemd service unit file')
        .argument('<service_name>', 'Name of the service to delete')
        .action(async (service_name) => {
            const result = await deleteService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('start')
        .description('Start a systemd service')
        .argument('<service_name>', 'Name of the service to start')
        .action(async (service_name) => {
            const result = await startService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('stop')
        .description('Stop a systemd service')
        .argument('<service_name>', 'Name of the service to stop')
        .action(async (service_name) => {
            const result = await stopService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('restart')
        .description('Restart a systemd service')
        .argument('<service_name>', 'Name of the service to restart')
        .action(async (service_name) => {
            const result = await restartService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('status')
        .description('Show the status of a systemd service')
        .argument('<service_name>', 'Name of the service to check status')
        .action(async (service_name) => {
            const result = await statusService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('logs')
        .description('Show the last 50 log lines for a systemd service')
        .argument('<service_name>', 'Name of the service to show logs for')
        .action(async (service_name) => {
            const result = await logsService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('enable')
        .description('Enable a systemd service')
        .argument('<service_name>', 'Name of the service to enable')
        .action(async (service_name) => {
            const result = await enableService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('disable')
        .description('Disable a systemd service')
        .argument('<service_name>', 'Name of the service to disable')
        .action(async (service_name) => {
            const result = await disableService(service_name);
            console.log(result.stdout || result.stderr);
        });

    systemd.command('reload')
        .description('Reload the systemd daemon')
        .action(async () => {
            const result = await reloadDaemon();
            console.log(result.stdout || result.stderr);
        });

    systemd.command('list')
        .description('List all okastr8 systemd service files')
        .action(async () => {
            const result = await listServices();
            console.log(result.stdout || result.stderr);
        });
}
