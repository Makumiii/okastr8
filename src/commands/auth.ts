/**
 * Auth System
 * Token-based authentication (RBAC removed - all tokens have full access)
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { randomBytes, createHmac } from 'crypto';
import { writeUnifiedEntry } from '../utils/structured-logger';

// ============ Types ============

export interface User {
    email: string;
    createdAt: string;
    createdBy: string;
}

export interface Token {
    id: string;
    userId: string;       // email or 'admin' for admin
    expiresAt: string;
    createdAt: string;
    renewalAlertSent?: boolean;
}

export interface PendingApproval {
    id: string;
    userId: string;       // email of user requesting access
    token: string;        // the validated token
    requestedAt: string;
    expiresAt: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface AuthData {
    admin: string;        // Linux username of admin
    secret: string;       // Server secret for signing tokens
    users: User[];
    tokens: Token[];
    pendingApprovals: PendingApproval[];
}

// ============ Paths ============

const AUTH_FILE = join(homedir(), '.okastr8', 'auth.json');

async function logAuthEvent(options: {
    level?: 'info' | 'warn' | 'error';
    message: string;
    action: string;
    userId?: string;
    data?: Record<string, unknown>;
    error?: { name: string; message: string; stack?: string };
}) {
    try {
        await writeUnifiedEntry({
            timestamp: new Date().toISOString(),
            level: options.level || 'info',
            source: 'auth',
            service: 'auth',
            message: options.message,
            action: options.action,
            user: options.userId ? { id: options.userId } : undefined,
            data: options.data,
            error: options.error,
        });
    } catch {
        // Ignore logging failures to avoid auth flow breakage
    }
}

// ============ Storage ============

export async function loadAuthData(): Promise<AuthData> {
    try {
        if (existsSync(AUTH_FILE)) {
            const content = await readFile(AUTH_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch { }

    // Default: current Linux user is admin
    const adminUser = process.env.SUDO_USER || process.env.USER || 'root';
    const secret = randomBytes(32).toString('hex');

    return {
        admin: adminUser,
        secret,
        users: [],
        tokens: [],
        pendingApprovals: []
    };
}

export async function saveAuthData(data: AuthData): Promise<void> {
    const dir = join(homedir(), '.okastr8');
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
    await writeFile(AUTH_FILE, JSON.stringify(data, null, 2));
}

// ============ Token Management ============

/**
 * Parse expiry string to milliseconds
 */
function parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)(m|h|d|w)$/);
    if (!match || !match[1] || !match[2]) {
        throw new Error(`Invalid expiry format: ${expiry}. Use: 30m, 1h, 1d, 1w, 30d`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
        'm': 60 * 1000,           // minutes
        'h': 60 * 60 * 1000,      // hours
        'd': 24 * 60 * 60 * 1000, // days
        'w': 7 * 24 * 60 * 60 * 1000 // weeks
    };

    return value * (multipliers[unit] || 0);
}

/**
 * Generate a signed token
 */
export async function generateToken(
    userId: string,
    expiry: string = '1d'
): Promise<{ token: string; expiresAt: string }> {
    const data = await loadAuthData();
    const durationMs = parseExpiry(expiry);
    const MAX_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (durationMs > MAX_DURATION_MS) {
        throw new Error('Security restriction: Token duration cannot exceed 24 hours (1d).');
    }

    const tokenId = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + durationMs).toISOString();

    // Create token payload (no permissions - all tokens have full access)
    const payload = {
        id: tokenId,
        sub: userId,
        exp: expiresAt
    };

    // Sign the payload
    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr).toString('base64url');
    const signature = createHmac('sha256', data.secret)
        .update(payloadB64)
        .digest('base64url');

    const token = `${payloadB64}.${signature}`;

    // 1. Strict Cleanup: Remove expired tokens globally
    const now = new Date();
    data.tokens = data.tokens.filter(t => new Date(t.expiresAt) > now);

    // 2. Single Token Policy: Remove ANY existing tokens for this user
    // (A user can only have one active token at a time)
    data.tokens = data.tokens.filter(t => t.userId !== userId);

    // 3. Add new token
    data.tokens.push({
        id: tokenId,
        userId,
        expiresAt,
        createdAt: now.toISOString()
    });

    await saveAuthData(data);

    // Log activity
    try {
        const { logActivity } = await import('../utils/activity');
        await logActivity('login', { action: 'token_generated', expiry }, userId);
    } catch (e) {
        console.error('Failed to log login activity:', e);
    }
    await logAuthEvent({
        action: 'token-generated',
        message: 'Token generated',
        userId,
        data: { tokenId, expiresAt, expiry },
    });

    return { token, expiresAt };
}

/**
 * Validate and decode a token
 */
export async function validateToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    error?: string;
}> {
    try {
        const data = await loadAuthData();

        const parts = token.split('.');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            return { valid: false, error: 'Invalid token format' };
        }

        const payloadB64 = parts[0];
        const signature = parts[1];

        // Verify signature
        const expectedSig = createHmac('sha256', data.secret)
            .update(payloadB64)
            .digest('base64url');

        if (signature !== expectedSig) {
            return { valid: false, error: 'Invalid signature' };
        }

        // Decode payload
        const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadStr);

        // Check expiry (Strict payload check)
        if (new Date(payload.exp) < new Date()) {
            return { valid: false, error: 'Token expired' };
        }

        // Check if token was revoked
        const tokenRecord = data.tokens.find(t => t.id === payload.id);
        if (!tokenRecord) {
            return { valid: false, error: 'Token revoked or not found' };
        }

        return {
            valid: true,
            userId: payload.sub
        };
    } catch (error: any) {
        return { valid: false, error: error.message };
    }
}

/**
 * Renew/Extend a token's expiry
 */
export async function renewToken(userId: string, duration: string): Promise<{ success: boolean; expiresAt?: string; error?: string }> {
    const data = await loadAuthData();
    const ms = parseExpiry(duration);

    // Find active or recently expired token for user
    const tokenIdx = data.tokens.findIndex(t => t.userId === userId);

    if (tokenIdx === -1) {
        await logAuthEvent({
            level: 'warn',
            action: 'token-renew-failed',
            message: 'Token renewal failed: no token found for user',
            userId,
        });
        return { success: false, error: 'No token found for user' };
    }

    const newExpiry = new Date(Date.now() + ms).toISOString();

    if (data.tokens[tokenIdx]) {
        data.tokens[tokenIdx].expiresAt = newExpiry;
    }

    // Also clear any "renewal notification sent" flag if we add one in the future

    await saveAuthData(data);
    await logAuthEvent({
        action: 'token-renewed',
        message: 'Token renewed',
        userId,
        data: { expiresAt: newExpiry },
    });
    return { success: true, expiresAt: newExpiry };
}

/**
 * Revoke a token by ID
 */
export async function revokeToken(tokenId: string): Promise<boolean> {
    const data = await loadAuthData();
    const initialLength = data.tokens.length;
    const token = data.tokens.find(t => t.id === tokenId);
    data.tokens = data.tokens.filter(t => t.id !== tokenId);

    if (data.tokens.length < initialLength) {
        await saveAuthData(data);
        await logAuthEvent({
            action: 'token-revoked',
            message: 'Token revoked',
            userId: token?.userId,
            data: { tokenId },
        });
        return true;
    }
    return false;
}

/**
 * Revoke ALL tokens (Emergency Security Measure)
 */
export async function revokeAllTokens(): Promise<number> {
    const data = await loadAuthData();
    const count = data.tokens.length;
    data.tokens = [];
    await saveAuthData(data);
    await logAuthEvent({
        action: 'token-revoke-all',
        message: 'All tokens revoked',
        data: { count },
    });
    return count;
}

/**
 * List all active tokens
 */
export async function listTokens(): Promise<Token[]> {
    const data = await loadAuthData();
    // Filter out expired tokens
    return data.tokens.filter(t => new Date(t.expiresAt) > new Date());
}

// ============ User Management ============

/**
 * Add a new user
 */
export async function addUser(
    email: string,
    createdBy: string = 'admin'
): Promise<User> {
    const data = await loadAuthData();

    // Check if user exists
    if (data.users.find(u => u.email === email)) {
        throw new Error(`User ${email} already exists`);
    }

    const user: User = {
        email,
        createdAt: new Date().toISOString(),
        createdBy
    };

    data.users.push(user);
    await saveAuthData(data);
    await logAuthEvent({
        action: 'user-added',
        message: 'User added',
        userId: email,
        data: { createdBy },
    });

    return user;
}

/**
 * Remove a user
 */
export async function removeUser(email: string): Promise<boolean> {
    const data = await loadAuthData();
    const initialLength = data.users.length;
    data.users = data.users.filter(u => u.email !== email);

    // Also revoke all their tokens
    data.tokens = data.tokens.filter(t => t.userId !== email);

    if (data.users.length < initialLength) {
        await saveAuthData(data);
        await logAuthEvent({
            action: 'user-removed',
            message: 'User removed',
            userId: email,
        });
        return true;
    }
    return false;
}

/**
 * List all users
 */
export async function listUsers(): Promise<User[]> {
    const data = await loadAuthData();
    return data.users;
}

/**
 * Get user by email
 */
export async function getUser(email: string): Promise<User | null> {
    const data = await loadAuthData();
    return data.users.find(u => u.email === email) || null;
}

// ============ Admin Functions ============

/**
 * Get admin username
 */
export async function getAdminUser(): Promise<string> {
    const data = await loadAuthData();
    return data.admin;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
    const data = await loadAuthData();
    const identifiers = new Set<string>();

    if (data.admin) identifiers.add(data.admin);

    try {
        const { getSystemConfig } = await import('../config');
        const config = await getSystemConfig();
        const adminEmail = config.notifications?.brevo?.admin_email;
        const githubAdminId = config.manager?.auth?.github_admin_id;
        if (adminEmail) identifiers.add(adminEmail);
        if (githubAdminId) identifiers.add(`github:${githubAdminId}`);
    } catch { }

    return identifiers.has(userId);
}

/**
 * Check if current Linux user is admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
    const data = await loadAuthData();
    const currentUser = process.env.SUDO_USER || process.env.USER || '';
    return currentUser === data.admin;
}

/**
 * Generate admin token (only works if current user is admin)
 */
export async function generateAdminToken(expiry: string = '1d'): Promise<{ token: string; expiresAt: string }> {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
        throw new Error('Only the admin user can generate admin tokens');
    }

    const data = await loadAuthData();

    // Try to get admin email from config for better identification
    let adminId = data.admin;
    try {
        const { getSystemConfig } = await import('../config');
        const config = await getSystemConfig();
        if (config.notifications?.brevo?.admin_email) {
            adminId = config.notifications.brevo.admin_email;
        }
    } catch { }

    return generateToken(adminId, expiry);
}

// ============ Login Approval System ============

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a pending approval request
 */
export async function createPendingApproval(
    userId: string,
    token: string
): Promise<PendingApproval> {
    const data = await loadAuthData();

    // Clean up expired approvals first
    const now = Date.now();
    data.pendingApprovals = data.pendingApprovals.filter(
        p => new Date(p.expiresAt).getTime() > now
    );

    // Check if already pending
    const existing = data.pendingApprovals.find(
        p => p.userId === userId && p.status === 'pending'
    );
    if (existing) {
        return existing;
    }

    const approval: PendingApproval = {
        id: randomBytes(8).toString('hex'),
        userId,
        token,
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(now + APPROVAL_TIMEOUT_MS).toISOString(),
        status: 'pending'
    };

    data.pendingApprovals.push(approval);
    await saveAuthData(data);
    await logAuthEvent({
        action: 'approval-requested',
        message: 'Login approval requested',
        userId,
        data: { requestId: approval.id, expiresAt: approval.expiresAt },
    });

    return approval;
}

/**
 * List all pending approvals
 */
export async function listPendingApprovals(): Promise<PendingApproval[]> {
    const data = await loadAuthData();
    const now = Date.now();

    // Return only pending and not expired
    return data.pendingApprovals.filter(
        p => p.status === 'pending' && new Date(p.expiresAt).getTime() > now
    );
}

/**
 * Approve a pending request
 */
export async function approveRequest(requestId: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    const data = await loadAuthData();

    const approval = data.pendingApprovals.find(
        p => p.id.startsWith(requestId) && p.status === 'pending'
    );

    if (!approval) {
        await logAuthEvent({
            level: 'warn',
            action: 'approval-approve-failed',
            message: 'Approval request not found',
            data: { requestId },
        });
        return { success: false, error: 'Pending request not found' };
    }

    if (new Date(approval.expiresAt).getTime() < Date.now()) {
        await logAuthEvent({
            level: 'warn',
            action: 'approval-approve-failed',
            message: 'Approval request expired',
            userId: approval.userId,
            data: { requestId },
        });
        return { success: false, error: 'Request has expired' };
    }

    approval.status = 'approved';
    await saveAuthData(data);
    await logAuthEvent({
        action: 'approval-approved',
        message: 'Login approval approved',
        userId: approval.userId,
        data: { requestId },
    });

    return { success: true, userId: approval.userId };
}

/**
 * Reject a pending request
 */
export async function rejectRequest(requestId: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    const data = await loadAuthData();

    const approval = data.pendingApprovals.find(
        p => p.id.startsWith(requestId) && p.status === 'pending'
    );

    if (!approval) {
        await logAuthEvent({
            level: 'warn',
            action: 'approval-reject-failed',
            message: 'Approval request not found',
            data: { requestId },
        });
        return { success: false, error: 'Pending request not found' };
    }

    approval.status = 'rejected';
    await saveAuthData(data);
    await logAuthEvent({
        action: 'approval-rejected',
        message: 'Login approval rejected',
        userId: approval.userId,
        data: { requestId },
    });

    return { success: true, userId: approval.userId };
}

/**
 * Check approval status
 */
export async function checkApprovalStatus(requestId: string): Promise<{
    found: boolean;
    status?: 'pending' | 'approved' | 'rejected' | 'expired';
    token?: string;
}> {
    const data = await loadAuthData();

    const approval = data.pendingApprovals.find(p => p.id === requestId);

    if (!approval) {
        return { found: false };
    }

    // Check if expired
    if (new Date(approval.expiresAt).getTime() < Date.now() && approval.status === 'pending') {
        return { found: true, status: 'expired' };
    }

    return {
        found: true,
        status: approval.status,
        token: approval.status === 'approved' ? approval.token : undefined
    };
}

/**
 * Check if login approval is required (reads from system.yaml)
 */
export async function isLoginApprovalRequired(): Promise<boolean> {
    try {
        const { parse: parseYaml } = await import('yaml');
        const { readFile } = await import('fs/promises');
        const { existsSync } = await import('fs');
        const { join } = await import('path');
        const { homedir } = await import('os');

        const systemYamlPath = join(homedir(), '.okastr8', 'system.yaml');
        if (!existsSync(systemYamlPath)) {
            return false; // Default: no approval needed if not configured
        }

        const content = await readFile(systemYamlPath, 'utf-8');
        const config = parseYaml(content);

        return config?.security?.require_login_approval === true;
    } catch {
        return false;
    }
}

/**
 * Check if user is in trusted users list (skip approval)
 */
export async function isTrustedUser(email: string): Promise<boolean> {
    try {
        const { parse: parseYaml } = await import('yaml');
        const { readFile } = await import('fs/promises');
        const { existsSync } = await import('fs');
        const { join } = await import('path');
        const { homedir } = await import('os');

        const systemYamlPath = join(homedir(), '.okastr8', 'system.yaml');
        if (!existsSync(systemYamlPath)) {
            return false;
        }

        const content = await readFile(systemYamlPath, 'utf-8');
        const config = parseYaml(content);

        const trustedUsers: string[] = config?.security?.trusted_users || [];
        return trustedUsers.includes(email);
    } catch {
        return false;
    }
}
