/**
 * Docker Deployment Flow
 * Handles detection, generation, and deployment of Docker containers
 */

import { join, dirname } from "path";
import { existsSync } from "fs";
import { writeFile, readFile } from "fs/promises";
import * as yaml from "js-yaml";
import type { DeployFromPathOptions, DeployResult, DeployConfig } from "../types";
import { saveGeneratedFiles } from "./compose-generator";
import {
    buildImage,
    runContainer,
    stopContainer,
    removeContainer,
    containerStatus,
    composeUp,
    composeDown,
    checkDockerInstalled,
    checkComposeInstalled,
    getProjectContainers,
} from "../commands/docker";
import { OKASTR8_HOME } from "../config";
import { importEnvFile } from "./env-manager";

const APPS_DIR = join(OKASTR8_HOME, "apps");

type PreparedComposeFiles = {
    composePath: string;
    composeFiles: string[];
    overridePath?: string;
};

export async function resolveDockerEnvFile(
    envFilePath: string,
    required: boolean
): Promise<string | undefined> {
    if (!existsSync(envFilePath)) {
        if (required) {
            throw new Error(`Expected ${envFilePath} to exist after env persistence`);
        }
        return undefined;
    }

    const content = await readFile(envFilePath, "utf-8");
    if (content.trim().length === 0) {
        throw new Error(`${envFilePath} is empty`);
    }

    return envFilePath;
}

export async function prepareUserComposeFiles(
    releasePath: string,
    envFilePath: string | undefined,
    log: (msg: string) => void
): Promise<PreparedComposeFiles> {
    const composePath = join(releasePath, "docker-compose.yml");
    const composeFiles = [composePath];

    if (!envFilePath) {
        return { composePath, composeFiles };
    }

    await resolveDockerEnvFile(envFilePath, true);

    log("   Injecting environment variables via override file...");
    const composeContent = await readFile(composePath, "utf-8");
    const composeYaml = yaml.load(composeContent) as any;
    const services = composeYaml?.services;

    if (!services || typeof services !== "object" || Array.isArray(services)) {
        throw new Error(`${composePath} must define services before env_file can be injected`);
    }

    const override = {
        services: {} as Record<string, { env_file: string[] }>,
    };

    for (const service of Object.keys(services)) {
        override.services[service] = {
            env_file: [envFilePath],
        };
    }

    if (Object.keys(override.services).length === 0) {
        throw new Error(`${composePath} does not define any services`);
    }

    const overridePath = join(releasePath, "docker-compose.override.yml");
    await writeFile(overridePath, yaml.dump(override));
    log(`   Created override: ${overridePath}`);

    return {
        composePath,
        composeFiles: [...composeFiles, overridePath],
        overridePath,
    };
}

/**
 * Detect deployment strategy
 */
export async function detectDockerStrategy(
    releasePath: string,
    config: DeployConfig
): Promise<"user-compose" | "user-dockerfile" | "auto-compose" | "auto-dockerfile"> {
    // Priority 1: User-provided docker-compose.yml
    if (existsSync(join(releasePath, "docker-compose.yml"))) {
        return "user-compose";
    }

    // Priority 2: User-provided Dockerfile
    if (existsSync(join(releasePath, "Dockerfile"))) {
        return "user-dockerfile";
    }

    // Priority 3: Auto-generate based on services
    if (config.database || config.cache) {
        return "auto-compose";
    }

    // Priority 4: Simple Dockerfile
    return "auto-dockerfile";
}
/**
 * Wait for container to be healthy
 */
async function waitForHealth(
    containerName: string,
    maxWaitSeconds: number,
    log: (msg: string) => void
): Promise<boolean> {
    const pollIntervalMs = 2000;

    for (let elapsed = 0; elapsed < maxWaitSeconds; elapsed += 2) {
        const status = await containerStatus(containerName);

        if (!status.running) {
            if (status.status === "exited" || status.status === "dead") {
                log(`Container ${containerName} exited unexpectedly`);
                return false;
            }
            // If starting, keep waiting
        }

        // Container is running - that's good enough!
        // Docker's HEALTHCHECK may fail if app doesn't have /health endpoint,
        // but if the container is running, the app is likely working.
        if (status.running) {
            if (status.health === "healthy") {
                log(`Container ${containerName} is healthy`);
            } else if (status.health === "unhealthy") {
                log(
                    `Warning: Container ${containerName} running but HEALTHCHECK failed (this is often OK)`
                );
            } else {
                log(`Container ${containerName} is running`);
            }
            return true;
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    log(`Warning: Health check timeout for ${containerName} after ${maxWaitSeconds}s`);
    return false;
}
/**
 * Main Docker deployment entry point
 */
export async function deployWithDocker(
    options: DeployFromPathOptions,
    config: DeployConfig
): Promise<DeployResult> {
    const { appName, releasePath, versionId, onProgress, deploymentId } = options;
    const log = onProgress || ((msg: string) => console.log(msg));

    let envFilePath: string | undefined;

    try {
        // 1. Handle Environment Variables
        const { saveEnvVars } = await import("./env-manager");

        // A. Env file from repository (cloned code) - Loaded FIRST
        const repoEnvPath = join(releasePath, ".env");
        const hasRepoEnv = existsSync(repoEnvPath);
        if (hasRepoEnv) {
            log("Importing .env from repository...");
            await importEnvFile(appName, repoEnvPath);
        }

        // B. Manual env vars from options (UI/Manual trigger) - Loaded SECOND (overwrites)
        const manualEnvCount = options.env ? Object.keys(options.env).length : 0;
        if (options.env && manualEnvCount > 0) {
            log(`Applying ${manualEnvCount} manual environment variables...`);
            await saveEnvVars(appName, options.env);
        }

        // C. Determine final env file to use for Docker
        // We always prefer the persistent okastr8 one if it exists.
        const persistentEnvPath = join(APPS_DIR, appName, ".env.production");
        envFilePath = await resolveDockerEnvFile(
            persistentEnvPath,
            hasRepoEnv || manualEnvCount > 0
        );
        if (envFilePath) {
            log(`   Environment file: ${envFilePath}`);
        }
    } catch (error: any) {
        return {
            success: false,
            message: `Failed to prepare Docker environment file: ${error.message}`,
            config,
        };
    }

    // 2. Universal Cleanup: Stop both possible strategies to ensure a clean slate
    // This handles cases where a user switches from Dockerfile to Compose or vice-versa,
    // and also ensures legacy systemd services are cleared.
    log("Ensuring clean slate for deployment...");

    // A. Clean up Docker Resources - direct container
    await stopContainer(appName).catch(() => {});
    await removeContainer(appName).catch(() => {});

    // B. Clean up Compose services - check multiple possible locations/names
    const currentDir = join(APPS_DIR, appName, "current");
    const composeFiles = [
        join(currentDir, "docker-compose.yml"),
        join(currentDir, "docker-compose.generated.yml"),
    ];

    for (const composePath of composeFiles) {
        if (existsSync(composePath)) {
            log("Stopping existing Compose services...");
            await composeDown(composePath, appName, deploymentId).catch(() => {});
            break; // Only need to stop once
        }
    }

    // C. Also try to stop by project name label (catches any compose containers we might have missed)
    const projectContainers = await getProjectContainers(appName);
    if (projectContainers.length > 0) {
        log(`Stopping ${projectContainers.length} compose project container(s)...`);
        for (const container of projectContainers) {
            await stopContainer(container.name).catch(() => {});
            await removeContainer(container.name).catch(() => {});
        }
    }

    // B. Legacy Systemd Cleanup (Removed)
    // We no longer check for legacy systemd services to avoid sudo hangs and complexity.
    // If a user has a legacy app running on the same port, the container start will fail with "Port already in use",
    // which is a clear enough error message.

    // 3. Detect strategy
    const strategy = await detectDockerStrategy(releasePath, config);
    log(`Docker strategy: ${strategy}`);

    if (strategy === "user-compose" || strategy === "auto-compose") {
        return await deployWithCompose(
            appName,
            releasePath,
            config,
            strategy,
            envFilePath,
            log,
            deploymentId
        );
    } else {
        return await deployWithDockerfile(
            appName,
            releasePath,
            config,
            versionId,
            strategy,
            envFilePath,
            log,
            deploymentId
        );
    }
}

/**
 * Deploy using docker-compose
 */
async function deployWithCompose(
    appName: string,
    releasePath: string,
    config: DeployConfig,
    strategy: "auto-compose" | "user-compose",
    envFilePath: string | undefined,
    log: (msg: string) => void,
    deploymentId?: string
): Promise<DeployResult> {
    let composePath: string;
    let composeFiles: string[];

    if (strategy === "auto-compose") {
        log("Generating docker-compose.yml...");
        const files = await saveGeneratedFiles(releasePath, config, appName, envFilePath);
        composePath = files.compose!;
        composeFiles = [composePath];
        log(`   Generated: ${composePath}`);
    } else {
        try {
            const prepared = await prepareUserComposeFiles(releasePath, envFilePath, log);
            composePath = prepared.composePath;
            composeFiles = prepared.composeFiles;
            log(`   Using existing: ${composePath}`);
        } catch (e: any) {
            return {
                success: false,
                message: `Failed to prepare user Compose env injection: ${e.message}`,
                config,
            };
        }
    }

    // Ensure docker-compose is installed
    const composeInstalled = await checkComposeInstalled();
    if (!composeInstalled) {
        return {
            success: false,
            message:
                "docker-compose is not installed. Please install: https://docs.docker.com/compose/install/",
            config,
        };
    }

    // Start services
    log("Starting services...");
    log(`   Compose files: ${composeFiles.join(", ")}`);
    if (envFilePath) {
        log(`   Compose env file: ${envFilePath}`);
    }

    const upResult = await composeUp(composeFiles, appName, deploymentId, envFilePath);

    if (!upResult.success) {
        return {
            success: false,
            message: upResult.message,
            config,
        };
    }

    // Wait for health check logic - implied by compose or explicit check
    // Compose usually handles its own health if configured, but we can double check
    const containers = await getProjectContainers(appName);
    const healthy = containers.every(
        (c) => c.status.startsWith("Up") || c.status.includes("running")
    );

    if (!healthy) {
        return {
            success: false,
            message: "One or more services failed to start",
            config,
        };
    }

    return {
        success: true,
        message: "Docker Compose deployment successful",
        config,
    };
}

/**
 * Deploy using Dockerfile only
 */
async function deployWithDockerfile(
    appName: string,
    releasePath: string,
    config: DeployConfig,
    versionId: number,
    strategy: "auto-dockerfile" | "user-dockerfile",
    envFilePath: string | undefined,
    log: (msg: string) => void,
    deploymentId?: string
): Promise<DeployResult> {
    if (strategy === "auto-dockerfile") {
        log("Generating Dockerfile...");
        const files = await saveGeneratedFiles(releasePath, config, appName);
        log(`   Generated: ${files.dockerfile}`);
    } else {
        log(`   Using existing Dockerfile`);
    }

    // Build image
    const tag = `${appName}:v${versionId}`;
    log(`Building Docker image: ${tag}...`);
    const dockerfileName = strategy === "auto-dockerfile" ? "Dockerfile.generated" : "Dockerfile";
    const dockerfilePath = join(releasePath, dockerfileName);
    const buildResult = await buildImage(
        appName,
        tag,
        releasePath,
        dockerfilePath,
        deploymentId,
        log
    );

    if (!buildResult.success) {
        return {
            success: false,
            message: buildResult.message,
            config,
        };
    }

    // Run new container
    log("Starting new container...");
    const runResult = await runContainer(
        appName,
        tag,
        config.port!,
        undefined,
        envFilePath,
        deploymentId
    );

    if (!runResult.success) {
        return {
            success: false,
            message: runResult.message,
            config,
        };
    }

    // Wait for health
    log("Waiting for container to be healthy...");
    const healthy = await waitForHealth(appName, 60, log);

    if (!healthy) {
        return {
            success: false,
            message: "Container started but health check failed",
            config,
        };
    }

    return {
        success: true,
        message: `Successfully deployed ${appName} (v${versionId})`,
        config,
    };
}
