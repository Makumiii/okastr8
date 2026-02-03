/**
 * User Management CLI Commands
 * Add, remove, and manage access users (RBAC removed - all users have full access)
 */

import { Command } from 'commander';
import {
    addUser,
    removeUser,
    listUsers as listUsersData,
    getUser,
    generateToken,
    isCurrentUserAdmin,
    listTokens
} from './auth';

export function addAccessUserCommands(program: Command): void {
    const user = program
        .command('access')
        .description('Access user management (admin only)');

    // Add a new user
    user
        .command('add <email>')
        .description('Add a new user and send them an access token')
        .option('-e, --expiry <duration>', 'Token expiry (max 24h)', '1d')
        .action(async (email, options) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('Only admin can add users');
                    process.exit(1);
                }

                const newUser = await addUser(email);
                console.log(`\n User added: ${newUser.email}`);

                // Automatically generate token
                const expiry = options.expiry || '1d';
                const { token, expiresAt } = await generateToken(email, expiry);

                // Send email
                console.log('Sending welcome email with token...');
                const { sendWelcomeEmail } = await import('../services/email');
                const emailResult = await sendWelcomeEmail(email, token);

                if (emailResult.success) {
                    console.log('Welcome email sent successfully!');
                } else {
                    console.error(`Warning: Failed to send email: ${emailResult.error}`);
                    console.log('   Please send the token manually below:');
                }

                console.log(`\nAccess Token (${options.expiry || '1d'})`);
                console.log('━'.repeat(50));
                console.log(`Token: ${token}`);
                console.log('━'.repeat(50));
                console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
                console.log('\nNote: User must use this token to login.');
                if (!emailResult.success) console.log('      (Since email failed, you must share this securely manually)');

            } catch (error: any) {
                console.error(` Error: ${error.message}`);
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
                    console.error('Only admin can generate user tokens');
                    process.exit(1);
                }

                const userData = await getUser(email);
                if (!userData) {
                    console.error(` User not found: ${email}`);
                    console.error('   Create the user first with: okastr8 access add <email>');
                    process.exit(1);
                }

                const { token, expiresAt } = await generateToken(email, options.expiry);

                console.log(`\nToken Generated for ${email}\n`);
                console.log('━'.repeat(50));
                console.log(`Token: ${token}`);
                console.log('━'.repeat(50));
                console.log(`\nExpires: ${new Date(expiresAt).toLocaleString()}\n`);
            } catch (error: any) {
                console.error(` Error: ${error.message}`);
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
                    console.error('Only admin can renew access');
                    process.exit(1);
                }

                const userData = await getUser(email);
                if (!userData) {
                    console.error(` User not found: ${email}`);
                    process.exit(1);
                }

                console.log(`Renewing access for ${email}...`);
                const { token, expiresAt } = await generateToken(email, options.expiry);

                // Send email
                console.log('Sending new token via email...');
                const { sendWelcomeEmail } = await import('../services/email');
                const emailResult = await sendWelcomeEmail(email, token);

                if (emailResult.success) {
                    console.log('New token emailed successfully!');
                } else {
                    console.error(`Warning: Failed to send email: ${emailResult.error}`);
                    console.log('   Please send the token manually below:');
                }

                console.log(`\nNew Token (${options.expiry})`);
                console.log('━'.repeat(50));
                console.log(`Token: ${token}`);
                console.log('━'.repeat(50));
                console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);

            } catch (error: any) {
                console.error(` Error: ${error.message}`);
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
                    console.error('Only admin can list users');
                    process.exit(1);
                }

                const users = await listUsersData();

                if (users.length === 0) {
                    console.log('No users configured. Add one with: okastr8 access add <email>');
                    return;
                }

                console.log('\nUsers\n');
                console.log('Email'.padEnd(40) + 'Created');
                console.log('─'.repeat(60));

                for (const u of users) {
                    const created = new Date(u.createdAt).toLocaleDateString();
                    console.log(`${u.email.padEnd(40)}${created}`);
                }
                console.log('');
            } catch (error: any) {
                console.error(` Error: ${error.message}`);
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
                    console.error('Only admin can remove users');
                    process.exit(1);
                }

                const success = await removeUser(email);
                if (success) {
                    console.log(` User removed: ${email}`);
                    console.log('   All their tokens have been revoked.');
                } else {
                    console.error(` User not found: ${email}`);
                    process.exit(1);
                }
            } catch (error: any) {
                console.error(` Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Show user details
    user
        .command('info <email>')
        .description('Show user details')
        .action(async (email) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('Only admin can view user info');
                    process.exit(1);
                }

                const userData = await getUser(email);
                if (!userData) {
                    console.error(` User not found: ${email}`);
                    process.exit(1);
                }

                // Get tokens for this user
                const allTokens = await listTokens();
                const userTokens = allTokens.filter(t => t.userId === email);

                console.log(`\nUser: ${userData.email}\n`);
                console.log(`Created: ${new Date(userData.createdAt).toLocaleString()}`);
                console.log(`Created by: ${userData.createdBy}`);

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
                console.error(` Error: ${error.message}`);
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
                    console.error('Only admin can view active tokens');
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
                console.error(` Error: ${error.message}`);
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
                    console.error('Only admin can revoke tokens');
                    process.exit(1);
                }

                const tokens = await listTokens();
                const userToken = tokens.find(t => t.userId === email);

                if (!userToken) {
                    console.error(`Warning: No active token found for ${email}`);
                    return;
                }

                const { revokeToken } = await import('./auth');
                await revokeToken(userToken.id);
                console.log(` Revoked active token for ${email}`);

            } catch (error: any) {
                console.error(` Error: ${error.message}`);
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
                rl.question('Warning: Are you sure you want to REVOKE ALL ACCESS TOKENS? Everyone will be logged out. (y/N): ', resolve);
            });
            rl.close();

            if (answer.toLowerCase() !== 'y') {
                console.log('Cancelled.');
                return;
            }

            const { revokeAllTokens } = await import('./auth');
            const count = await revokeAllTokens();
            console.log(`\n Revoked ${count} tokens. All sessions invalidated.`);
        });
}
