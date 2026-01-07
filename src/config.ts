import { join } from 'path';
import { homedir } from 'os';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { load, dump } from 'js-yaml';
import { existsSync } from 'fs';

// Handle sudo: use original user's home directory, not /root
function getHomeDir(): string {
    const sudoUser = process.env.SUDO_USER;
    if (sudoUser) {
        return `/home/${sudoUser}`;
    }
    return homedir();
}

export const OKASTR8_HOME = join(getHomeDir(), '.okastr8');
export const CONFIG_FILE = join(OKASTR8_HOME, 'system.yaml');

// Types for the Unified Config
export interface SystemConfig {
    setup?: {
        user?: {
            username?: string;
            password?: string;
            distro?: string;
        };
        ssh?: {
            port?: number;
        };
        firewall?: {
            allowed_ports?: number[];
        };
    };
    manager?: {
        port?: number;
        api_key?: string;
        github?: {
            client_id?: string;
            client_secret?: string;
            access_token?: string;
            username?: string;
            connected_at?: string;
            webhook_secret?: string;
        };
    };
    tunnel?: {
        enabled?: boolean;
        service?: string;
        port?: string | number;
        url?: string;
        auth_token?: string;
    };
    deployments?: any[];
}

// Module-level cache (Singleton pattern via module scope)
let configCache: SystemConfig | null = null;

export async function loadSystemConfig(): Promise<SystemConfig> {
    try {
        if (!existsSync(CONFIG_FILE)) {
            configCache = {};
            return configCache;
        }
        const content = await readFile(CONFIG_FILE, 'utf-8');
        configCache = (load(content) as SystemConfig) || {};
        return configCache;
    } catch (error) {
        console.error('Failed to load system.yaml:', error);
        return {};
    }
}

export async function getSystemConfig(): Promise<SystemConfig> {
    if (configCache) return configCache;
    return await loadSystemConfig();
}

export async function saveSystemConfig(newConfig: Partial<SystemConfig>): Promise<void> {
    await mkdir(OKASTR8_HOME, { recursive: true });

    // Ensure we have the latest base
    const current = await getSystemConfig();

    // Shallow merge of top-level sections
    const updatedConfig: SystemConfig = {
        ...current,
        ...newConfig,
        setup: { ...current.setup, ...newConfig.setup },
        manager: { ...current.manager, ...newConfig.manager },
        tunnel: { ...current.tunnel, ...newConfig.tunnel },
    };

    // Fix specific nested merge for github if needed
    if (newConfig.manager?.github && current.manager?.github) {
        // Ensure manager exists (implied by above spread, but TS needs help)
        if (!updatedConfig.manager) updatedConfig.manager = {};
        updatedConfig.manager.github = { ...current.manager.github, ...newConfig.manager.github };
    }

    // Update cache
    configCache = updatedConfig;

    const yamlContent = dump(updatedConfig, { indent: 2 });
    await writeFile(CONFIG_FILE, yamlContent, 'utf-8');
}
