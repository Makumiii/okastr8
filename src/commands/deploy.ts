import { Command } from "commander";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runCommand } from "../utils/command";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolveDeployStrategy } from "../utils/deploy-strategy";

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/commands/
const PROJECT_ROOT = join(__dirname, "..", "..");

// Scripts
const SCRIPTS = {
    healthCheck: join(PROJECT_ROOT, "scripts", "deploy", "health-check.sh"),
    restart: join(PROJECT_ROOT, "scripts", "systemd", "restart.sh"),
};

export interface DeployOptions {
    appName: string;
    env?: Record<string, string>;
    publishImage?: {
        imageRef: string;
        registryCredentialId: string;
    };
}

export interface GitRollbackVersion {
    id: number;
    commit?: string;
    status?: string;
}

export interface DeployHistoryItem {
    gitHash: string;
    timeStamp: Date;
    ssh_url: string;
}

export function resolveGitRollbackTarget(
    versions: GitRollbackVersion[],
    currentVersionId: number | null,
    target?: string
): number | null {
    const sorted = versions.slice().sort((a, b) => b.id - a.id);
    if (sorted.length === 0) {
        return null;
    }

    if (target) {
        const numeric = Number.parseInt(target, 10);
        if (!Number.isNaN(numeric) && String(numeric) === target.trim()) {
            return numeric;
        }
        const match = sorted.find((version) => version.commit && version.commit.startsWith(target));
        return match?.id ?? null;
    }

    const fallback = sorted.find(
        (version) => version.id !== currentVersionId && version.status !== "failed"
    );
    return fallback?.id ?? null;
}

export async function runHealthCheck(method: string, target: string, timeout: number = 30) {
    return await runCommand("bash", [SCRIPTS.healthCheck, method, target, timeout.toString()]);
}

export async function deployApp(options: DeployOptions) {
    const { appName, env, publishImage } = options;

    console.log(`Starting deployment for ${appName}...`);

    try {
        const { updateApp } = await import("./app");

        // Use V2 immutable deployment logic (same as webhook/API)
        // This creates a new release, clones fresh, builds, and switches symlink
        console.log(`\nUsing immutable deployment strategy (V2)...`);

        const result = await updateApp(appName, env, publishImage);

        // Dynamically import to avoid circular dep if any
        const { sendDeploymentAlertEmail } = await import("../services/email");

        if (result.success) {
            console.log(`\n${result.message}`);
            // Send Success Alert
            const releaseId = (result as any).data?.releaseId || "unknown";
            await sendDeploymentAlertEmail(
                appName,
                "success",
                `Deployment successful.\nRelease ID: ${releaseId}`
            );

            // Update Caddy Routing
            try {
                const { genCaddyFile } = await import("../utils/genCaddyFile");
                await genCaddyFile();
            } catch (err: any) {
                console.error(`Warning: Failed to update Caddy routing: ${err.message}`);
            }
        } else {
            console.error(`\n${result.message}`);
            // Send Failure Alert
            await sendDeploymentAlertEmail(appName, "failed", result.message);
        }

        return result;
    } catch (error: any) {
        console.error(`Deployment failed: ${error.message}`);

        // Send Failure Alert
        try {
            const { sendDeploymentAlertEmail } = await import("../services/email");
            await sendDeploymentAlertEmail(appName, "failed", error.message);
        } catch {} // Ignore error sending alert if it fails

        return { success: false, message: error.message };
    }
}

export async function rollbackApp(appName: string, commitHash?: string) {
    console.log(`⏪ Rolling back ${appName}...`);

    try {
        const { getAppMetadata, restartApp } = await import("./app");
        const metadata = await getAppMetadata(appName);
        const strategy = resolveDeployStrategy(metadata);

        if (strategy === "image") {
            const { rollbackImageApp } = await import("./deploy-image");
            return await rollbackImageApp(appName, commitHash);
        }

        const { getVersions, rollback } = await import("./version");
        const versions = await getVersions(appName);
        if (versions.versions.length === 0) {
            throw new Error(`No previous successful deployment found for ${appName}`);
        }
        const targetVersionId = resolveGitRollbackTarget(
            versions.versions,
            versions.current,
            commitHash
        );
        if (targetVersionId === null) {
            if (commitHash) {
                throw new Error(`No deployment version found for '${commitHash}'`);
            }
            throw new Error(`No previous successful deployment found for ${appName}`);
        }

        const result = await rollback(appName, targetVersionId);
        if (!result.success) {
            throw new Error(result.message);
        }

        await restartApp(appName);
        console.log(` Rolled back ${appName} to v${targetVersionId}`);
        return { success: true, message: `Rolled back to v${targetVersionId}` };
    } catch (error: any) {
        console.error(` Rollback failed: ${error.message}`);
        return { success: false, message: error.message };
    }
}

export async function getDeploymentHistory(appName: string) {
    try {
        const { getAppMetadata } = await import("./app");
        const metadata = await getAppMetadata(appName);
        const strategy = resolveDeployStrategy(metadata);

        if (strategy === "image") {
            const imageReleases = Array.isArray((metadata as any).imageReleases)
                ? (metadata as any).imageReleases
                : [];
            const history: DeployHistoryItem[] = imageReleases.map((release: any) => ({
                gitHash: release.imageDigest || release.imageRef || String(release.id),
                timeStamp: new Date(release.deployedAt),
                ssh_url: metadata.gitRepo || (metadata as any).repo || "",
            }));
            return { success: true, history };
        }

        const { getVersions } = await import("./version");
        const versions = await getVersions(appName);
        const history: DeployHistoryItem[] = versions.versions.map((version) => ({
            gitHash: version.commit || `v${version.id}`,
            timeStamp: new Date(version.timestamp),
            ssh_url: metadata.gitRepo || (metadata as any).repo || "",
        }));
        return { success: true, history };
    } catch {
        return { success: true, history: [] };
    }
}

// Commander Integration
export function addDeployCommands(program: Command) {
    const deploy = program.command("deploy").description("Deployment management commands");

    deploy
        .command("trigger")
        .description("Trigger a deployment for an app")
        .argument("<app>", "Application name")
        .option("--env <vars...>", "Environment variables (KEY=VALUE)")
        .option("--env-file <path>", "Path to .env file")
        .option(
            "--push-image",
            "After successful git deployment, push built image to a container registry"
        )
        .option("--push-image-ref <ref>", "Target image ref for push (e.g., ghcr.io/org/app:tag)")
        .option(
            "--push-registry-credential <id>",
            "Registry credential id from `okastr8 registry add`"
        )
        .action(async (app, options) => {
            let env: Record<string, string> = {};

            // Parse --env-file
            if (options.envFile) {
                if (existsSync(options.envFile)) {
                    const content = await readFile(options.envFile, "utf-8");
                    content.split("\n").forEach((line) => {
                        line = line.trim();
                        if (!line || line.startsWith("#")) return;
                        const [k, ...v] = line.split("=");
                        if (k && v.length > 0) env[k.trim()] = v.join("=").trim();
                    });
                } else {
                    console.error(` Env file not found: ${options.envFile}`);
                    process.exit(1);
                }
            }

            // Parse --env flags
            if (options.env) {
                options.env.forEach((pair: string) => {
                    const [k, ...v] = pair.split("=");
                    if (k && v.length > 0) env[k.trim()] = v.join("=").trim();
                });
            }

            let publishImage:
                | {
                      imageRef: string;
                      registryCredentialId: string;
                  }
                | undefined;
            if (options.pushImage) {
                if (!options.pushImageRef || !options.pushRegistryCredential) {
                    console.error(
                        "When using --push-image, you must also provide --push-image-ref and --push-registry-credential."
                    );
                    process.exit(1);
                }
                publishImage = {
                    imageRef: options.pushImageRef,
                    registryCredentialId: options.pushRegistryCredential,
                };
            }

            const result = await deployApp({
                appName: app,
                env: Object.keys(env).length > 0 ? env : undefined,
                publishImage,
            });

            if (!result.success) {
                process.exit(1);
            }
        });

    deploy
        .command("rollback")
        .description("Rollback an app to a previous version")
        .argument("<app>", "Application name")
        .option(
            "-c, --commit <hash>",
            "Specific commit hash prefix or git version id to rollback to"
        )
        .option("-t, --target <target>", "Image rollback target (release id, image ref, or digest)")
        .action(async (app, options) => {
            if (options.commit && options.target) {
                console.error("Use either --commit (git) or --target (image), not both.");
                process.exit(1);
            }
            const result = await rollbackApp(app, options.target || options.commit);
            if (!result.success) {
                process.exit(1);
            }
            if (result.message) {
                console.log(result.message);
            }
        });

    deploy
        .command("history")
        .description("Show deployment history for an app")
        .argument("<app>", "Application name")
        .action(async (app) => {
            const result = await getDeploymentHistory(app);
            if (result.history.length === 0) {
                console.log(`No deployment history for ${app}`);
            } else {
                console.log(`Deployment history for ${app}:`);
                for (const d of result.history.slice(-10).reverse()) {
                    const date = new Date(d.timeStamp).toLocaleString();
                    console.log(`  • ${d.gitHash.substring(0, 7)} - ${date}`);
                }
            }
        });

    deploy
        .command("health")
        .description("Run a health check")
        .argument("<method>", "Check method: http, process, port, command")
        .argument("<target>", "Check target")
        .option("-t, --timeout <seconds>", "Timeout in seconds", "30")
        .action(async (method, target, options) => {
            const result = await runHealthCheck(method, target, parseInt(options.timeout, 10));
            console.log(result.stdout || result.stderr);
            if (result.exitCode !== 0) {
                process.exit(1);
            }
        });
}
