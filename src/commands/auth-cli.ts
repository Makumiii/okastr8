/**
 * Auth CLI Commands
 * Token management for admin users
 */

import { Command } from 'commander';
import {
    generateAdminToken,
    isCurrentUserAdmin,
    listTokens,
    revokeToken,
    getAdminUser
} from './auth';

export function addAuthCommands(program: Command): void {
    const auth = program
        .command('auth')
        .description('Authentication and token management (admin only)');

    // Generate token for self (admin)
    auth
        .command('token')
        .description('Generate an access token for UI login')
        .option('-e, --expiry <duration>', 'Token expiry (30m, 1h, 1d, 1w, 30d)', '1d')
        .action(async (options) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    const adminUser = await getAdminUser();
                    console.error(`❌ Only the admin user (${adminUser}) can generate tokens.`);
                    console.error(`   Current user: ${process.env.SUDO_USER || process.env.USER}`);
                    process.exit(1);
                }

                const { token, expiresAt } = await generateAdminToken(options.expiry);

                console.log('\nAdmin Access Token Generated\n');
                console.log('━'.repeat(50));
                console.log(`Token: ${token}`);
                console.log('━'.repeat(50));
                console.log(`\nExpires: ${new Date(expiresAt).toLocaleString()}`);
                console.log('\nUse this token to log in to the okastr8 UI');
                console.log('   Paste it in the login page to get access.\n');
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // List active tokens
    auth
        .command('list')
        .description('List all active tokens')
        .action(async () => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can list tokens');
                    process.exit(1);
                }

                const tokens = await listTokens();

                if (tokens.length === 0) {
                    console.log('No active tokens.');
                    return;
                }

                console.log('\nActive Tokens\n');
                console.log('ID'.padEnd(16) + 'User'.padEnd(25) + 'Expires'.padEnd(25) + 'Permissions');
                console.log('─'.repeat(80));

                for (const t of tokens) {
                    const id = t.id.slice(0, 12) + '...';
                    const user = t.userId.slice(0, 22);
                    const expires = new Date(t.expiresAt).toLocaleString();
                    const perms = t.permissions.slice(0, 3).join(', ') + (t.permissions.length > 3 ? '...' : '');
                    console.log(`${id.padEnd(16)}${user.padEnd(25)}${expires.padEnd(25)}${perms}`);
                }
                console.log('');
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Revoke a token
    auth
        .command('revoke <tokenId>')
        .description('Revoke a token by ID')
        .action(async (tokenId) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can revoke tokens');
                    process.exit(1);
                }

                // Handle partial token ID
                const tokens = await listTokens();
                const match = tokens.find(t => t.id.startsWith(tokenId));

                if (!match) {
                    console.error(`❌ Token not found: ${tokenId}`);
                    process.exit(1);
                }

                const success = await revokeToken(match.id);
                if (success) {
                    console.log(`✅ Token revoked: ${match.id.slice(0, 12)}...`);
                } else {
                    console.error('❌ Failed to revoke token');
                }
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Test email configuration
    auth
        .command('test-email')
        .description('Send a test email to verify Brevo configuration')
        .action(async () => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can test email');
                    process.exit(1);
                }

                console.log('Sending test email...');
                const { testEmailConfig } = await import('../services/email');
                const result = await testEmailConfig();

                if (result.success) {
                    console.log('✅ Test email sent successfully!');
                    console.log('   Check your inbox for the confirmation.');
                } else {
                    console.error(`❌ Failed to send: ${result.error}`);
                    console.error('   Make sure your system.yaml has the notifications.brevo section configured.');
                }
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // List pending login approvals
    auth
        .command('pending')
        .description('List pending login approval requests')
        .action(async () => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can view pending approvals');
                    process.exit(1);
                }

                const { listPendingApprovals } = await import('./auth');
                const pending = await listPendingApprovals();

                if (pending.length === 0) {
                    console.log('No pending login requests.');
                    return;
                }

                console.log('\n⏳ Pending Login Requests\n');
                console.log('ID'.padEnd(12) + 'User'.padEnd(30) + 'Requested'.padEnd(25) + 'Expires In');
                console.log('─'.repeat(80));

                for (const p of pending) {
                    const id = p.id.slice(0, 8);
                    const user = p.userId.slice(0, 27);
                    const requested = new Date(p.requestedAt).toLocaleString();
                    const expiresIn = Math.round((new Date(p.expiresAt).getTime() - Date.now()) / 1000);
                    const expiresStr = expiresIn > 0 ? `${expiresIn}s` : 'expired';
                    console.log(`${id.padEnd(12)}${user.padEnd(30)}${requested.padEnd(25)}${expiresStr}`);
                }

                console.log('\nTo approve: okastr8 auth approve <id>');
                console.log('To reject:  okastr8 auth reject <id>\n');
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Approve a login request
    auth
        .command('approve <requestId>')
        .description('Approve a pending login request')
        .action(async (requestId) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can approve requests');
                    process.exit(1);
                }

                const { approveRequest } = await import('./auth');
                const result = await approveRequest(requestId);

                if (result.success) {
                    console.log(`✅ Approved login for: ${result.userId}`);
                    console.log('   They should now have access to the dashboard.');
                } else {
                    console.error(`❌ ${result.error}`);
                    process.exit(1);
                }
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Reject a login request
    auth
        .command('reject <requestId>')
        .description('Reject a pending login request')
        .action(async (requestId) => {
            try {
                const isAdmin = await isCurrentUserAdmin();
                if (!isAdmin) {
                    console.error('❌ Only admin can reject requests');
                    process.exit(1);
                }

                const { rejectRequest } = await import('./auth');
                const result = await rejectRequest(requestId);

                if (result.success) {
                    console.log(`❌ Rejected login for: ${result.userId}`);
                } else {
                    console.error(`❌ ${result.error}`);
                    process.exit(1);
                }
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
                process.exit(1);
            }
        });
}
