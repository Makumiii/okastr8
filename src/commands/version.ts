/**
 * App Version Management
 * Tracks deployments and enables instant rollback via symlinks
 * Consolidates all history into app.json
 */

import { readFile, writeFile, mkdir, rm, symlink, unlink, rename } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { OKASTR8_HOME } from "../config";
const APPS_DIR = join(OKASTR8_HOME, "apps");

export interface AppVersion {
    id: number;
    commit: string;
    branch: string;
    timestamp: string;
    status: "pending" | "building" | "deploying" | "active" | "success" | "failed";
    message?: string;
}

export interface VersionsRes {
    versions: AppVersion[];
    current: number | null;
    maxVersions: number;
}

/**
 * Get the app.json path
 */
function getAppJsonPath(appName: string): string {
    return join(APPS_DIR, appName, "app.json");
}

/**
 * Get the releases directory
 */
function getReleasesDir(appName: string): string {
    return join(APPS_DIR, appName, "releases");
}

/**
 * Get the current symlink path
 */
function getCurrentPath(appName: string): string {
    return join(APPS_DIR, appName, "current");
}

/**
 * Get version history from app.json
 * Auto-migrates from versions.json if it exists
 */
export async function getVersions(appName: string): Promise<VersionsRes> {
    const appJsonPath = getAppJsonPath(appName);
    const versionsJsonPath = join(APPS_DIR, appName, "versions.json");

    let versions: AppVersion[] = [];
    let currentVersionId: number | null = null;

    // Check for legacy versions.json first
    if (existsSync(versionsJsonPath)) {
        try {
            const legacyContent = await readFile(versionsJsonPath, "utf-8");
            const legacyData = JSON.parse(legacyContent);
            versions = legacyData.versions || [];
            currentVersionId = legacyData.current || null;

            // Migrate to app.json immediately
            await updateAppJson(appName, { versions, currentVersionId });

            // Delete legacy file
            await unlink(versionsJsonPath);
        } catch (e) {
            console.warn(`Failed to migrate versions.json for ${appName}:`, e);
        }
    }
    // Otherwise read from app.json
    else if (existsSync(appJsonPath)) {
        try {
            const content = await readFile(appJsonPath, "utf-8");
            const appData = JSON.parse(content);
            versions = appData.versions || [];
            currentVersionId = appData.currentVersionId || null;
        } catch {
            // Corrupt or empty app.json, return defaults
            versions = [];
            currentVersionId = null;
        }
    }

    return {
        versions,
        current: currentVersionId,
        maxVersions: 5
    };
}

/**
 * Update app.json with partial data
 */
async function updateAppJson(appName: string, updates: any): Promise<void> {
    const appJsonPath = getAppJsonPath(appName);
    let currentData: any = {};

    // Create directory if missing
    const appDir = join(APPS_DIR, appName);
    if (!existsSync(appDir)) {
        await mkdir(appDir, { recursive: true });
    }

    if (existsSync(appJsonPath)) {
        try {
            const content = await readFile(appJsonPath, "utf-8");
            currentData = JSON.parse(content);
        } catch { }
    } else {
        // Initialize minimal app.json if missing
        currentData = {
            name: appName,
            createdAt: new Date().toISOString()
        };
    }

    const newData = { ...currentData, ...updates };
    await writeFile(appJsonPath, JSON.stringify(newData, null, 2));
}

/**
 * SAVE versions (wrapper around updateAppJson)
 */
async function saveVersions(appName: string, versions: AppVersion[], currentVersionId: number | null): Promise<void> {
    await updateAppJson(appName, { versions, currentVersionId });
}


/**
 * Create a new version entry (before build)
 */
export async function createVersion(
    appName: string,
    commit: string,
    branch: string
): Promise<{ versionId: number; releasePath: string }> {
    const data = await getVersions(appName);
    const releasesDir = getReleasesDir(appName);

    await mkdir(releasesDir, { recursive: true });

    const maxId = data.versions.reduce((max, v) => Math.max(max, v.id), 0);
    const newId = maxId + 1;

    const newVersion: AppVersion = {
        id: newId,
        commit,
        branch,
        timestamp: new Date().toISOString(),
        status: "pending"
    };

    data.versions.push(newVersion);
    await saveVersions(appName, data.versions, data.current);

    const releasePath = join(releasesDir, `v${newId}`);
    return { versionId: newId, releasePath };
}

/**
 * Update version status
 */
export async function updateVersionStatus(
    appName: string,
    versionId: number,
    status: AppVersion["status"],
    message?: string
): Promise<void> {
    const data = await getVersions(appName);
    const version = data.versions.find(v => v.id === versionId);

    if (version) {
        version.status = status;
        if (message) version.message = message;
        await saveVersions(appName, data.versions, data.current);
    }
}

/**
 * Set the current active version (creates/updates symlink)
 */
export async function setCurrentVersion(appName: string, versionId: number): Promise<boolean> {
    const data = await getVersions(appName);
    const version = data.versions.find(v => v.id === versionId);

    if (!version) return false;

    const releasePath = join(getReleasesDir(appName), `v${versionId}`);
    const currentPath = getCurrentPath(appName);

    if (!existsSync(releasePath)) return false;

    try {
        if (existsSync(currentPath)) {
            await unlink(currentPath);
        }
    } catch { }

    await symlink(releasePath, currentPath);

    // Update app.json
    await saveVersions(appName, data.versions, versionId);

    return true;
}

/**
 * Rollback to a specific version
 * Runs the FULL deploy process (build, service restart, health check)
 * to ensure the version actually works
 */
export async function rollback(
    appName: string,
    versionId: number,
    onProgress?: (msg: string) => void
): Promise<{ success: boolean; message: string }> {
    const log = onProgress || ((msg: string) => console.log(msg));
    const progressHandler = onProgress ? log : undefined;

    const data = await getVersions(appName);
    const version = data.versions.find(v => v.id === versionId);

    if (!version) {
        return { success: false, message: `Version ${versionId} not found` };
    }

    if (data.current === versionId) {
        return { success: false, message: "Cannot rollback to the active version" };
    }

    if (version.status !== "success" && version.status !== "active") {
        return { success: false, message: `Cannot rollback to ${version.status} version` };
    }

    const releasePath = join(getReleasesDir(appName), `v${versionId}`);
    if (!existsSync(releasePath)) {
        return { success: false, message: `Release artifact v${versionId} missing` };
    }

    log(`Rolling back ${appName} to v${versionId}...`);

    // Use the deploy core to run the full deploy process
    const { deployFromPath } = await import("./deploy-core");

    const result = await deployFromPath({
        appName,
        releasePath,
        versionId,
        gitBranch: version.branch,
        onProgress: progressHandler,
    });

    if (result.success) {
        log(` Rollback to v${versionId} complete!`);
    } else {
        log(` Rollback failed: ${result.message}`);
    }

    return result;
}

/**
 * Remove a specific version entry from history AND delete its folder
 */
export async function removeVersion(appName: string, versionId: number): Promise<void> {
    // Delete the release folder first
    const releasePath = join(getReleasesDir(appName), `v${versionId}`);
    try {
        await rm(releasePath, { recursive: true, force: true });
    } catch { }

    const data = await getVersions(appName);
    const newVersions = data.versions.filter(v => v.id !== versionId);

    // If we removed the current version (shouldn't happen for failed deploys, but safety check)
    let newCurrent = data.current;
    if (data.current === versionId) {
        newCurrent = null;
    }

    await saveVersions(appName, newVersions, newCurrent);
}

/**
 * Clean up old versions
 */
export async function cleanOldVersions(appName: string): Promise<void> {
    const data = await getVersions(appName);
    const maxVersions = data.maxVersions || 5;

    const successfulVersions = data.versions
        .filter(v => v.status === "success")
        .sort((a, b) => b.id - a.id);

    const versionsToDelete = successfulVersions
        .slice(maxVersions)
        .filter(v => v.id !== data.current);

    const failedVersions = successfulVersions.length > 0
        ? data.versions.filter(v => v.status === "failed" && v.id < successfulVersions[0]!.id)
        : [];

    const allToDelete = [...versionsToDelete, ...failedVersions];

    for (const version of allToDelete) {
        const releasePath = join(getReleasesDir(appName), `v${version.id}`);
        try {
            await rm(releasePath, { recursive: true, force: true });
        } catch { }

        const index = data.versions.findIndex(v => v.id === version.id);
        if (index !== -1) data.versions.splice(index, 1);
    }

    await saveVersions(appName, data.versions, data.current);
}

/**
 * Initialize version tracking (Migration Logic)
 */
export async function initializeVersioning(appName: string): Promise<void> {
    const data = await getVersions(appName);

    // If versions exist, we're good
    if (data.versions.length > 0) return;

    // AUTO-MIGRATION:
    // If we have a 'repo' folder but no versions, treat 'repo' as v1
    const appDir = join(APPS_DIR, appName);
    const legacyRepo = join(appDir, "repo");
    const releasesDir = getReleasesDir(appName);
    const v1Path = join(releasesDir, "v1");
    const currentPath = getCurrentPath(appName);

    if (existsSync(legacyRepo)) {
        // Move repo -> releases/v1
        await mkdir(releasesDir, { recursive: true });

        // Only move if v1 doesn't exist
        if (!existsSync(v1Path)) {
            await rename(legacyRepo, v1Path);
        }

        // Link current -> v1
        if (existsSync(currentPath)) await unlink(currentPath);
        await symlink(v1Path, currentPath);

        // Create initial v1 history
        const v1: AppVersion = {
            id: 1,
            commit: "legacy-import",
            branch: "main",
            timestamp: new Date().toISOString(),
            status: "success",
            message: "Migrated from legacy deployment"
        };

        await saveVersions(appName, [v1], 1);

        // Update unit file to point to current if needed
        // (We won't touch unit file here, user will need to redeploy or restart eventually)
    }
}

export async function getCurrentVersion(appName: string): Promise<AppVersion | null> {
    const data = await getVersions(appName);
    if (!data.current) return null;
    return data.versions.find(v => v.id === data.current) || null;
}
