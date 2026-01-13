/**
 * Environment Variable Manager
 * Manages secure storage and retrieval of environment variables for deployed apps
 * Variables are stored in /var/okastr8/apps/{appName}/.env.production
 */

import { join } from "path";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { OKASTR8_HOME } from "../config";

const APPS_DIR = join(OKASTR8_HOME, "apps");

/**
 * Get the path to the env file for an app
 */
function getEnvFilePath(appName: string): string {
    return join(APPS_DIR, appName, ".env.production");
}

/**
 * Save environment variables for an app
 * Overwrites existing variables with the same keys
 */
export async function saveEnvVars(
    appName: string,
    vars: Record<string, string>
): Promise<void> {
    const envFilePath = getEnvFilePath(appName);
    const appDir = join(APPS_DIR, appName);

    // Ensure app directory exists
    if (!existsSync(appDir)) {
        await mkdir(appDir, { recursive: true });
    }

    // Load existing vars
    const existing = await loadEnvVars(appName);

    // Merge with new vars (new vars override)
    const merged = { ...existing, ...vars };

    // Write to file
    const content = Object.entries(merged)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    await writeFile(envFilePath, content, { mode: 0o600 }); // Only owner can read/write
}

/**
 * Load environment variables for an app
 * Returns empty object if no env file exists
 */
export async function loadEnvVars(
    appName: string
): Promise<Record<string, string>> {
    const envFilePath = getEnvFilePath(appName);

    if (!existsSync(envFilePath)) {
        return {};
    }

    try {
        const content = await readFile(envFilePath, "utf-8");
        const vars: Record<string, string> = {};

        // Parse .env format (KEY=VALUE)
        content.split("\n").forEach((line) => {
            line = line.trim();

            // Skip empty lines and comments
            if (!line || line.startsWith("#")) {
                return;
            }

            const [key, ...valueParts] = line.split("=");
            if (key && valueParts.length > 0) {
                vars[key.trim()] = valueParts.join("=").trim();
            }
        });

        return vars;
    } catch (error: any) {
        throw new Error(`Failed to load env vars: ${error.message}`);
    }
}

/**
 * Import environment variables from a .env file
 */
export async function importEnvFile(
    appName: string,
    filePath: string
): Promise<void> {
    if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    try {
        const content = await readFile(filePath, "utf-8");
        const vars: Record<string, string> = {};

        // Parse .env format
        content.split("\n").forEach((line) => {
            line = line.trim();

            if (!line || line.startsWith("#")) {
                return;
            }

            const [key, ...valueParts] = line.split("=");
            if (key && valueParts.length > 0) {
                vars[key.trim()] = valueParts.join("=").trim();
            }
        });

        await saveEnvVars(appName, vars);
    } catch (error: any) {
        throw new Error(`Failed to import env file: ${error.message}`);
    }
}

/**
 * Export environment variables to a file
 */
export async function exportEnvFile(
    appName: string,
    outputPath: string
): Promise<void> {
    const vars = await loadEnvVars(appName);

    const content = Object.entries(vars)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    await writeFile(outputPath, content, "utf-8");
}

/**
 * Set a single environment variable
 */
export async function setEnvVar(
    appName: string,
    key: string,
    value: string
): Promise<void> {
    await saveEnvVars(appName, { [key]: value });
}

/**
 * Unset (delete) an environment variable
 */
export async function unsetEnvVar(appName: string, key: string): Promise<void> {
    const vars = await loadEnvVars(appName);
    delete vars[key];

    const envFilePath = getEnvFilePath(appName);

    if (Object.keys(vars).length === 0) {
        // If no vars left, delete the file
        if (existsSync(envFilePath)) {
            await unlink(envFilePath);
        }
    } else {
        // Write remaining vars
        const content = Object.entries(vars)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n");
        await writeFile(envFilePath, content, { mode: 0o600 });
    }
}

/**
 * List environment variable keys (not values for security)
 */
export async function listEnvVars(appName: string): Promise<string[]> {
    const vars = await loadEnvVars(appName);
    return Object.keys(vars);
}

/**
 * Check if app has any environment variables set
 */
export async function hasEnvVars(appName: string): Promise<boolean> {
    const envFilePath = getEnvFilePath(appName);
    return existsSync(envFilePath);
}
