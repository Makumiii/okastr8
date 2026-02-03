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

export interface Token {
    id: string;
    userId: string;       // email or 'admin' for admin
    expiresAt: string;
    createdAt: string;
}

export interface AuthData {
    admin: string;        // Linux username of admin
    secret: string;       // Server secret for signing tokens
    tokens: Token[];
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
        tokens: []
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
