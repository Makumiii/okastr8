/**
 * Auth Middleware for Hono
 * Validates tokens (RBAC removed - all tokens have full access)
 */

import type { Context, Next, MiddlewareHandler } from "hono";
import { validateToken } from "../commands/auth";

// Extend Hono context types
declare module "hono" {
    interface ContextVariableMap {
        userId: string;
    }
}

/**
 * Extract token from request
 * Checks: Authorization header, then cookie
 */
function extractToken(c: Context): string | null {
    // Check Authorization header first
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }

    // Check cookie
    const cookie = c.req.header("Cookie");
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
            return c.json(
                {
                    success: false,
                    message: "Authentication required",
                },
                401
            );
        }

        const result = await validateToken(token);

        if (!result.valid) {
            return c.json(
                {
                    success: false,
                    message: result.error || "Invalid token",
                },
                401
            );
        }

        // Attach user info to context
        c.set("userId", result.userId!);

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
                c.set("userId", result.userId!);
            }
        }

        await next();
    };
}
