/**
 * Auth Middleware for Hono
 * Validates tokens and checks permissions on API routes
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { validateToken, hasPermission } from '../commands/auth';

// Extend Hono context types
declare module 'hono' {
    interface ContextVariableMap {
        userId: string;
        permissions: string[];
    }
}

/**
 * Extract token from request
 * Checks: Authorization header, then cookie
 */
function extractToken(c: Context): string | null {
    // Check Authorization header first
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    // Check cookie
    const cookie = c.req.header('Cookie');
    if (cookie) {
        const match = cookie.match(/okastr8_session=([^;]+)/);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Auth middleware - validates token and attaches user info to context
 * Returns 401 if no valid token
 */
export function requireAuth(): MiddlewareHandler {
    return async (c: Context, next: Next) => {
        const token = extractToken(c);

        if (!token) {
            return c.json({
                success: false,
                message: 'Authentication required'
            }, 401);
        }

        const result = await validateToken(token);

        if (!result.valid) {
            return c.json({
                success: false,
                message: result.error || 'Invalid token'
            }, 401);
        }

        // Attach user info to context
        c.set('userId', result.userId!);
        c.set('permissions', result.permissions!);

        await next();
    };
}

/**
 * Permission middleware - checks if user has required permission
 * Must be used after requireAuth()
 */
export function requirePermission(permission: string): MiddlewareHandler {
    return async (c: Context, next: Next) => {
        const permissions = c.get('permissions');

        if (!permissions) {
            return c.json({
                success: false,
                message: 'Authentication required'
            }, 401);
        }

        if (!hasPermission(permissions, permission)) {
            return c.json({
                success: false,
                message: `Permission denied: requires '${permission}'`
            }, 403);
        }

        await next();
    };
}

/**
 * Optional auth - doesn't block but attaches user if valid token present
 */
export function optionalAuth(): MiddlewareHandler {
    return async (c: Context, next: Next) => {
        const token = extractToken(c);

        if (token) {
            const result = await validateToken(token);
            if (result.valid) {
                c.set('userId', result.userId!);
                c.set('permissions', result.permissions!);
            }
        }

        await next();
    };
}

/**
 * Check if request has permission (for use in route handlers)
 */
export function checkPermission(c: Context, permission: string): boolean {
    const permissions = c.get('permissions');
    if (!permissions) return false;
    return hasPermission(permissions, permission);
}
