/**
 * User Management CLI Commands
 * Add, remove, and manage user permissions
 */

import { Command } from 'commander';
import {
    addUser,
    removeUser,
    updateUserPermissions,
    listUsers as listUsersData,
    getUser,
    generateToken,
    isCurrentUserAdmin,
    revokeToken,
    listTokens
} from './auth';
import { isValidPermission, getAllPermissions, getPermissionDescription, PERMISSIONS } from '../permissions';

// Generate help text from registry
function getPermissionHelp(): string {
    const lines = ['\nAvailable permissions:'];
    for (const [key, desc] of Object.entries(PERMISSIONS)) {
        lines.push(`  ${key.padEnd(18)} ${desc}`);
    }
    lines.push('\n  deploy:<app>      Deploy specific app (e.g., deploy:my-app)');
    return lines.join('\n');
}

function validatePermissions(perms: string[]): { valid: boolean; invalid: string[] } {
    const invalid: string[] = [];
    for (const p of perms) {
        if (!isValidPermission(p)) {
            invalid.push(p);
        }
    }
    return { valid: invalid.length === 0, invalid };
}

// ============ Role Presets ============
const ROLE_PRESETS: Record<string, { name: string; permissions: string[]; description: string }> = {
    viewer: {
        name: 'Viewer',
        permissions: ['view:*'],
        description: 'Read-only access to dashboard, metrics, logs'
    },
    deployer: {
        name: 'Deployer',
        permissions: ['view:*', 'deploy:*', 'app:restart', 'app:rollback'],
        description: 'Can deploy, restart, and rollback apps'
    },
    developer: {
        name: 'Developer',
        permissions: ['view:*', 'deploy:*', 'app:*', 'github:manage'],
        description: 'Full app management including create/delete'
    },
    admin: {
        name: 'Admin',
        permissions: ['*'],
        description: 'Full access to everything'
    }
};

// Interactive permission picker using enquirer multiselect
async function interactivePermissionPicker(): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enquirer = await import('enquirer') as any;
    const Select = enquirer.Select || enquirer.default?.Select;
    const MultiSelect = enquirer.MultiSelect || enquirer.default?.MultiSelect;

    // First, ask if they want a preset or custom
    const modePrompt = new Select({
        name: 'mode',
        message: 'How would you like to assign permissions?',
        choices: [
            { name: 'viewer', message: 'Viewer - Read-only access' },
            { name: 'deployer', message: 'Deployer - Deploy, restart, rollback' },
            { name: 'developer', message: 'Developer - Full app management' },
            { name: 'admin', message: 'Admin - Full access to everything' },
            { name: 'custom', message: 'Custom - Pick individual permissions' }
        ]
    });

    const mode = await modePrompt.run();

    // If preset, return those permissions
    if (mode !== 'custom' && mode in ROLE_PRESETS) {
        const role = ROLE_PRESETS[mode as keyof typeof ROLE_PRESETS]!;
        console.log(`\n✅ Using ${role.name} preset: ${role.permissions.join(', ')}\n`);
        return role.permissions;
    }

    // Custom mode - multiselect permissions
    const permChoices = [
        { name: 'view:*', message: 'view:* - All view permissions', value: 'view:*' },
        { name: 'apps:view', message: 'apps:view - List and view apps', value: 'apps:view' },
        { name: 'apps:logs', message: 'apps:logs - View app logs', value: 'apps:logs' },
        { name: 'apps:stats', message: 'apps:stats - View app stats', value: 'apps:stats' },
        { name: 'deploy:*', message: 'deploy:* - Deploy all apps', value: 'deploy:*' },
        { name: 'app:*', message: 'app:* - All app permissions', value: 'app:*' },
        { name: 'apps:manage', message: 'apps:manage - Start, stop, restart apps', value: 'apps:manage' },
        { name: 'apps:delete', message: 'apps:delete - Remove apps', value: 'apps:delete' },
        { name: 'github:*', message: 'github:* - All GitHub permissions', value: 'github:*' },
        { name: 'github:import', message: 'github:import - Import from GitHub', value: 'github:import' },
        { name: 'github:webhooks', message: 'github:webhooks - Manage webhooks', value: 'github:webhooks' },
        { name: 'users:manage', message: 'users:manage - Manage Linux users', value: 'users:manage' },
        { name: 'users:access', message: 'users:access - Manage access users', value: 'users:access' },
    ];

    const permPrompt = new MultiSelect({
        name: 'permissions',
        message: 'Select permissions (space to toggle, enter to confirm)',
        choices: permChoices,
        initial: ['view:*'], // Default to viewer
        hint: '(Use arrow keys, space to select, enter to confirm)'
    });

    const selected = await permPrompt.run() as string[];

    if (selected.length === 0) {
        console.log('\n⚠️  No permissions selected, defaulting to view:*\n');
        return ['view:*'];
    }

    console.log(`\n✅ Selected: ${selected.join(', ')}\n`);
    return selected;
}

export function addAccessUserCommands(program: Command): void {
    const user = program
        .command('access')
        .description('Access user management (admin only)');

    // Add a new user
    user
        .command('add <email>')
        .description('Add a new user with permissions')
        .option('-p, --perm <permission>', 'Add permission (can be used multiple times)', collect, [])
        .option('-r, --role <role>', 'Use preset role (viewer, deployer, developer, admin)')
        .option('-i, --interactive', 'Interactive permission picker')
        .option('-e, --expiry <duration>', 'Token expiry (max 24h)', '1d')
        .addHelpText('after', `
Role presets:
  --role viewer     Read-only access to dashboard, metrics, logs
  --role deployer   Can deploy, restart, and rollback apps
  --role developer  Full app management including create/delete
  --role admin      Full access to everything

${getPermissionHelp()}`)
        .action(async (email, options) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can add users');
                    process.exit(1);
                }

                let permissions: string[];

                // Priority: interactive > role preset > manual perms > default viewer
                if (options.interactive) {
                    permissions = await interactivePermissionPicker();
                } else if (options.role) {
                    const rolePreset = ROLE_PRESETS[options.role as keyof typeof ROLE_PRESETS];
                    if (!rolePreset) {
                        console.error(`❌ Unknown role: ${options.role}`);
                        console.error('   Available: viewer, deployer, developer, admin');
                        process.exit(1);
                    }
                    permissions = rolePreset.permissions;
                    console.log(`Using ${options.role} preset: ${permissions.join(', ')}`);
                } else if (options.perm.length > 0) {
                    permissions = options.perm;
                } else {
                    permissions = ['view:*'];
                }

                // Validate permissions
                const validation = validatePermissions(permissions);
                if (!validation.valid) {
                    console.error(`❌ Invalid permissions: ${validation.invalid.join(', ')}`);
                    console.error('   Run with --help to see available permissions.');
                    process.exit(1);
                }

                const newUser = await addUser(email, permissions);
                console.log(`\n✅ User added: ${newUser.email}`);
                console.log(`   Permissions: ${newUser.permissions.join(', ')}`);

                // Automatically generate token (enforce max 24h)
                const expiry = options.expiry || '1d';
                const { token, expiresAt } = await generateToken(email, permissions, expiry);

                // Send email
                console.log('Sending welcome email with token...');
                const { sendWelcomeEmail } = await import('../services/email');
                const emailResult = await sendWelcomeEmail(email, token, permissions);

                if (emailResult.success) {
                    console.log('✅ Welcome email sent successfully!');
                } else {
                    console.error(`⚠️  Failed to send email: ${emailResult.error}`);
                    console.log('   Please send the token manually below:');
                }

                console.log(`\nAccess Token (${options.expiry || '1d'})`);
                console.log('━'.repeat(50));
                console.log(`Token: ${token}`);
                console.log('━'.repeat(50));
                console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
                console.log('\nNote: User must this token to login.');
                if (!emailResult.success) console.log('      (Since email failed, you must share this securely manually)');

            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Generate token for a user
    user
        .command('token <email>')
        .description('Generate an access token for a user')
        .option('-e, --expiry <duration>', 'Token expiry (30m, 1h, 1d)', '1d')
        .action(async (email, options) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can generate user tokens');
                    process.exit(1);
                }

                const userData = await getUser(email);
                if (!userData) {
                    console.error(`❌ User not found: ${email}`);
                    console.error('   Create the user first with: okastr8 user add <email>');
                    process.exit(1);
                }

                const { token, expiresAt } = await generateToken(email, userData.permissions, options.expiry);

                console.log(`\nToken Generated for ${email}\n`);
                console.log('━'.repeat(50));
                console.log(`Token: ${token}`);
                console.log('━'.repeat(50));
                console.log(`\nExpires: ${new Date(expiresAt).toLocaleString()}`);
                console.log(`Permissions: ${userData.permissions.join(', ')}\n`);
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Renew access (generate new token + email)
    user
        .command('renew <email>')
        .description('Renew access (generate new token and email it)')
        .option('-e, --expiry <duration>', 'Token expiry (max 24h)', '1d')
        .action(async (email, options) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can renew access');
                    process.exit(1);
                }

                const userData = await getUser(email);
                if (!userData) {
                    console.error(`❌ User not found: ${email}`);
                    process.exit(1);
                }

                console.log(`Renewing access for ${email}...`);
                const { token, expiresAt } = await generateToken(email, userData.permissions, options.expiry);

                // Send email
                console.log('Sending new token via email...');
                const { sendWelcomeEmail } = await import('../services/email');
                const emailResult = await sendWelcomeEmail(email, token, userData.permissions);

                if (emailResult.success) {
                    console.log('✅ New token emailed successfully!');
                } else {
                    console.error(`⚠️  Failed to send email: ${emailResult.error}`);
                    console.log('   Please send the token manually below:');
                }

                console.log(`\nNew Token (${options.expiry})`);
                console.log('━'.repeat(50));
                console.log(`Token: ${token}`);
                console.log('━'.repeat(50));
                console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);

            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // List all users
    user
        .command('list')
        .description('List all users')
        .action(async () => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can list users');
                    process.exit(1);
                }

                const users = await listUsersData();

                if (users.length === 0) {
                    console.log('No users configured. Add one with: okastr8 user add <email>');
                    return;
                }

                console.log('\nUsers\n');
                console.log('Email'.padEnd(30) + 'Permissions'.padEnd(40) + 'Created');
                console.log('─'.repeat(85));

                for (const u of users) {
                    const perms = u.permissions.slice(0, 3).join(', ') + (u.permissions.length > 3 ? '...' : '');
                    const created = new Date(u.createdAt).toLocaleDateString();
                    console.log(`${u.email.padEnd(30)}${perms.padEnd(40)}${created}`);
                }
                console.log('');
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Remove a user
    user
        .command('remove <email>')
        .description('Remove a user and revoke all their tokens')
        .action(async (email) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can remove users');
                    process.exit(1);
                }

                const success = await removeUser(email);
                if (success) {
                    console.log(`✅ User removed: ${email}`);
                    console.log('   All their tokens have been revoked.');
                } else {
                    console.error(`❌ User not found: ${email}`);
                    process.exit(1);
                }
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Update user permissions
    user
        .command('update <email>')
        .description('Update user permissions')
        .option('-p, --perm <permission>', 'Set permissions (can be used multiple times)', collect, [])
        .option('--add <permission>', 'Add a permission')
        .option('--remove <permission>', 'Remove a permission')
        .addHelpText('after', getPermissionHelp())
        .action(async (email, options) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can update users');
                    process.exit(1);
                }

                const userData = await getUser(email);
                if (!userData) {
                    console.error(`❌ User not found: ${email}`);
                    process.exit(1);
                }

                let newPerms = [...userData.permissions];

                // Replace all permissions
                if (options.perm.length > 0) {
                    newPerms = options.perm;
                }

                // Add permission
                if (options.add && !newPerms.includes(options.add)) {
                    newPerms.push(options.add);
                }

                // Remove permission
                if (options.remove) {
                    newPerms = newPerms.filter(p => p !== options.remove);
                }

                const updated = await updateUserPermissions(email, newPerms);
                if (updated) {
                    console.log(`✅ Updated ${email}`);
                    console.log(`   Permissions: ${updated.permissions.join(', ')}`);
                    console.log('\n⚠️  User needs a new token for changes to take effect.');
                }
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Show user details
    user
        .command('info <email>')
        .description('Show user details and permissions')
        .action(async (email) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can view user info');
                    process.exit(1);
                }

                const userData = await getUser(email);
                if (!userData) {
                    console.error(`❌ User not found: ${email}`);
                    process.exit(1);
                }

                // Get tokens for this user
                const allTokens = await listTokens();
                const userTokens = allTokens.filter(t => t.userId === email);

                console.log(`\nUser: ${userData.email}\n`);
                console.log(`Created: ${new Date(userData.createdAt).toLocaleString()}`);
                console.log(`Created by: ${userData.createdBy}`);
                console.log(`\nPermissions:`);
                for (const p of userData.permissions) {
                    console.log(`  • ${p}`);
                }

                if (userTokens.length > 0) {
                    console.log(`\nActive token:`);
                    // Single token policy: user should only have one
                    const t = userTokens[0]!;
                    console.log(`  • ${t.id.slice(0, 12)}... expires ${new Date(t.expiresAt).toLocaleString()}`);
                } else {
                    console.log('\nNo active token');
                }
                console.log('');
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // List all active tokens globally
    user
        .command('active')
        .description('List all active access tokens')
        .action(async () => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can view active tokens');
                    process.exit(1);
                }

                const tokens = await listTokens();
                if (tokens.length === 0) {
                    console.log('No active tokens.');
                    return;
                }

                console.log('\nActive Tokens\n');
                console.log('User'.padEnd(30) + 'Token ID'.padEnd(20) + 'Expires');
                console.log('─'.repeat(75));

                // Sort by user
                tokens.sort((a, b) => a.userId.localeCompare(b.userId));

                for (const t of tokens) {
                    // Calculate remaining time
                    const expires = new Date(t.expiresAt);
                    const now = new Date();
                    const hoursLeft = Math.round((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
                    const timeStr = hoursLeft > 24 ? `${Math.floor(hoursLeft / 24)}d left` : `${hoursLeft}h left`;

                    console.log(`${t.userId.padEnd(30)}${t.id.slice(0, 12)}...     ${timeStr} (${expires.toLocaleTimeString()})`);
                }
                console.log('');
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Revoke access for a specific user (Single Token Policy)
    user
        .command('revoke <email>')
        .description('Revoke active token for a user')
        .action(async (email) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can revoke tokens');
                    process.exit(1);
                }

                const tokens = await listTokens();
                const userToken = tokens.find(t => t.userId === email);

                if (!userToken) {
                    console.error(`⚠️  No active token found for ${email}`);
                    return;
                }

                const { revokeToken } = await import('./auth');
                await revokeToken(userToken.id);
                console.log(`✅ Revoked active token for ${email}`);

            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    user
        .command('revoke-all')
        .description('Revoke ALL active tokens (Emergency)')
        .action(async () => {
            const readline = await import('readline');
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

            const answer = await new Promise<string>(resolve => {
                rl.question('⚠️  Are you sure you want to REVOKE ALL ACCESS TOKENS? Everyone will be logged out. (y/N): ', resolve);
            });
            rl.close();

            if (answer.toLowerCase() !== 'y') {
                console.log('Cancelled.');
                return;
            }

            const { revokeAllTokens } = await import('./auth');
            const count = await revokeAllTokens();
            console.log(`\n✅ Revoked ${count} tokens. All sessions invalidated.`);
        });
}

// Helper to collect multiple --perm flags
function collect(value: string, previous: string[]): string[] {
    return previous.concat([value]);
}
