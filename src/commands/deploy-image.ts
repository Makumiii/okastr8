import type { AppConfig } from "./app";
import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import {
    checkDockerInstalled,
    containerStatus,
    dockerLogin,
    dockerLogout,
    imageExists,
    inspectImageDigest,
    pullImage,
    removeContainer,
    runContainer,
    stopContainer,
} from "./docker";
import { logActivity } from "../utils/activity";
import { OKASTR8_HOME } from "../config";
import { getRegistryLoginMaterial } from "./registry";
import { normalizeImageRef, resolveRegistryServer } from "../utils/registry-image";

const APPS_DIR = join(OKASTR8_HOME, "apps");

export interface ImageDeployOptions {
    appName: string;
    metadata: AppConfig;
    env?: Record<string, string>;
}

export interface ImageReleaseRecord {
    id: number;
    deployedAt: string;
    imageRef: string;
    imageDigest?: string;
    containerPort: number;
    hostPort: number;
    pullPolicy: "always" | "if-not-present";
    registryCredentialId?: string;
    registryServer?: string;
    registryProvider?: "ghcr" | "dockerhub" | "ecr" | "generic";
}

export function pruneImageReleases(
    releases: ImageReleaseRecord[],
    retention?: number
): ImageReleaseRecord[] {
    if (!retention || retention <= 0) {
        return releases;
    }
    if (releases.length <= retention) {
        return releases;
    }
    return releases.slice(releases.length - retention);
}

export function selectImageRollbackTarget(
    releases: ImageReleaseRecord[],
    target?: string
): ImageReleaseRecord | null {
    if (releases.length === 0) {
        return null;
    }

    if (target) {
        const matched = releases.find(
            (r) => r.imageDigest === target || r.imageRef === target || String(r.id) === target
        );
        return matched || null;
    }

    if (releases.length < 2) {
        return null;
    }

    return releases[releases.length - 2] || null;
}

async function waitForContainerHealth(
    containerName: string,
    maxWaitSeconds = 60
): Promise<boolean> {
    for (let elapsed = 0; elapsed < maxWaitSeconds; elapsed += 2) {
        const status = await containerStatus(containerName);

        if (status.running) {
            return true;
        }

        if (status.status === "exited" || status.status === "dead") {
            return false;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return false;
}

export async function updateAppFromImage(
    options: ImageDeployOptions
): Promise<{ success: boolean; message: string }> {
    const { appName, metadata, env } = options;
    const deploymentId = randomUUID();
    const startTime = Date.now();

    try {
        if (!metadata.imageRef) {
            throw new Error("Image strategy requires imageRef in app metadata");
        }
        const normalizedImageRef = normalizeImageRef(metadata.imageRef);
        if (!metadata.port) {
            throw new Error("Image strategy requires a configured app port");
        }
        const containerPort = metadata.containerPort || metadata.port;

        const dockerReady = await checkDockerInstalled();
        if (!dockerReady) {
            throw new Error("Docker is not installed or not accessible");
        }

        await logActivity("deploy", {
            id: deploymentId,
            status: "started",
            appName,
            strategy: "image",
            imageRef: normalizedImageRef,
        });

        const credentialId = metadata.registryCredentialId;
        const registryServer = metadata.registryServer || resolveRegistryServer(normalizedImageRef);
        let loggedIn = false;
        if (credentialId) {
            const loginMaterial = await getRegistryLoginMaterial(credentialId);
            if (
                !loginMaterial.success ||
                !loginMaterial.server ||
                !loginMaterial.username ||
                !loginMaterial.password
            ) {
                throw new Error(
                    loginMaterial.message || `Registry credential '${credentialId}' not found`
                );
            }

            const loginResult = await dockerLogin(
                loginMaterial.server || registryServer,
                loginMaterial.username,
                loginMaterial.password
            );
            if (!loginResult.success) {
                throw new Error(loginResult.message);
            }
            loggedIn = true;
        }

        const pullPolicy = metadata.pullPolicy || "always";
        const shouldPull = pullPolicy === "always" || !(await imageExists(normalizedImageRef));
        if (shouldPull) {
            const pullResult = await pullImage(normalizedImageRef);
            if (!pullResult.success) {
                throw new Error(pullResult.message);
            }
        }

        const imageDigest = await inspectImageDigest(normalizedImageRef);

        if (env && Object.keys(env).length > 0) {
            const { saveEnvVars } = await import("../utils/env-manager");
            await saveEnvVars(appName, env);
        }

        await stopContainer(appName).catch(() => {});
        await removeContainer(appName).catch(() => {});

        const envPath = join(APPS_DIR, appName, ".env.production");
        const envFilePath = existsSync(envPath) ? envPath : undefined;

        const runResult = await runContainer(
            appName,
            normalizedImageRef,
            metadata.port,
            containerPort,
            envFilePath
        );
        if (!runResult.success) {
            throw new Error(runResult.message);
        }

        const healthy = await waitForContainerHealth(appName, 60);
        if (!healthy) {
            throw new Error("Container failed health/startup check");
        }

        const metadataPath = join(APPS_DIR, appName, "app.json");
        const content = await readFile(metadataPath, "utf-8");
        const current = JSON.parse(content);
        const releases = Array.isArray(current.imageReleases)
            ? (current.imageReleases as ImageReleaseRecord[])
            : [];
        const nextReleaseId = releases.reduce((max, r) => Math.max(max, r.id), 0) + 1;

        const releaseRecord: ImageReleaseRecord = {
            id: nextReleaseId,
            deployedAt: new Date().toISOString(),
            imageRef: normalizedImageRef,
            imageDigest: imageDigest,
            containerPort,
            hostPort: metadata.port,
            pullPolicy,
            registryCredentialId: credentialId,
            registryServer,
            registryProvider: metadata.registryProvider || current.registryProvider,
        };

        const retention = Number(
            current.imageReleaseRetention || metadata.imageReleaseRetention || 50
        );
        const allReleases = [...releases, releaseRecord];
        const prunedReleases = pruneImageReleases(allReleases, retention);

        current.deployStrategy = "image";
        current.imageRef = normalizedImageRef;
        current.imageDigest = imageDigest;
        current.pullPolicy = pullPolicy;
        current.registryCredentialId = credentialId;
        current.registryServer = registryServer;
        current.registryProvider = metadata.registryProvider || current.registryProvider;
        current.containerPort = containerPort;
        current.imageReleaseRetention = retention;
        current.lastDeployedAt = new Date().toISOString();
        current.imageReleases = prunedReleases;
        current.currentImageReleaseId = releaseRecord.id;
        await writeFile(metadataPath, JSON.stringify(current, null, 2));

        if (loggedIn) {
            await dockerLogout(registryServer).catch(() => {});
        }

        await logActivity("deploy", {
            id: deploymentId,
            status: "success",
            appName,
            strategy: "image",
            imageRef: normalizedImageRef,
            imageDigest,
            duration: (Date.now() - startTime) / 1000,
        });

        return {
            success: true,
            message: imageDigest
                ? `Image deployment successful: ${normalizedImageRef} (${imageDigest})`
                : `Image deployment successful: ${normalizedImageRef}`,
        };
    } catch (error: any) {
        const registryServer =
            metadata.registryServer ||
            (metadata.imageRef ? resolveRegistryServer(metadata.imageRef) : "");
        if (registryServer) {
            await dockerLogout(registryServer).catch(() => {});
        }

        await logActivity("deploy", {
            id: deploymentId,
            status: "failed",
            appName,
            strategy: "image",
            error: error.message,
            duration: (Date.now() - startTime) / 1000,
        });

        return {
            success: false,
            message: error.message || "Image deployment failed",
        };
    }
}

export async function rollbackImageApp(
    appName: string,
    target?: string
): Promise<{ success: boolean; message: string }> {
    const metadataPath = join(APPS_DIR, appName, "app.json");
    let metadata: AppConfig & { imageReleases?: ImageReleaseRecord[] };

    try {
        const content = await readFile(metadataPath, "utf-8");
        metadata = JSON.parse(content);
    } catch {
        return { success: false, message: `App '${appName}' metadata not found` };
    }

    const releases = Array.isArray(metadata.imageReleases) ? metadata.imageReleases : [];
    const selected = selectImageRollbackTarget(releases, target);
    if (!selected) {
        return {
            success: false,
            message: target
                ? `No image release found matching '${target}'`
                : "No previous image release available for rollback",
        };
    }

    const rollbackMetadata: AppConfig = {
        ...metadata,
        imageRef: selected.imageRef,
        pullPolicy: "always",
        containerPort: selected.containerPort,
        port: selected.hostPort,
        registryCredentialId: selected.registryCredentialId,
        registryServer: selected.registryServer,
        registryProvider: selected.registryProvider,
        deployStrategy: "image",
    };

    const result = await updateAppFromImage({
        appName,
        metadata: rollbackMetadata,
    });

    if (!result.success) {
        return result;
    }

    return {
        success: true,
        message: `Rolled back '${appName}' to ${selected.imageDigest || selected.imageRef}`,
    };
}
