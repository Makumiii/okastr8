import { Command } from 'commander';
import { runCommand } from '../utils/command';
import * as path from 'path';

const SCRIPT_BASE_PATH = path.join(process.cwd(), '..', '..', 'scripts', 'user');

// Core Functions
export async function createUser(username: string, password?: string, distro?: string) {
    return await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'create-user.sh'), username, password || username, distro || '']);
}

export async function deleteUser(username: string) {
    return await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'delete-user.sh'), username]);
}

export async function getLastLogin(username: string) {
    return await runCommand(path.join(SCRIPT_BASE_PATH, 'lastLogin.sh'), [username]);
}

export async function listGroups(username: string) {
    return await runCommand(path.join(SCRIPT_BASE_PATH, 'listGroups.sh'), [username]);
}

export async function listUsers() {
    return await runCommand(path.join(SCRIPT_BASE_PATH, 'listUsers.sh'), []);
}

export async function lockUser(username: string) {
    return await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'lockUser.sh'), username]);
}

export async function switchUser(username: string) {
    return await runCommand(path.join(SCRIPT_BASE_PATH, 'switch-user.sh'), [username]);
}


// Commander Integration
export function addUserCommands(program: Command) {
  const user = program.command('user').description('Manage system users');

  user.command('create')
    .description('Create a new system user')
    .argument('<username>', 'Username for the new user')
    .argument('[password]', 'Password for the new user (defaults to username)')
    .option('-d, --distro <distro>', 'Distribution type (fedora or debian)')
    .action(async (username, password, options) => {
        const result = await createUser(username, password, options.distro);
        console.log(result.stdout || result.stderr);
    });

  user.command('delete')
    .description('Delete a system user')
    .argument('<username>', 'Username of the user to delete')
    .action(async (username) => {
        const result = await deleteUser(username);
        console.log(result.stdout || result.stderr);
    });

  user.command('last-login')
    .description('Show last login time for a user')
    .argument('<username>', 'Username to check last login for')
    .action(async (username) => {
        const result = await getLastLogin(username);
        console.log(result.stdout || result.stderr);
    });

  user.command('list-groups')
    .description('List groups for a user')
    .argument('<username>', 'Username to list groups for')
    .action(async (username) => {
        const result = await listGroups(username);
        console.log(result.stdout || result.stderr);
    });

  user.command('list-users')
    .description('List all normal system users')
    .action(async () => {
        const result = await listUsers();
        console.log(result.stdout || result.stderr);
    });

  user.command('lock')
    .description('Lock a user account')
    .argument('<username>', 'Username of the user to lock')
    .action(async (username) => {
        const result = await lockUser(username);
        console.log(result.stdout || result.stderr);
    });

  user.command('switch')
    .description('Switch to another user')
    .argument('<username>', 'Username to switch to')
    .action(async (username) => {
        const result = await switchUser(username);
        console.log(result.stdout || result.stderr);
    });
}