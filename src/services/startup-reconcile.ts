import { join } from "path";
import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { OKASTR8_HOME } from "../config";
import {
    checkDockerInstalled,
    containerStatus,
    startAppTunnelContainer,
    stopAppTunnelContainer,
} from "../commands/docker";

const APPS_DIR = join(OKASTR8_HOME, "apps");

type AppMeta = {
    tunnel_routing?: boolean;
    deploymentType?: string;
    currentVersionId?: number;
};

export function parseTunnelTokenFromEnv(content: string): string | undefined {
    const lines = content.split("\n");
    for (const line of lines) {
        const match = line.match(/^TUNNEL_TOKEN=(.*)$/);
        if (match && match[1]) {
            const token = match[1].replace(/['"]/g, "").trim();
            if (token.length > 0) return token;
        }
    }
    return undefined;
}

async function reconcileApp(appName: string): Promise<void> {
    const appDir = join(APPS_DIR, appName);
    const appMetaPath = join(appDir, "app.json");
    if (!existsSync(appMetaPath)) return;

    let meta: AppMeta;
    try {
        meta = JSON.parse(await readFile(appMetaPath, "utf-8")) as AppMeta;
    } catch {
        console.warn(`[StartupReconcile] Skipping ${appName}: invalid app.json`);
        return;
    }

    const appStatus = await containerStatus(appName);
    console.log(
        `[StartupReconcile] App ${appName}: ${appStatus.running ? "running" : appStatus.status}`
    );

    const tunnelContainerName = `${appName}-tunnel`;
    const tunnelStatus = await containerStatus(tunnelContainerName);
    const tunnelRouting = meta.tunnel_routing === true;

    if (!tunnelRouting) {
        if (tunnelStatus.running || tunnelStatus.status === "restarting") {
            const result = await stopAppTunnelContainer(appName);
            console.log(`[StartupReconcile] ${appName}: disabled tunnel sidecar (${result.message})`);
        }
        return;
    }

    const envPath = join(appDir, ".env.production");
    if (!existsSync(envPath)) {
        console.warn(
            `[StartupReconcile] ${appName}: tunnel_routing enabled but .env.production missing`
        );
        return;
    }

    const token = parseTunnelTokenFromEnv(await readFile(envPath, "utf-8"));
    if (!token) {
        console.warn(
            `[StartupReconcile] ${appName}: tunnel_routing enabled but TUNNEL_TOKEN missing`
        );
        return;
    }

    if (!tunnelStatus.running) {
        const result = await startAppTunnelContainer(appName, token);
        if (!result.success) {
            console.warn(`[StartupReconcile] ${appName}: ${result.message}`);
        } else {
            console.log(`[StartupReconcile] ${appName}: tunnel sidecar restored`);
        }
    } else {
        console.log(`[StartupReconcile] ${appName}: tunnel sidecar running`);
    }
}

export async function reconcileRuntimeAfterBoot(): Promise<void> {
    if (!existsSync(APPS_DIR)) {
        return;
    }

    const dockerReady = await checkDockerInstalled();
    if (!dockerReady) {
        console.warn("[StartupReconcile] Docker not available, skipping runtime reconcile");
        return;
    }

    const entries = await readdir(APPS_DIR, { withFileTypes: true });
    const appNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    if (appNames.length === 0) return;

    console.log(`[StartupReconcile] Reconciling ${appNames.length} app(s) after boot...`);
    for (const appName of appNames) {
        try {
            await reconcileApp(appName);
        } catch (error: any) {
            console.warn(`[StartupReconcile] ${appName}: ${error?.message || String(error)}`);
        }
    }
    console.log("[StartupReconcile] Reconcile complete");
}
