import { Command } from "commander";
import { runCommand } from "../utils/command";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { mkdir, rm, readdir, stat, readFile, writeFile } from "fs/promises";
import { createVersion, removeVersion, getVersions, setCurrentVersion } from "./version";
import { deployFromPath } from "./deploy-core";

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/commands/
const PROJECT_ROOT = join(__dirname, "..", "..");

// App directory structure
import { OKASTR8_HOME } from "../config";
const APPS_DIR = join(OKASTR8_HOME, "apps");

// Systemd scripts
const SYSTEMD_SCRIPTS = {
    create: join(PROJECT_ROOT, "scripts", "systemd", "create.sh"),
    delete: join(PROJECT_ROOT, "scripts", "systemd", "delete.sh"),
    start: join(PROJECT_ROOT, "scripts", "systemd", "start.sh"),
    stop: join(PROJECT_ROOT, "scripts", "systemd", "stop.sh"),
    restart: join(PROJECT_ROOT, "scripts", "systemd", "restart.sh"),
    status: join(PROJECT_ROOT, "scripts", "systemd", "status.sh"),
    logs: join(PROJECT_ROOT, "scripts", "systemd", "logs.sh"),
    enable: join(PROJECT_ROOT, "scripts", "systemd", "enable.sh"),
    disable: join(PROJECT_ROOT, "scripts", "systemd", "disable.sh"),
};

export interface AppConfig {
    name: string;
    description: string;
    execStart: string;
    workingDirectory: string;
    user: string;
    port?: number;
    domain?: string;
    gitRepo?: string;
    gitBranch?: string;
    buildSteps?: string[];
    env?: Record<string, string>;
    webhookAutoDeploy?: boolean;
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
    try {
        const { appDir, repoDir, logsDir } = await ensureAppDirs(config.name);

        // Prepare Start Command with Env Vars
        let execStart = config.execStart;
        if (config.env) {
            // Inject env vars as exports before the command
            // Format: export KEY="VAL"; export KEY2="VAL2"; cmd
            const envExports = Object.entries(config.env)
                .map(([key, value]) => `export ${key}="${value}"`)
                .join("; ");
            execStart = `${envExports}; ${config.execStart}`;
        }

        // Use create.sh helper
        // Usage: create.sh <name> <description> <exec_start> <work_dir> <user> <wanted_by> <auto_start>
        // We set auto_start=true so it enables and starts it for us
        const result = await runCommand("sudo", [
            SYSTEMD_SCRIPTS.create,
            config.name,
            config.description,
            execStart,
            config.workingDirectory || repoDir,
            config.user,
            "multi-user.target",
            "true"
        ]);

        if (result.exitCode !== 0) {
            // Cleanup app dir if service creation failed
            await runCommand("sudo", ["rm", "-rf", appDir]);
            throw new Error(`Failed to create systemd service: ${result.stderr}`);
        }

        // Service is now running.
        // We verify deployment by creating app.json

        // ONLY NOW: Write app.json after service is running
        // This ensures app only appears in UI when fully operational
        const metadataPath = join(appDir, "app.json");

        // We can't easily get unit file path from script, but can assume standard
        const unitFilePath = `/etc/systemd/system/${config.name}.service`;

        let existingMetadata: any = {};
        try {
            const content = await readFile(metadataPath, "utf-8");
            existingMetadata = JSON.parse(content);
        } catch { }

        await writeFile(
            metadataPath,
            JSON.stringify(
                {
                    ...config,
                    createdAt: existingMetadata.createdAt || new Date().toISOString(),
                    unitFile: unitFilePath,
                    repoDir,
                    logsDir,
                    // Preserve versioning data
                    versions: existingMetadata.versions || [],
                    currentVersionId: existingMetadata.currentVersionId || null,
                    webhookAutoDeploy: config.webhookAutoDeploy ?? true
                },
                null,
                2
            )
        );

        return {
            success: true,
            appDir,
            message: "App created and started",
        };
    } catch (error) {
        console.error(`Error creating app ${config.name}:`, error);
        throw error;
    }
}

export async function deleteApp(appName: string) {
    try {
        console.log(`Deleting app: ${appName}`);

        // Stop and remove the systemd service
        console.log(`Running systemd delete script for ${appName}...`);
        const result = await runCommand("sudo", [SYSTEMD_SCRIPTS.delete, appName]);

        if (result.exitCode !== 0) {
            console.error(`Systemd delete script failed: ${result.stderr}`);
        }

        // remove app directory
        // Since we are running as user, we shouldn't need sudo if ownership is correct.
        // If files were created by root previously, this might fail, but that's what we want to fix (ownership).
        const appDir = join(APPS_DIR, appName);
        console.log(`Removing app directory: ${appDir}`);
        await rm(appDir, { recursive: true, force: true });

        console.log(`Successfully deleted app: ${appName}`);
        return {
            success: true,
            message: `App '${appName}' deleted successfully`,
        };
    } catch (error) {
        console.error(`Error deleting app ${appName}:`, error);
        return {
            success: false,
            message: `Failed to delete app: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

export async function listApps() {
    try {
        await mkdir(APPS_DIR, { recursive: true });
        const entries = await readdir(APPS_DIR, { withFileTypes: true });
        const apps = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const metadataPath = join(APPS_DIR, entry.name, "app.json");
                try {
                    const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
                    apps.push(metadata);
                } catch {
                    // No metadata, just include the name
                    apps.push({ name: entry.name });
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
    const result = await runCommand("sudo", [SYSTEMD_SCRIPTS.status, appName]);
    return {
        success: result.exitCode === 0,
        message: result.stdout || result.stderr,
    };
}

export async function getAppLogs(appName: string, lines: number = 50) {
    const result = await runCommand("sudo", [
        "journalctl",
        "-u",
        appName,
        "-n",
        lines.toString(),
        "--no-pager",
    ]);
    return {
        success: result.exitCode === 0,
        logs: result.stdout || result.stderr,
    };
}

export async function exportAppLogs(appName: string) {
    try {
        const appDir = join(APPS_DIR, appName);
        const logsDir = join(appDir, "logs");
        await mkdir(logsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const logFile = join(logsDir, `${appName}-${timestamp}.log`);

        // Export all logs for this service
        const result = await runCommand("sudo", [
            "journalctl",
            "-u",
            appName,
            "--no-pager",
            "-o",
            "short-iso",
        ]);

        if (result.exitCode === 0 && result.stdout) {
            await writeFile(logFile, result.stdout);
            return { success: true, logFile, message: `Logs exported to ${logFile}` };
        }

        return { success: false, message: result.stderr || "No logs available" };
    } catch (error) {
        console.error(`Error exporting logs for ${appName}:`, error);
        throw error;
    }
}

export async function startApp(appName: string) {
    const result = await runCommand("sudo", [SYSTEMD_SCRIPTS.start, appName]);
    return {
        success: result.exitCode === 0,
        message: result.stdout || result.stderr,
    };
}

export async function stopApp(appName: string) {
    const result = await runCommand("sudo", [SYSTEMD_SCRIPTS.stop, appName]);
    return {
        success: result.exitCode === 0,
        message: result.stdout || result.stderr,
    };
}

export async function restartApp(appName: string) {
    const result = await runCommand("sudo", [SYSTEMD_SCRIPTS.restart, appName]);
    return {
        success: result.exitCode === 0,
        message: result.stdout || result.stderr,
    };
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

export async function updateApp(appName: string) {
    let versionId: number = 0;
    let releasePath: string = "";
    try {
        const metadata = await getAppMetadata(appName);

        if (!metadata.gitRepo || !metadata.repoDir) {
            throw new Error("Not a git-linked application");
        }

        console.log(`📡 Updating ${appName} from git...`);

        // 1. Create new version entry (V2 Logic)
        const branch = metadata.gitBranch || "main";
        // We use "HEAD" initially, and deployFromPath doesn't strictly require git hash for logic, 
        // but ideally we'd get the hash traverse. 
        const versionResult = await createVersion(appName, "HEAD", branch);
        versionId = versionResult.versionId;
        releasePath = versionResult.releasePath;

        console.log(`📦 Created release v${versionId} at ${releasePath}`);

        // 2. Clone code into release path (Fresh clone like importRepo)
        // We use the gitRepo URL from metadata
        const cloneUrl = metadata.gitRepo;

        console.log(`⬇️ Cloning ${branch} into release...`);
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
        console.log(`🚀 Deploying v${versionId}...`);
        const deployResult = await deployFromPath({
            appName,
            releasePath,
            versionId,
            gitRepo: metadata.gitRepo,
            gitBranch: branch,
            onProgress: (msg) => console.log(msg)
        });

        if (!deployResult.success) {
            // Cleanup on failure
            console.log("⚠️ Deployment failed. Cleaning up...");
            await rm(releasePath, { recursive: true, force: true });
            await removeVersion(appName, versionId);
            throw new Error(deployResult.message);
        }

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
        throw error;
    }
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

// Commander Integration
export function addAppCommands(program: Command) {
    const app = program
        .command("app")
        .description("Manage okastr8 applications");

    app
        .command("create")
        .description("Create a new application with systemd service")
        .argument("<name>", "Application name")
        .argument("<exec_start>", "Command to run (e.g., 'bun run start')")
        .option("-d, --description <desc>", "Service description", "Okastr8 managed app")
        .option("-u, --user <user>", "User to run as", process.env.USER || "root")
        .option("-w, --working-dir <dir>", "Working directory")
        .option("-p, --port <port>", "Application port")
        .option("--domain <domain>", "Domain for Caddy reverse proxy")
        .option("--git-repo <url>", "Git repository URL")
        .option("--git-branch <branch>", "Git branch to track", "main")
        .action(async (name, execStart, options) => {
            console.log(`📦 Creating app '${name}'...`);
            try {
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
                });
                console.log(result.message);
                console.log(`✅ App created at ${result.appDir}`);
            } catch (error: any) {
                console.error(`❌ Failed to create app:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("delete")
        .description("Delete an application and its systemd service")
        .argument("<name>", "Application name")
        .action(async (name) => {
            console.log(`🗑️  Deleting app '${name}'...`);
            try {
                const result = await deleteApp(name);
                console.log(result.message);
                console.log(`✅ App '${name}' deleted`);
            } catch (error: any) {
                console.error(`❌ Failed to delete app:`, error.message);
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
                    console.log("📋 Okastr8 Apps:");
                    for (const app of result.apps) {
                        console.log(`  • ${app.name}${app.description ? ` - ${app.description}` : ""}`);
                    }
                }
            } catch (error: any) {
                console.error(`❌ Failed to list apps:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("status")
        .description("Show status of an application")
        .argument("<name>", "Application name")
        .action(async (name) => {
            try {
                const result = await getAppStatus(name);
                console.log(result.message);
            } catch (error: any) {
                console.error(`❌ Failed to get status:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("logs")
        .description("Show logs for an application")
        .argument("<name>", "Application name")
        .option("-n, --lines <lines>", "Number of lines to show", "50")
        .action(async (name, options) => {
            try {
                const result = await getAppLogs(name, parseInt(options.lines, 10));
                console.log(result.logs);
            } catch (error: any) {
                console.error(`❌ Failed to get logs:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("export-logs")
        .description("Export logs to app directory")
        .argument("<name>", "Application name")
        .action(async (name) => {
            try {
                const result = await exportAppLogs(name);
                console.log(result.message);
            } catch (error: any) {
                console.error(`❌ Failed to export logs:`, error.message);
                process.exit(1);
            }
        });

    app
        .command("start")
        .description("Start an application")
        .argument("<name>", "Application name")
        .action(async (name) => {
            console.log(`▶️  Starting ${name}...`);
            const result = await startApp(name);
            console.log(result.message);
        });

    app
        .command("stop")
        .description("Stop an application")
        .argument("<name>", "Application name")
        .action(async (name) => {
            console.log(`⏹️  Stopping ${name}...`);
            const result = await stopApp(name);
            console.log(result.message);
        });

    app
        .command("restart")
        .description("Restart an application")
        .argument("<name>", "Application name")
        .action(async (name) => {
            console.log(`🔄 Restarting ${name}...`);
            const result = await restartApp(name);
            console.log(result.message);
        });

    app
        .command("webhook")
        .description("Enable or disable auto-deploy webhooks for an app")
        .argument("<name>", "Application name")
        .argument("<state>", "State (enable/disable, on/off, true/false)")
        .action(async (name, state) => {
            const enabled = ['enable', 'on', 'true', '1'].includes(state.toLowerCase());
            console.log(`${enabled ? '🔌 Enabling' : '🔌 Disabling'} webhooks for ${name}...`);
            try {
                const result = await setAppWebhookAutoDeploy(name, enabled);
                console.log(result.message);
            } catch (error: any) {
                console.error(`❌ Failed:`, error.message);
                process.exit(1);
            }
        });
}
