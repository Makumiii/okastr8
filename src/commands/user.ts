import { Command } from 'commander';
import { runCommand } from '../utils/command';
import * as path from 'path';

const SCRIPT_BASE_PATH = path.join(process.cwd(), 'scripts', 'user');

export function addUserCommands(program: Command) {
  const user = program.command('user').description('Manage system users');

  user.command('create')
    .description('Create a new system user')
    .argument('<username>', 'Username for the new user')
    .argument('[password]', 'Password for the new user (defaults to username)')
    .option('-d, --distro <distro>', 'Distribution type (fedora or debian)')
    .action(async (username, password, options) => {
      const distro = options.distro || '';
      await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'create-user.sh'), username, password || username, distro]);
    });

  user.command('delete')
    .description('Delete a system user')
    .argument('<username>', 'Username of the user to delete')
    .action(async (username) => {
      await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'delete-user.sh'), username]);
    });

  user.command('last-login')
    .description('Show last login time for a user')
    .argument('<username>', 'Username to check last login for')
    .action(async (username) => {
      await runCommand(path.join(SCRIPT_BASE_PATH, 'lastLogin.sh'), [username]);
    });

  user.command('list-groups')
    .description('List groups for a user')
    .argument('<username>', 'Username to list groups for')
    .action(async (username) => {
      await runCommand(path.join(SCRIPT_BASE_PATH, 'listGroups.sh'), [username]);
    });

  user.command('list-users')
    .description('List all normal system users')
    .action(async () => {
      await runCommand(path.join(SCRIPT_BASE_PATH, 'listUsers.sh'), []);
    });

  user.command('lock')
    .description('Lock a user account')
    .argument('<username>', 'Username of the user to lock')
    .action(async (username) => {
      await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'lockUser.sh'), username]);
    });

  user.command('switch')
    .description('Switch to another user')
    .argument('<username>', 'Username to switch to')
    .action(async (username) => {
      await runCommand(path.join(SCRIPT_BASE_PATH, 'switch-user.sh'), [username]);
    });
}
