import { Command } from "commander";
import { runCommand } from "../utils/command";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { mkdir, rm, readdir, stat, readFile, writeFile } from "fs/promises";

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/commands/
const PROJECT_ROOT = join(__dirname, "..", "..");

// App directory structure
const OKASTR8_HOME = join(homedir(), ".okastr8");
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

        // Generate environment variables string
        let envVars = "";
        if (config.env) {
            envVars = Object.entries(config.env)
                .map(([key, value]) => `Environment="${key}=${value}"`)
                .join("\n");
        }

        // Generate the systemd unit file content
        const unitContent = `[Unit]
Description=${config.description}
After=network.target

[Service]
Type=simple
User=${config.user}
WorkingDirectory=${config.workingDirectory || repoDir}
ExecStart=${config.execStart}
${envVars}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${config.name}

[Install]
WantedBy=multi-user.target
`;

        // Write unit file to app directory
        const unitFilePath = join(appDir, `${config.name}.service`);
        await writeFile(unitFilePath, unitContent);

        // Create/update app metadata
        const metadataPath = join(appDir, "app.json");
        await writeFile(
            metadataPath,
            JSON.stringify(
                {
                    ...config,
                    createdAt: new Date().toISOString(),
                    unitFile: unitFilePath,
                    repoDir,
                    logsDir,
                },
                null,
                2
            )
        );

        // Use the create script to install the service
        // Deploy to standard /etc/systemd/system/ directory
        // Services are identified by okastr8- prefix (e.g., okastr8-myapp.service)
        const SYSTEMD_DIR = "/etc/systemd/system";

        const result = await runCommand("sudo", ["cp", unitFilePath, `${SYSTEMD_DIR}/${config.name}.service`]);

        if (result.exitCode === 0) {
            await runCommand("sudo", ["systemctl", "daemon-reload"]);
            await runCommand("sudo", ["systemctl", "enable", config.name]);
            await runCommand("sudo", ["systemctl", "start", config.name]);
        }

        return {
            success: result.exitCode === 0,
            appDir,
            message: result.exitCode === 0 ? "App created and started" : result.stderr,
        };
    } catch (error) {
        console.error(`Error creating app ${config.name}:`, error);
        throw error;
    }
}

export async function deleteApp(appName: string) {
    try {
        // Stop and remove the systemd service
        const result = await runCommand("sudo", [SYSTEMD_SCRIPTS.delete, appName]);

        // Remove the app directory
        const appDir = join(APPS_DIR, appName);
        await rm(appDir, { recursive: true, force: true });

        return {
            success: result.exitCode === 0,
            message: result.stdout || result.stderr,
        };
    } catch (error) {
        console.error(`Error deleting app ${appName}:`, error);
        throw error;
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
    try {
        const metadata = await getAppMetadata(appName);

        if (!metadata.gitRepo || !metadata.repoDir) {
            throw new Error("Not a git-linked application");
        }

        console.log(`📡 Updating ${appName} from git...`);

        // 1. Git Pull
        const pullResult = await runCommand("git", ["pull"], metadata.repoDir);
        if (pullResult.exitCode !== 0) {
            throw new Error(`Git pull failed: ${pullResult.stderr}`);
        }
        if (pullResult.stdout.includes("Already up to date")) {
            return { success: true, message: "Already up to date" };
        }

        // 2. Build Steps
        if (metadata.buildSteps && metadata.buildSteps.length > 0) {
            console.log(`🔨 Running build steps for ${appName}...`);
            for (const step of metadata.buildSteps) {
                // Split command and args (naive splitting, assumes 'npm install', etc)
                // For safety/simplicity let's use the shell via runCommand? 
                // runCommand uses execFile style [cmd, args].
                // We'll trust our simple parser or just run via bun shell if needed.
                // Let's assume standard "cmd arg1 arg2" format.
                if (!step.trim()) continue;
                console.log(`🔨 Running build step: ${step}`);

                // Use bash -c to handle composite commands (like 'npm install && npm run build')
                const buildRes = await runCommand("bash", ["-c", step], metadata.repoDir);
                if (buildRes.exitCode !== 0) {
                    throw new Error(`Build step '${step}' failed: ${buildRes.stderr}`);
                }
            }
        }

        // 3. Restart Service
        await restartApp(appName);

        return { success: true, message: "App updated and restarted successfully" };
    } catch (error) {
        console.error(`Error updating app ${appName}:`, error);
        throw error;
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
}
