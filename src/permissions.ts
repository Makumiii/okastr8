/**
 * Central Permissions Registry
 * All available permissions with descriptions
 */

export const PERMISSIONS = {
    // ============ Wildcard ============
    '*': 'Full admin access - all permissions',

    // ============ View Permissions ============
    'view:*': 'All view permissions',
    'view:dashboard': 'View main dashboard',
    'view:metrics': 'View system metrics',
    'view:logs': 'View application logs',
    'view:deployments': 'View deployment history',
    'view:apps': 'View application list and details',
    'view:github': 'View GitHub configuration',
    'view:users': 'View Linux users',
    'view:services': 'View systemd services',

    // ============ Deploy Permissions ============
    'deploy:*': 'Deploy all applications',
    // Note: deploy:app-name is dynamic, validated separately

    // ============ App Management ============
    'app:*': 'All app management permissions',
    'app:restart': 'Restart applications',
    'app:stop': 'Stop applications',
    'app:start': 'Start applications',
    'app:rollback': 'Rollback to previous version',
    'app:create': 'Create new applications',
    'app:delete': 'Delete applications',
    'app:update': 'Update/deploy applications',

    // ============ GitHub Integration ============
    'github:*': 'All GitHub permissions',
    'github:manage': 'Manage GitHub settings and tokens',
    'github:import': 'Import repositories',
    'github:webhook': 'Configure webhooks',

    // ============ System Management ============
    'system:*': 'All system permissions',
    'system:services': 'Manage systemd services',
    'system:control': 'Global system controls (Stop All, etc.)',
    'system:setup': 'Run setup commands',
    'system:orchestrate': 'Run orchestration',

    // ============ User Management ============
    'users:*': 'All user permissions',
    'users:manage': 'Manage Linux users',
    'users:access': 'Manage access users (okastr8)',

    // ============ Settings ============
    'settings:*': 'All settings',
    'settings:view': 'View system settings',
    'settings:edit': 'Edit system settings',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a permission string is valid
 * Handles both exact matches and dynamic app permissions
 */
export function isValidPermission(perm: string): boolean {
    // Exact match in registry
    if (perm in PERMISSIONS) return true;

    // Dynamic app-specific permission: deploy:app-name
    if (perm.startsWith('deploy:') && perm !== 'deploy:*') {
        return true; // App name can be anything
    }

    return false;
}

/**
 * Get all permission keys
 */
export function getAllPermissions(): string[] {
    return Object.keys(PERMISSIONS);
}

/**
 * Get permission description
 */
export function getPermissionDescription(perm: string): string {
    if (perm in PERMISSIONS) {
        return PERMISSIONS[perm as Permission];
    }
    if (perm.startsWith('deploy:')) {
        return `Deploy specific app: ${perm.split(':')[1]}`;
    }
    return 'Unknown permission';
}

/**
 * Group permissions by category for display
 */
export function getPermissionsByCategory(): Record<string, { key: string; desc: string }[]> {
    const categories: Record<string, { key: string; desc: string }[]> = {};

    for (const [key, desc] of Object.entries(PERMISSIONS)) {
        const category = key.split(':')[0] || 'other';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push({ key, desc });
    }

    return categories;
}

// ============ API Route → Permission Mapping ============
// Used by middleware to automatically check permissions

export const ROUTE_PERMISSIONS: Record<string, string> = {
    // System
    'GET:/system/status': 'view:dashboard',
    'GET:/system/metrics': 'view:metrics',
    'GET:/logs/recent': 'view:logs',

    // Apps
    'GET:/apps': 'view:apps',
    'GET:/apps/list': 'view:apps',
    'POST:/apps/create': 'app:create',
    'POST:/apps/delete': 'app:delete',
    'POST:/apps/restart': 'app:restart',
    'POST:/apps/stop': 'app:stop',
    'POST:/apps/start': 'app:start',
    'POST:/apps/update': 'app:update',
    'POST:/apps/rollback': 'app:rollback',
    'POST:/app/webhook-toggle': 'app:deploy',

    // GitHub
    'GET:/github/status': 'view:github',
    'POST:/github/connect': 'github:manage',
    'POST:/github/import': 'github:import',
    'GET:/github/repos': 'view:github',

    // Services
    'GET:/services': 'view:services',
    'GET:/services/list': 'view:services',
    'POST:/services/start': 'system:services',
    'POST:/services/stop': 'system:services',
    'POST:/services/restart': 'system:services',
    'POST:/services/start-all': 'system:control',
    'POST:/services/stop-all': 'system:control',
    'POST:/services/restart-all': 'system:control',
    'POST:/auth/revoke-all': 'system:control',

    // Users (Linux)
    'GET:/users': 'view:users',
    'GET:/users/list': 'view:users',
    'POST:/users/create': 'users:manage',
    'POST:/users/delete': 'users:manage',

    // Setup
    'POST:/setup': 'system:setup',
    'POST:/orchestrate': 'system:orchestrate',

    // Tunnel
    'GET:/tunnel/status': 'system:control',
    'POST:/tunnel/setup': 'system:control',
    'POST:/tunnel/uninstall': 'system:control',

    // Access Users
    'GET:/access/list': 'users:access',
    'GET:/access/tokens': 'users:access',
    'POST:/access/revoke-token': 'users:access',
    'POST:/access/revoke-user': 'users:access',
};

/**
 * Get required permission for a route
 */
export function getRoutePermission(method: string, path: string): string | null {
    const key = `${method}:${path}`;
    return ROUTE_PERMISSIONS[key] || null;
}
