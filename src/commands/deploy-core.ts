/**
 * Deploy Core - Shared deployment logic
 * Used by both fresh imports and rollbacks
 */

import { join } from "path";
import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { OKASTR8_HOME } from "../config.ts";
import { runCommand } from "../utils/command.ts";
import { TaskProgress, cli } from "../utils/cli-logger.ts";

// Helper to get script path
// Since we are in src/commands, project root is ../..
const APPS_DIR = join(OKASTR8_HOME, "apps");

import type { DeployConfig, DeployFromPathOptions, DeployResult } from "../types";

/**
 * Deploy from an existing path (used for both fresh deploys and rollbacks)
 * 
 * Steps:
 * 1. Load okastr8.yaml from releasePath
 * 2. Auto-detect runtime if not specified
 * 3. Deploy with Docker
 * 4. Update symlink to this version
 * 5. Update metadata
 */
export async function deployFromPath(options: DeployFromPathOptions): Promise<DeployResult> {
    const { appName, releasePath, versionId, gitRepo, gitBranch, onProgress } = options;

    const task = new TaskProgress([
        "config",
        "runtime",
        "port",
        "deploy",
        "symlink",
        "metadata",
        "proxy"
    ]);

    const log = (msg: string) => {
        task.log(msg);
        if (onProgress) onProgress(msg);
    };

    const appDir = join(APPS_DIR, appName);
    const currentPath = join(appDir, "current");

    task.step("config", "Loading application configuration...");
    const configPath = join(releasePath, "okastr8.yaml");

    if (!existsSync(configPath)) {
        task.fail(`okastr8.yaml not found at ${configPath}`);
        return {
            success: false,
            message: `okastr8.yaml not found at ${configPath}`,
        };
    }

    let config: DeployConfig;
    try {
        const { load } = await import('js-yaml');
        const configContent = await readFile(configPath, 'utf-8');
        const rawConfig = load(configContent) as any;

        config = {
            runtime: rawConfig.runtime,
            buildSteps: rawConfig.build || [],
            startCommand: rawConfig.start || '',
            port: rawConfig.networking?.port || rawConfig.port || 3000,
            domain: rawConfig.networking?.domain || rawConfig.domain,
            database: rawConfig.database,
            cache: rawConfig.cache,
        };

        log(`Configuration loaded`);
    } catch (error: any) {
        task.fail(`Failed to parse okastr8.yaml: ${error.message}`);
        return {
            success: false,
            message: `Failed to parse okastr8.yaml: ${error.message}`,
        };
    }

    if (!config.startCommand) {
        task.fail("No start command specified in okastr8.yaml");
        return {
            success: false,
            message: "No start command specified in okastr8.yaml",
            config,
        };
    }

    if (!config.port) {
        task.fail("No port specified in okastr8.yaml");
        return {
            success: false,
            message: "No port specified in okastr8.yaml. Port is required for health checks.",
            config,
        };
    }

    // Early-stage port conflict check
    try {
        task.step("port", `Checking port ${config.port} availability...`);
        await checkPortAvailability(config.port, appName, log);
    } catch (error: any) {
        task.fail(`Port conflict: ${error.message}`);
        return {
            success: false,
            message: `Port conflict detected: ${error.message}`,
            config,
        };
    }

    // 2. Auto-detect runtime if not specified
    if (!config.runtime) {
        task.step("runtime", "Auto-detecting runtime...");
        const { detectRuntime } = await import("../utils/runtime-detector.ts");
        try {
            config.runtime = await detectRuntime(releasePath);
            log(`Detected: ${config.runtime}`);
        } catch (error: any) {
            task.fail(error.message);
            return {
                success: false,
                message: error.message,
                config,
            };
        }
    } else {
        log(`Runtime: ${config.runtime}`);
    }

    // 3. Deploy with Docker
    task.step("deploy", "Deploying with Docker...");
    log(`💡 Tip: Apps must bind to 0.0.0.0 (not localhost) to be accessible. We inject HOST=0.0.0.0 automatically.`);
    const { deployWithDocker } = await import("../utils/deploy-docker.ts");
    const deployResult = await deployWithDocker(options, config);

    if (!deployResult.success) {
        task.fail(deployResult.message);
        return deployResult;
    }

    // 4. Update symlink to this version
    task.step("symlink", "Switching to new version...");
    const { setCurrentVersion } = await import("./version.ts");
    await setCurrentVersion(appName, versionId);

    // 5. Update app.json with metadata
    task.step("metadata", "Updating application metadata...");
    const metadataPath = join(appDir, "app.json");
    let existingMetadata: any = {};
    try {
        const content = await readFile(metadataPath, "utf-8");
        existingMetadata = JSON.parse(content);
    } catch { }

    const { writeFile: fsWriteFile } = await import("fs/promises");
    const user = process.env.USER || "root";

    await fsWriteFile(
        metadataPath,
        JSON.stringify(
            {
                name: appName,
                runtime: config.runtime,
                execStart: config.startCommand,
                workingDirectory: currentPath,
                user: user,
                port: config.port,
                domain: config.domain,
                gitRepo,
                gitBranch,
                buildSteps: config.buildSteps,
                database: config.database,
                cache: config.cache,
                createdAt: existingMetadata.createdAt || new Date().toISOString(),
                deploymentType: "docker",
                versions: existingMetadata.versions || [],
                currentVersionId: versionId,
            },
            null,
            2
        )
    );

    // 6. Update Caddy configuration (Reverse Proxy)
    try {
        task.step("proxy", "Updating reverse proxy configuration...");
        const { genCaddyFile } = await import("../utils/genCaddyFile.ts");
        await genCaddyFile(log);
    } catch (e) {
        log(`Failed to update Caddy: ${e instanceof Error ? e.message : String(e)}`);
    }

    task.success(`Successfully deployed ${appName} (v${versionId})`);

    return {
        success: true,
        message: `Successfully deployed ${appName} (v${versionId}) with Docker`,
        config,
    };
}

/**
 * Check if a port is available for the given app
 * Throws an error if port is taken by another app or system process
 */
async function checkPortAvailability(port: number, myAppName: string, log: (msg: string) => void) {
    // 1. System Check (ss) - FASTEST
    // This immediately tells us if ANYTHING is listening on the port
    try {
        const check = await runCommand("ss", ["-ltn", `sport = :${port}`]);
        const isListening = check.stdout.includes(`:${port}`);

        if (!isListening) {
            // Port is free at system level. 
            // We still do a Registry Check (Okastr8 Scan) to prevent logical conflicts 
            // (e.g., if another app is configured for this port but not currently running).
            return await checkRegistryConflict(port, myAppName);
        }

        // Port is TAKEN at system level. Now we investigate why.

        // A. Is it me in Docker?
        try {
            // Use a targeted check for this specific app's container
            const { containerStatus } = await import("./docker.ts");
            const status = await containerStatus(myAppName);

            if (status.running) {
                // If it's running, check if it's the one using the port
                const { listContainers } = await import("./docker.ts");
                const containers = await listContainers();
                const myContainer = containers.find(c => c.name === myAppName);

                if (myContainer && myContainer.ports.includes(`:${port}`)) {
                    log(`Port ${port} is currently held by a running instance of this app. It will be released during deployment.`);
                    return; // It's us, this is fine
                }
            }
        } catch (e) {
            // If Docker check fails or sudo prompts, we fall through to generic error
        }

        // B. Registry Check to see if we know who it is
        await checkRegistryConflict(port, myAppName);

        // C. Generic Fallback
        throw new Error(`Port ${port} is occupied by an external process or another service. Please free the port before deploying.`);

    } catch (e: any) {
        // Re-throw valid conflict errors
        if (e.message.includes('occupied') || e.message.includes('already registered')) throw e;
        // For other errors (like ss not found), we fallback to registry check just in case
        await checkRegistryConflict(port, myAppName);
    }
}

/**
 * Check if the port is registered to another Okastr8 app in metadata
 */
async function checkRegistryConflict(port: number, myAppName: string) {
    try {
        const apps = await readdir(APPS_DIR);
        for (const app of apps) {
            if (app === myAppName) continue;

            const metaPath = join(APPS_DIR, app, "app.json");
            try {
                const content = await readFile(metaPath, "utf-8");
                const meta = JSON.parse(content);
                const metaPort = meta.networking?.port || meta.port;

                if (metaPort === port) {
                    throw new Error(`Port ${port} is already registered to application '${app}'`);
                }
            } catch (e) { }
        }
    } catch (e: any) {
        if (e.message.includes('already registered')) throw e;
    }
}
