import { Command } from "commander";
import { runCommand } from "../utils/command";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { readFile, writeFile, mkdir } from "fs/promises";
import type { DeploymentRecord, DeploysMetadata } from "../types";

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/commands/
const PROJECT_ROOT = join(__dirname, "..", "..");

// Paths
const OKASTR8_HOME = join(homedir(), ".okastr8");
const APPS_DIR = join(OKASTR8_HOME, "apps");
const DEPLOYMENT_FILE = join(OKASTR8_HOME, "deployment.json");

// Scripts
const SCRIPTS = {
    gitPull: join(PROJECT_ROOT, "scripts", "git", "pull.sh"),
    gitRollback: join(PROJECT_ROOT, "scripts", "git", "rollback.sh"),
    healthCheck: join(PROJECT_ROOT, "scripts", "deploy", "health-check.sh"),
    restart: join(PROJECT_ROOT, "scripts", "systemd", "restart.sh"),
    stop: join(PROJECT_ROOT, "scripts", "systemd", "stop.sh"),
    start: join(PROJECT_ROOT, "scripts", "systemd", "start.sh"),
};

export interface DeployOptions {
    appName: string;
    branch?: string;
    buildSteps?: string[];
    healthCheck?: {
        method: "http" | "process" | "port" | "command";
        target: string;
        timeout?: number;
    };
    skipHealthCheck?: boolean;
}

// Core Functions
export async function gitPull(repoPath: string, branch?: string) {
    const args = [SCRIPTS.gitPull, repoPath];
    if (branch) args.push(branch);
    return await runCommand("bash", args);
}

export async function runHealthCheck(
    method: string,
    target: string,
    timeout: number = 30
) {
    return await runCommand("bash", [
        SCRIPTS.healthCheck,
        method,
        target,
        timeout.toString(),
    ]);
}

export async function deployApp(options: DeployOptions) {
    const { appName, branch, buildSteps = [], healthCheck, skipHealthCheck } = options;
    const appDir = join(APPS_DIR, appName);
    const repoDir = join(appDir, "repo");

    console.log(`🚀 Starting deployment for ${appName}...`);

    try {
        // Step 1: Pull latest code
        console.log(`📥 Step 1: Pulling latest code...`);
        const pullResult = await gitPull(repoDir, branch);
        if (pullResult.exitCode !== 0) {
            throw new Error(`Git pull failed: ${pullResult.stderr}`);
        }
        console.log(pullResult.stdout);

        // Step 2: Run build steps
        if (buildSteps.length > 0) {
            console.log(`🔨 Step 2: Running ${buildSteps.length} build steps...`);
            const originalDir = process.cwd();
            process.chdir(repoDir);

            for (const step of buildSteps) {
                console.log(`  → ${step}`);
                const buildResult = await runCommand("bash", ["-c", step]);
                if (buildResult.exitCode !== 0) {
                    process.chdir(originalDir);
                    throw new Error(`Build step failed: ${step}\n${buildResult.stderr}`);
                }
            }
            process.chdir(originalDir);
        }

        // Step 3: Restart service
        console.log(`🔄 Step 3: Restarting service...`);
        const restartResult = await runCommand("sudo", [SCRIPTS.restart, appName]);
        if (restartResult.exitCode !== 0) {
            throw new Error(`Service restart failed: ${restartResult.stderr}`);
        }

        // Step 4: Health check
        if (!skipHealthCheck && healthCheck) {
            console.log(`🏥 Step 4: Running health check...`);
            const checkResult = await runHealthCheck(
                healthCheck.method,
                healthCheck.target,
                healthCheck.timeout || 30
            );
            if (checkResult.exitCode !== 0) {
                console.log(`❌ Health check failed! Rolling back...`);
                // Attempt rollback - get last successful deployment
                await autoRollback(appName);
                throw new Error(`Health check failed: ${checkResult.stderr}`);
            }
            console.log(checkResult.stdout);
        }

        // Step 5: Record deployment
        console.log(`📝 Recording deployment...`);
        await recordDeployment(appName);

        console.log(`\n✅ Deployment complete for ${appName}!`);
        return { success: true, message: `Deployed ${appName} successfully` };
    } catch (error: any) {
        console.error(`❌ Deployment failed: ${error.message}`);
        return { success: false, message: error.message };
    }
}

async function recordDeployment(appName: string) {
    try {
        const appDir = join(APPS_DIR, appName);
        const repoDir = join(appDir, "repo");

        // Get current git hash
        const hashResult = await runCommand("git", ["-C", repoDir, "rev-parse", "HEAD"]);
        const gitHash = hashResult.stdout?.trim() || "unknown";

        // Get remote URL
        const remoteResult = await runCommand("git", ["-C", repoDir, "remote", "get-url", "origin"]);
        const sshUrl = remoteResult.stdout?.trim() || "unknown";

        const deployment: DeploysMetadata = {
            gitHash,
            timeStamp: new Date(),
            ssh_url: sshUrl,
        };

        // Read/create deployment record
        let record: DeploymentRecord = { deployments: [] };
        try {
            const content = await readFile(DEPLOYMENT_FILE, "utf-8");
            record = JSON.parse(content);
        } catch {
            // File doesn't exist, use empty record
        }

        // Find or create entry for this app
        let entry = record.deployments.find((d) => d.serviceName === appName);
        if (!entry) {
            entry = {
                serviceName: appName,
                gitRemoteName: sshUrl.split("/").pop()?.replace(".git", "") || appName,
                deploys: [],
                lastSuccessfulDeploy: null,
            };
            record.deployments.push(entry);
        }

        entry.deploys.push(deployment);
        entry.lastSuccessfulDeploy = deployment;

        await mkdir(dirname(DEPLOYMENT_FILE), { recursive: true });
        await writeFile(DEPLOYMENT_FILE, JSON.stringify(record, null, 2));
    } catch (error) {
        console.error("Failed to record deployment:", error);
        // Non-fatal - don't fail deployment if recording fails
    }
}

export async function rollbackApp(appName: string, commitHash?: string) {
    const appDir = join(APPS_DIR, appName);
    const repoDir = join(appDir, "repo");

    console.log(`⏪ Rolling back ${appName}...`);

    try {
        // If no hash provided, get from last successful deployment
        if (!commitHash) {
            const content = await readFile(DEPLOYMENT_FILE, "utf-8");
            const record: DeploymentRecord = JSON.parse(content);
            const entry = record.deployments.find((d) => d.serviceName === appName);

            if (!entry || !entry.lastSuccessfulDeploy) {
                throw new Error(`No previous successful deployment found for ${appName}`);
            }
            commitHash = entry.lastSuccessfulDeploy.gitHash;
        }

        // Checkout the specific commit
        console.log(`  → Checking out ${commitHash}...`);
        const checkoutResult = await runCommand("git", ["-C", repoDir, "checkout", commitHash]);
        if (checkoutResult.exitCode !== 0) {
            throw new Error(`Git checkout failed: ${checkoutResult.stderr}`);
        }

        // Restart service
        console.log(`  → Restarting service...`);
        const restartResult = await runCommand("sudo", [SCRIPTS.restart, appName]);
        if (restartResult.exitCode !== 0) {
            throw new Error(`Service restart failed: ${restartResult.stderr}`);
        }

        console.log(`✅ Rolled back ${appName} to ${commitHash}`);
        return { success: true, message: `Rolled back to ${commitHash}` };
    } catch (error: any) {
        console.error(`❌ Rollback failed: ${error.message}`);
        return { success: false, message: error.message };
    }
}

async function autoRollback(appName: string) {
    console.log(`🔄 Auto-rollback initiated for ${appName}...`);
    return await rollbackApp(appName);
}

export async function getDeploymentHistory(appName: string) {
    try {
        const content = await readFile(DEPLOYMENT_FILE, "utf-8");
        const record: DeploymentRecord = JSON.parse(content);
        const entry = record.deployments.find((d) => d.serviceName === appName);
        return { success: true, history: entry?.deploys || [] };
    } catch {
        return { success: true, history: [] };
    }
}

// Commander Integration
export function addDeployCommands(program: Command) {
    const deploy = program
        .command("deploy")
        .description("Deployment management commands");

    deploy
        .command("trigger")
        .description("Trigger a deployment for an app")
        .argument("<app>", "Application name")
        .option("-b, --branch <branch>", "Git branch to deploy")
        .option("--build <steps>", "Build steps (comma-separated)")
        .option("--health-method <method>", "Health check method (http, process, port, command)")
        .option("--health-target <target>", "Health check target")
        .option("--health-timeout <seconds>", "Health check timeout", "30")
        .option("--skip-health", "Skip health check")
        .action(async (app, options) => {
            const buildSteps = options.build ? options.build.split(",").map((s: string) => s.trim()) : [];
            const healthCheck = options.healthMethod && options.healthTarget
                ? {
                    method: options.healthMethod,
                    target: options.healthTarget,
                    timeout: parseInt(options.healthTimeout, 10),
                }
                : undefined;

            const result = await deployApp({
                appName: app,
                branch: options.branch,
                buildSteps,
                healthCheck,
                skipHealthCheck: options.skipHealth,
            });

            if (!result.success) {
                process.exit(1);
            }
        });

    deploy
        .command("rollback")
        .description("Rollback an app to a previous version")
        .argument("<app>", "Application name")
        .option("-c, --commit <hash>", "Specific commit hash to rollback to")
        .action(async (app, options) => {
            const result = await rollbackApp(app, options.commit);
            if (!result.success) {
                process.exit(1);
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
                console.log(`📜 Deployment history for ${app}:`);
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
