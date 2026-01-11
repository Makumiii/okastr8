import { Command } from 'commander';
import { runCommand } from '../utils/command';
import * as path from 'path';
import { userInfo } from 'os';
import { loadAuthData } from './auth';

const SCRIPT_BASE_PATH = path.join(process.cwd(), 'scripts', 'user');

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
    return await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'listUsers.sh')]);
}

export async function lockUser(username: string) {
    return await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'lockUser.sh'), username]);
}

export async function unlockUser(username: string) {
    return await runCommand('sudo', [path.join(SCRIPT_BASE_PATH, 'unlockUser.sh'), username]);
}

// Commander Integration
export function addUserCommands(program: Command) {
    const user = program.command('user').description('Manage system users');

    user.command('create')
        .description('Create a new system user')
        .argument('[username]', 'Username for the new user')
        .argument('[password]', 'Password for the new user')
        .option('-d, --distro <distro>', 'Distribution type (fedora or debian)')
        .action(async (usernameArg, passwordArg, options) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const enquirer = await import('enquirer') as any;
            const Input = enquirer.Input || enquirer.default?.Input;
            const Password = enquirer.Password || enquirer.default?.Password;

            let username = usernameArg;
            let password = passwordArg;

            // Interactive Username
            if (!username) {
                const prompt = new Input({
                    name: 'username',
                    message: 'Enter username for the new user:'
                });
                username = await prompt.run();
            }

            if (!username) {
                console.error('❌ Username is required.');
                return;
            }

            // Interactive Password
            if (!password) {
                const prompt = new Password({
                    name: 'password',
                    message: 'Enter password (leave empty to use username):'
                });
                password = await prompt.run();
            }

            // Default password to username if still empty
            if (!password) {
                password = username;
                console.log(`ℹ️  No password provided, using username '${username}' as password.`);
            }

            console.log(`\n👷 Creating user '${username}'...`);
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
        .description('Manage system users interactively')
        .option('--plain', 'Show plain list (non-interactive)')
        .action(async (options) => {
            const result = await listUsers();
            if (result.exitCode !== 0) {
                console.error(`❌ Error listing users: ${result.stderr}`);
                return;
            }

            const rawOutput = result.stdout.trim();
            if (!rawOutput) {
                console.log('No users found.');
                return;
            }

            // Parse output: username:status
            const users = rawOutput.split('\n').map(line => {
                const [username, status] = line.split(':');
                return { username: username!, status: status as 'active' | 'locked' };
            });

            if (options.plain) {
                console.log('\n👥 System Users\n');
                users.forEach(u => {
                    const icon = u.status === 'locked' ? '🔒' : '✅';
                    console.log(`${icon} ${u.username} (${u.status})`);
                });
                return;
            }

            // Interactive Mode
            try {
                // Load admin info
                const authData = await loadAuthData();
                const adminUser = authData.admin;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const enquirer = await import('enquirer') as any;
                const AutoComplete = enquirer.AutoComplete || enquirer.default?.AutoComplete;
                const Select = enquirer.Select || enquirer.default?.Select;
                const Confirm = enquirer.Confirm || enquirer.default?.Confirm;

                // 1. Select User
                const prompt = new AutoComplete({
                    name: 'user',
                    message: 'Select a user to manage',
                    choices: users.map(u => {
                        let icon = u.status === 'locked' ? '🔒' : '✅';
                        if (u.username === adminUser) icon = '👑'; // Admin Icon

                        return {
                            name: u.username,
                            message: `${icon} ${u.username}`
                        };
                    })
                });

                const selectedUsername = await prompt.run();
                const selectedUser = users.find(u => u.username === selectedUsername)!;

                // SPECIAL HANDLING: Admin Block
                if (selectedUsername === adminUser) {
                    console.log(`\n👑 Admin Account (${selectedUsername})`);
                    console.log('   This is the main system administrator.');
                    console.log('   Actions are restricted to prevent lockout.\n');
                    return;
                }

                // 2. Select Action
                const actionPrompt = new Select({
                    name: 'action',
                    message: `Action for ${selectedUsername}:`,
                    choices: [
                        {
                            name: 'lock_unlock',
                            message: selectedUser.status === 'locked' ? '🔓 Unlock Account' : '🔒 Lock Account'
                        },
                        { name: 'info', message: 'ℹ️  View Details (Groups, Last Login)' },
                        { name: 'delete', message: '❌ Delete User' },
                        { name: 'cancel', message: '↩️  Cancel' }
                    ]
                });

                const action = await actionPrompt.run();

                if (action === 'cancel') {
                    console.log('Cancelled.');
                    return;
                }

                if (action === 'info') {
                    console.log(`\nGathering info for ${selectedUsername}...\n`);
                    const login = await getLastLogin(selectedUsername);
                    const groups = await listGroups(selectedUsername);

                    console.log('🕒 Last Login:');
                    console.log(login.stdout.trim() || 'Never');
                    console.log('\n👥 Groups:');
                    console.log(groups.stdout.trim());
                }

                if (action === 'lock_unlock') {
                    if (selectedUser.status === 'locked') {
                        console.log(`🔓 Unlocking ${selectedUsername}...`);
                        await unlockUser(selectedUsername);
                        console.log('✅ User unlocked.');
                    } else {
                        // Guardrail: Don't lock admin/self
                        const authData = await loadAuthData();
                        const realUser = process.env.SUDO_USER || userInfo().username;

                        if (selectedUsername === authData.admin || selectedUsername === realUser) {
                            console.log(`\n⚠️  Security Alert: You cannot lock the admin/current user (${selectedUsername}).\n`);
                            return;
                        }

                        console.log(`🔒 Locking ${selectedUsername}...`);
                        await lockUser(selectedUsername);
                        console.log('✅ User locked.');
                    }
                }

                if (action === 'delete') {
                    // Guardrail: Don't delete admin/self
                    const authData = await loadAuthData();
                    const realUser = process.env.SUDO_USER || userInfo().username;

                    if (selectedUsername === authData.admin || selectedUsername === realUser) {
                        console.log(`\n⚠️  Security Alert: You cannot delete the admin/current user (${selectedUsername}).\n`);
                        return;
                    }

                    const confirm = new Confirm({
                        name: 'sure',
                        message: `⚠️  Are you SURE you want to DELETE user '${selectedUsername}'? This creates a backup but is destructive.`
                    });

                    if (await confirm.run()) {
                        console.log(`🗑️  Deleting ${selectedUsername}...`);
                        await deleteUser(selectedUsername);
                        console.log('✅ User deleted.');
                    } else {
                        console.log('Cancelled.');
                    }
                }

            } catch (error: any) {
                console.log(''); // Newline on exit
            }
        });

    user.command('lock')
        .description('Lock a user account')
        .argument('<username>', 'Username of the user to lock')
        .action(async (username) => {
            const result = await lockUser(username);
            console.log(result.stdout || result.stderr);
        });
}