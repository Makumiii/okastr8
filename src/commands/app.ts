import { join, dirname } from "path";
import { mkdir, writeFile, readFile, rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { runCommand } from "../utils/command";
import { deployFromPath } from "./deploy-core";
import { createVersion, removeVersion } from "./version";
import {
    containerStatus,
    containerLogs,
    runContainer,
    stopContainer as stopDockerContainer,
    restartContainer as restartDockerContainer,
    removeContainer,
    listContainers,
    getProjectContainers
} from "./docker";

// Helper to get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/commands/
const PROJECT_ROOT = join(__dirname, "..", "..");

// Activity Logging
import { randomUUID } from "crypto";
import { logActivity } from "../utils/activity";
import { resolveDeployStrategy, type DeployStrategy } from "../utils/deploy-strategy";
import { resolveRegistryServer } from "../utils/registry-image";

// App directory structure
import { OKASTR8_HOME } from "../config";
const APPS_DIR = join(OKASTR8_HOME, "apps");

export interface AppConfig {
    name: string;
    description: string;
    execStart: string;
    workingDirectory: string;
    user: string;
    port?: number;
    containerPort?: number;
    domain?: string;
    gitRepo?: string;
    gitBranch?: string;
    webhookBranch?: string;
    buildSteps?: string[];
    env?: Record<string, string>;
    webhookAutoDeploy?: boolean;
    database?: string;
    cache?: string;
    deploymentType?: "docker" | "systemd"; // Backwards compat or new default
    deployStrategy?: DeployStrategy;
    imageRef?: string;
    pullPolicy?: "always" | "if-not-present";
    imageDigest?: string;
    registryCredentialId?: string;
    registryServer?: string;
    registryProvider?: "ghcr" | "dockerhub" | "ecr" | "generic";
}

// Ensure the app directory structure exists
async function ensureAppDirs(appName: string) {
    const appDir = join(APPS_DIR, appName);
    const repoDir = join(appDir, "repo");
    const logsDir = join(appDir, "logs");

    await mkdir(appDir, { recursive: true });
    await mkdir(repoDir, { recursive: true });
    await mkdir(logsDir, { recursive: true });

    return { appDir, repoDir, logsDir };
}

// Core Functions
export async function createApp(config: AppConfig) {
    // Legacy support wrapper or direct redirect to deploy-core?
    // In the new flow, "createApp" is mostly "register metadata" + "initial deploy"
    // For now, we'll keep the metadata creation but use deployFromPath for the actual work
    // However, createApp is often called by UI before code exists. 
    // If this is just reserving the name:

    try {
        const { appDir, repoDir, logsDir } = await ensureAppDirs(config.name);

        // Write initial app.json
        const metadataPath = join(appDir, "app.json");
        const metadata = {
            ...config,
            createdAt: new Date().toISOString(),
            deploymentType: "docker", // Default to docker now
            deployStrategy: config.deployStrategy || "git",
            repoDir,
            logsDir,
            versions: [],
            currentVersionId: null,
            imageReleases: [],
            currentImageReleaseId: null,
            webhookAutoDeploy: config.webhookAutoDeploy ?? true,
            webhookBranch: config.webhookBranch || config.gitBranch
        };

        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        // Save env vars to .env.production if provided
        if (config.env && Object.keys(config.env).length > 0) {
            const { saveEnvVars } = await import("../utils/env-manager");
            await saveEnvVars(config.name, config.env);
        }

        return {
            success: true,
            appDir,
            message: "App registered. Please use deploy command or git push to start it.",
        };
    } catch (error) {
        console.error(`Error creating app ${config.name}:`, error);
        throw error;
    }
}

export async function deleteApp(appName: string) {
    try {
        console.log(`Deleting app: ${appName}`);

        // 1. Universal Docker Cleanup
        // Stop both single container and possible Compose services
        console.log(` Cleaning up Docker resources for ${appName}...`);

        // Stop single container (container name = app name)
        await stopDockerContainer(appName).catch(() => { });
        await removeContainer(appName).catch(() => { });

        // Stop compose services if a compose file exists in the current deployment
        const currentComposePath = join(APPS_DIR, appName, "current", "docker-compose.yml");
        if (existsSync(currentComposePath)) {
            const { composeDown } = await import("./docker");
            await composeDown(currentComposePath, appName).catch(() => { });
        }

        // Remove app directory
        const appDir = join(APPS_DIR, appName);
        console.log(`Removing app directory: ${appDir}`);
        await rm(appDir, { recursive: true, force: true });

        return {
            success: true,
            message: `App '${appName}' deleted successfully`,
        };
    } catch (error) {
        console.error(`Error deleting app ${appName}:`, error);
        // Even if docker fails (maybe already gone), try to remove files
        const appDir = join(APPS_DIR, appName);
        await rm(appDir, { recursive: true, force: true }).catch(() => { });

        return {
            success: false,
            message: `Failed to delete app cleanly: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

export async function listApps() {
    try {
        await mkdir(APPS_DIR, { recursive: true });
        const entries = await readdir(APPS_DIR, { withFileTypes: true });
        const apps = [];

        // Get running containers to cross-reference status
        const runningContainers = await listContainers();
        const runningMap = new Map(runningContainers.map(c => [c.name, c.state]));

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const metadataPath = join(APPS_DIR, entry.name, "app.json");
                try {
                    const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));

                    // Check for direct container name match (auto-dockerfile strategy)
                    let state = runningMap.get(entry.name);

                    // If not found, check for compose project containers
                    // Docker Compose names containers like: projectname-servicename-1
                    if (!state) {
                        const projectContainers = await getProjectContainers(entry.name);
                        if (projectContainers.length > 0) {
                            // If any container in the project is running, consider the app running
                            const anyRunning = projectContainers.some(c => c.status === 'running');
                            state = anyRunning ? 'running' : projectContainers[0]?.status || 'stopped';
                        }
                    }

                    // Extra health status from state (format: "running (healthy)")
                    let health: string | undefined = undefined;
                    if (state?.includes('(') && state.includes(')')) {
                        health = state.split('(')[1]?.split(')')[0];
                    }

                    apps.push({
                        ...metadata,
                        running: state === 'running' || state?.includes('running'),
                        status: state || 'stopped',
                        health: health
                    });
                } catch {
                    apps.push({ name: entry.name, status: 'unknown' });
                }
            }
        }

        return { success: true, apps };
    } catch (error) {
        console.error("Error listing apps:", error);
        throw error;
    }
}

export async function getAppStatus(appName: string) {
    try {
        const status = await containerStatus(appName);
        return {
            success: status.status !== 'not found' && status.running,
            message: status.status,
            details: status
        };
    } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : "Error checking status" };
    }
}

export async function getAppLogs(appName: string, lines: number = 50) {
    try {
        const logs = await containerLogs(appName, lines);
        return {
            success: true,
            logs: logs
        };
    } catch (e) {
        return { success: false, logs: "Failed to retrieve logs", error: e };
    }
}

export async function exportAppLogs(appName: string) {
    try {
        const appDir = join(APPS_DIR, appName);
        const logsDir = join(appDir, "logs");
        await mkdir(logsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const logFile = join(logsDir, `${appName}-${timestamp}.log`);

        const logs = await containerLogs(appName, 10000); // Fetch a lot of logs for export

        await writeFile(logFile, logs);
        return { success: true, logFile, message: `Logs exported to ${logFile}` };
    } catch (error) {
        console.error(`Error exporting logs for ${appName}:`, error);
        throw error;
    }
}

export async function startApp(appName: string) {
    // For Docker, "starting" a stopped container is easy
    // But if it was never built, we can't just "start" it without deployment info.
    // Assuming the container exists but is stopped:
    try {
        await runCommand("sudo", ["docker", "start", appName]);
        return { success: true, message: "Container started" };
    } catch (e) {
        return { success: false, message: "Failed to start container: " + e };
    }
}

export async function stopApp(appName: string) {
    try {
        await stopDockerContainer(appName);
        return { success: true, message: "App stopped" };
    } catch (e) {
        return { success: false, message: "Failed to stop: " + e };
    }
}

export async function restartApp(appName: string) {
    try {
        await restartDockerContainer(appName);
        return { success: true, message: "App restarted" };
    } catch (e) {
        return { success: false, message: "Failed to restart: " + e };
    }
}

export async function getAppMetadata(appName: string): Promise<AppConfig & { repoDir: string }> {
    const appDir = join(APPS_DIR, appName);
    const metadataPath = join(appDir, "app.json");
    try {
        const content = await readFile(metadataPath, "utf-8");
        return JSON.parse(content);
    } catch {
        throw new Error(`App ${appName} not found or corrupted`);
    }
}

export async function updateApp(appName: string, env?: Record<string, string>) {
    let versionId: number = 0;
    let releasePath: string = "";
    const deploymentId = randomUUID();
    const startTime = Date.now();

    try {
        const metadata = await getAppMetadata(appName);
        const deployStrategy = resolveDeployStrategy(metadata);

        if (deployStrategy === "image") {
            const { updateAppFromImage } = await import("./deploy-image");
            return await updateAppFromImage({
                appName,
                metadata,
                env,
            });
        }

        if (!metadata.gitRepo) {
            throw new Error("Not a git-linked application (missing gitRepo)");
        }

        console.log(`Updating ${appName} from git...`);

        const branch = metadata.gitBranch || "main";

        // Log Deployment Start
        await logActivity('deploy', {
            id: deploymentId,
            status: 'started',
            appName,
            branch
        });

        // 1. Create new version entry (V2 Logic)
        // We use "HEAD" initially, and deployFromPath doesn't strictly require git hash for logic, 
        // but ideally we'd get the hash traverse. 
        const versionResult = await createVersion(appName, "HEAD", branch);
        versionId = versionResult.versionId;
        releasePath = versionResult.releasePath;

        console.log(`Created release v${versionId} at ${releasePath}`);

        // 2. Clone code into release path (Fresh clone like importRepo)
        // Inject OAuth token for HTTPS URLs to avoid password prompts
        let cloneUrl = metadata.gitRepo;
        if (cloneUrl.startsWith('https://github.com/')) {
            const { getGitHubConfig } = await import('./github');
            const ghConfig = await getGitHubConfig();
            if (ghConfig.accessToken) {
                cloneUrl = cloneUrl.replace('https://github.com/', `https://${ghConfig.accessToken}@github.com/`);
            }
        }

        console.log(`Cloning ${branch} into release...`);
        const cloneResult = await runCommand("git", [
            "clone",
            "--depth", "1",
            "--branch", branch,
            cloneUrl,
            releasePath
        ]);

        if (cloneResult.exitCode !== 0) {
            throw new Error(`Clone failed: ${cloneResult.stderr}`);
        }

        // 3. Deploy
        console.log(`Deploying v${versionId}...`);
        const deployResult = await deployFromPath({
            appName,
            releasePath,
            versionId,
            gitRepo: metadata.gitRepo,
            gitBranch: branch,
            env: env,
            deploymentId: deploymentId
        });

        const duration = (Date.now() - startTime) / 1000;

        if (!deployResult.success) {
            // Log Failure
            await logActivity('deploy', {
                id: deploymentId,
                status: 'failed',
                appName,
                branch,
                versionId,
                error: deployResult.message,
                duration
            });

            // Cleanup on failure
            console.log("Deployment failed. Cleaning up...");
            await rm(releasePath, { recursive: true, force: true });
            await removeVersion(appName, versionId);
            throw new Error(deployResult.message);
        }

        // Log Success
        await logActivity('deploy', {
            id: deploymentId,
            status: 'success',
            appName,
            branch,
            versionId,
            duration
        });

        return { success: true, message: `App updated to v${versionId}` };

    } catch (error: any) {
        console.error(`Error updating app ${appName}:`, error);
        // Ensure cleanup if we created a version but failed before deployFromPath returned
        if (versionId && releasePath) {
            try {
                await rm(releasePath, { recursive: true, force: true });
                await removeVersion(appName, versionId);
            } catch { }
        }

        // Log unexpected error
        await logActivity('deploy', {
            id: deploymentId,
            status: 'failed',
            appName,
            error: error.message,
            duration: (Date.now() - startTime) / 1000
        });

        throw error;
    }
}

async function parseEnvFromOptions(options: any): Promise<Record<string, string>> {
    const env: Record<string, string> = {};

    if (options.envFile) {
        if (existsSync(options.envFile)) {
            const content = await readFile(options.envFile, 'utf-8');
            content.split('\n').forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const [k, ...v] = line.split('=');
                if (k && v.length > 0) env[k.trim()] = v.join('=').trim();
            });
        } else {
            throw new Error(`Env file not found: ${options.envFile}`);
        }
    }

    if (options.env) {
        options.env.forEach((pair: string) => {
            const [k, ...v] = pair.split('=');
            if (k && v.length > 0) env[k.trim()] = v.join('=').trim();
        });
    }

    return env;
}

export async function setAppWebhookAutoDeploy(appName: string, enabled: boolean) {
    const appDir = join(APPS_DIR, appName);
    const metadataPath = join(appDir, "app.json");
    try {
        const content = await readFile(metadataPath, "utf-8");
        const metadata = JSON.parse(content);
        metadata.webhookAutoDeploy = enabled;
        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        return { success: true, message: `Webhook auto-deploy ${enabled ? 'enabled' : 'disabled'} for ${appName}` };
    } catch {
        throw new Error(`App ${appName} not found or corrupted`);
    }
}

export async function setAppWebhookBranch(appName: string, branch: string) {
    const appDir = join(APPS_DIR, appName);
    const metadataPath = join(appDir, "app.json");
    try {
        const content = await readFile(metadataPath, "utf-8");
        const metadata = JSON.parse(content);
        metadata.webhookBranch = branch;
        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        return { success: true, message: `Webhook branch set to ${branch} for ${appName}` };
    } catch {
        throw new Error(`App ${appName} not found or corrupted`);
    }
}

// Commander Integration
export function addAppCommands(program: Command) {
    const app = program
        .command("app")
        .description("Manage okastr8 applications");

    app
        .command("create")
        .description("Create a new application")
        .argument("<name>", "Application name")
        .argument("<exec_start>", "Command to run (e.g., 'bun run start')")
        .option("-d, --description <desc>", "Service description", "Okastr8 managed app")
        .option("-u, --user <user>", "User to run as", process.env.USER || "root")
        .option("-w, --working-dir <dir>", "Working directory")
        .option("-p, --port <port>", "Application port")
        .option("--domain <domain>", "Domain for Caddy reverse proxy")
        .option("--git-repo <url>", "Git repository URL")
        .option("--git-branch <branch>", "Git branch to track", "main")
        .option("--database <type:version>", "Database service (e.g., 'postgres:15')")
        .option("--cache <type:version>", "Cache service (e.g., 'redis:7')")
        .option("--env <vars...>", "Environment variables (KEY=VALUE)")
        .option("--env-file <path>", "Path to .env file")
        .action(async (name: string, execStart: string, options: any) => {
            console.log(`Creating app '${name}'...`);
            try {
                const env = await parseEnvFromOptions(options);

                // Save env vars if present
                if (Object.keys(env).length > 0) {
                    const { saveEnvVars } = await import('../utils/env-manager');
                    await saveEnvVars(name, env);
                }

                const result = await createApp({
                    name,
                    description: options.description,
                    execStart,
                    workingDirectory: options.workingDir || "",
                    user: options.user,
                    port: options.port ? parseInt(options.port, 10) : undefined,
                    domain: options.domain,
                    gitRepo: options.gitRepo,
                    gitBranch: options.gitBranch,
                    database: options.database,
                    cache: options.cache
                });
                console.log(result.message);
                console.log(`App created at ${result.appDir}`);
            } catch (error: any) {
                console.error(`Failed to create app:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("create-image")
        .description("Create an application deployed directly from a container image")
        .argument("<name>", "Application name")
        .argument("<image_ref>", "Container image reference (e.g., traefik/whoami:latest)")
        .option("-d, --description <desc>", "Service description", "Okastr8 image app")
        .option("-u, --user <user>", "User to run as", process.env.USER || "root")
        .option("-p, --port <port>", "Application port", "8080")
        .option("--container-port <port>", "Container internal port (default: same as --port)")
        .option("--domain <domain>", "Domain for Caddy reverse proxy")
        .option("--pull-policy <policy>", "Image pull policy: always or if-not-present", "always")
        .option("--registry-credential <id>", "Registry credential id from `okastr8 registry add`")
        .option("--registry-server <server>", "Registry server override (e.g., ghcr.io)")
        .option("--registry-provider <provider>", "Registry provider: ghcr|dockerhub|ecr|generic", "ghcr")
        .option("--env <vars...>", "Environment variables (KEY=VALUE)")
        .option("--env-file <path>", "Path to .env file")
        .action(async (name: string, imageRef: string, options: any) => {
            console.log(`Creating image app '${name}'...`);
            try {
                const env = await parseEnvFromOptions(options);
                const pullPolicy = options.pullPolicy === "if-not-present" ? "if-not-present" : "always";
                const registryServer = options.registryServer || resolveRegistryServer(imageRef);

                if (Object.keys(env).length > 0) {
                    const { saveEnvVars } = await import('../utils/env-manager');
                    await saveEnvVars(name, env);
                }

                const result = await createApp({
                    name,
                    description: options.description,
                    execStart: "docker run",
                    workingDirectory: "",
                    user: options.user,
                    port: options.port ? parseInt(options.port, 10) : 8080,
                    containerPort: options.containerPort ? parseInt(options.containerPort, 10) : (options.port ? parseInt(options.port, 10) : 8080),
                    domain: options.domain,
                    deployStrategy: "image",
                    imageRef,
                    pullPolicy,
                    registryCredentialId: options.registryCredential,
                    registryServer,
                    registryProvider: options.registryProvider,
                    webhookAutoDeploy: false,
                });

                console.log(result.message);
                console.log(`Image app created at ${result.appDir}`);
            } catch (error: any) {
                console.error(`Failed to create image app:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("delete")
        .description("Delete an application")
        .argument("<name>", "Application name")
        .action(async (name: string) => {
            console.log(`Deleting app '${name}'...`);
            try {
                const result = await deleteApp(name);
                console.log(result.message);
                console.log(`App '${name}' deleted`);
            } catch (error: any) {
                console.error(`Failed to delete app:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("list")
        .description("List all okastr8 applications")
        .action(async () => {
            try {
                const result = await listApps();
                if (result.apps.length === 0) {
                    console.log("No apps found.");
                } else {
                    console.log("Okastr8 Apps:");
                    for (const app of result.apps) {
                        console.log(`  • ${app.name}${app.description ? ` - ${app.description}` : ""}`);
                    }
                }
            } catch (error: any) {
                console.error(`Failed to list apps:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("status")
        .description("Show status of an application")
        .argument("<name>", "Application name")
        .action(async (name: string) => {
            try {
                const result = await getAppStatus(name);
                console.log(result.message);
            } catch (error: any) {
                console.error(`Failed to get status:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("logs")
        .description("Show logs for an application")
        .argument("<name>", "Application name")
        .option("-n, --lines <lines>", "Number of lines to show", "50")
        .action(async (name: string, options: any) => {
            try {
                const result = await getAppLogs(name, parseInt(options.lines, 10));
                console.log(result.logs);
            } catch (error: any) {
                console.error(`Failed to get logs:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("export-logs")
        .description("Export logs to app directory")
        .argument("<name>", "Application name")
        .action(async (name: string) => {
            try {
                const result = await exportAppLogs(name);
                console.log(result.message);
            } catch (error: any) {
                console.error(`Failed to export logs:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("start")
        .description("Start an application")
        .argument("<name>", "Application name")
        .action(async (name: string) => {
            console.log(`Starting ${name}...`);
            const result = await startApp(name);
            console.log(result.message);
        });

    // Environment variable management
    const env = app.command('env')
        .description('Manage environment variables for an app');

    env.command('set')
        .description('Set environment variables for an app')
        .argument('<appName>', 'Name of the app')
        .argument('<key=value...>', 'Environment variables in KEY=VALUE format')
        .action(async (appName: string, keyValues: string[]) => {
            try {
                const { setEnvVar } = await import('../utils/env-manager');

                for (const pair of keyValues) {
                    const [key, ...valueParts] = pair.split('=');
                    if (!key || valueParts.length === 0) {
                        console.error(`Invalid format: ${pair}. Expected KEY=VALUE`);
                        process.exit(1);
                    }
                    const value = valueParts.join('=');
                    await setEnvVar(appName, key, value);
                    console.log(`Set ${key}`);
                }
            } catch (error: any) {
                console.error(`Error: ${error.message}`);
                process.exit(1);
            }
        });

    env.command('import')
        .description('Import environment variables from a .env file')
        .argument('<appName>', 'Name of the app')
        .option('-f, --file <path>', 'Path to .env file', '.env')
        .action(async (appName: string, options: any) => {
            try {
                const { importEnvFile } = await import('../utils/env-manager');
                await importEnvFile(appName, options.file);
                console.log(` Imported environment variables from ${options.file}`);
            } catch (error: any) {
                console.error(` Error: ${error.message}`);
                process.exit(1);
            }
        });

    env.command('list')
        .description('List environment variable keys for an app')
        .argument('<appName>', 'Name of the app')
        .action(async (appName: string) => {
            try {
                const { listEnvVars } = await import('../utils/env-manager');
                const keys = await listEnvVars(appName);

                if (keys.length === 0) {
                    console.log('No environment variables set');
                } else {
                    console.log('Environment variables:');
                    keys.forEach(key => console.log(`  ${key}=••••••••`));
                }
            } catch (error: any) {
                console.error(` Error: ${error.message}`);
                process.exit(1);
            }
        });

    env.command('export')
        .description('Export environment variables to a file')
        .argument('<appName>', 'Name of the app')
        .option('-f, --file <path>', 'Output file path', 'exported.env')
        .action(async (appName: string, options: any) => {
            try {
                const { exportEnvFile } = await import('../utils/env-manager');
                await exportEnvFile(appName, options.file);
                console.log(` Exported environment variables to ${options.file}`);
            } catch (error: any) {
                console.error(` Error: ${error.message}`);
                process.exit(1);
            }
        });

    env.command('unset')
        .description('Unset an environment variable')
        .argument('<appName>', 'Name of the app')
        .argument('<key>', 'Environment variable key to unset')
        .action(async (appName: string, key: string) => {
            try {
                const { unsetEnvVar } = await import('../utils/env-manager');
                await unsetEnvVar(appName, key);
                console.log(` Unset ${key}`);
            } catch (error: any) {
                console.error(` Error: ${error.message}`);
                process.exit(1);
            }
        });

    app
        .command("stop")
        .description("Stop an application")
        .argument("<name>", "Application name")
        .action(async (name: string) => {
            console.log(`  Stopping ${name}...`);
            const result = await stopApp(name);
            console.log(result.message);
        });

    app
        .command("restart")
        .description("Restart an application")
        .argument("<name>", "Application name")
        .action(async (name: string) => {
            console.log(`Restarting ${name}...`);
            const result = await restartApp(name);
            console.log(result.message);
        });

    app
        .command("webhook")
        .description("Show or set auto-deploy webhook status for an app")
        .argument("<name>", "Application name")
        .argument("[state]", "State (enable/disable, on/off) - omit to show current status")
        .option("--branch <branch>", "Set webhook trigger branch")
        .action(async (name: string, state: string, options: { branch?: string }) => {
            try {
                if (!state) {
                    // Show current status
                    const config = await getAppMetadata(name);
                    const enabled = config?.webhookAutoDeploy ?? true;
                    const branch = config?.webhookBranch || config?.gitBranch || "main";
                    console.log(`Webhook auto-deploy for ${name}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
                    console.log(`Webhook branch for ${name}: ${branch}`);
                } else {
                    // Set status
                    const enabled = ['enable', 'on', 'true', '1'].includes(state.toLowerCase());
                    console.log(`${enabled ? 'Enabling' : 'Disabling'} webhooks for ${name}...`);
                    const result = await setAppWebhookAutoDeploy(name, enabled);
                    console.log(result.message);
                }
                if (options?.branch) {
                    const branchResult = await setAppWebhookBranch(name, options.branch);
                    console.log(branchResult.message);
                }
            } catch (error: any) {
                console.error(` Failed:`, error.message);
                process.exit(1);
            }
        });
}
