import { Command } from 'commander';
import { runCommand } from '../utils/command';

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
      const auto_start = options.autoStart === 'true' ? 'true' : 'false';
      await runCommand(`sudo scripts/systemd/create.sh "${service_name}" "${description}" "${exec_start}" "${working_directory}" "${user}" "${wanted_by}" "${auto_start}"`);
    });

  systemd.command('delete')
    .description('Delete a systemd service unit file')
    .argument('<service_name>', 'Name of the service to delete')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/delete.sh "${service_name}"`);
    });

  systemd.command('start')
    .description('Start a systemd service')
    .argument('<service_name>', 'Name of the service to start')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/start.sh "${service_name}"`);
    });

  systemd.command('stop')
    .description('Stop a systemd service')
    .argument('<service_name>', 'Name of the service to stop')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/stop.sh "${service_name}"`);
    });

  systemd.command('restart')
    .description('Restart a systemd service')
    .argument('<service_name>', 'Name of the service to restart')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/restart.sh "${service_name}"`);
    });

  systemd.command('status')
    .description('Show the status of a systemd service')
    .argument('<service_name>', 'Name of the service to check status')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/status.sh "${service_name}"`);
    });

  systemd.command('logs')
    .description('Show the last 50 log lines for a systemd service')
    .argument('<service_name>', 'Name of the service to show logs for')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/logs.sh "${service_name}"`);
    });

  systemd.command('enable')
    .description('Enable a systemd service')
    .argument('<service_name>', 'Name of the service to enable')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/enable.sh "${service_name}"`);
    });

  systemd.command('disable')
    .description('Disable a systemd service')
    .argument('<service_name>', 'Name of the service to disable')
    .action(async (service_name) => {
      await runCommand(`sudo scripts/systemd/disable.sh "${service_name}"`);
    });

  systemd.command('reload')
    .description('Reload the systemd daemon')
    .action(async () => {
      await runCommand(`sudo scripts/systemd/reload.sh`);
    });

  systemd.command('list')
    .description('List all okastr8 systemd service files')
    .action(async () => {
      await runCommand(`sudo scripts/systemd/list.sh`);
    });
}
