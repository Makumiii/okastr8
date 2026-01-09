/**
 * Deploy Core - Shared deployment logic
 * Used by both fresh imports and rollbacks
 */

import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { OKASTR8_HOME } from "../config";
import { runCommand } from "../utils/command";

// Helper to get script path
// Since we are in src/commands, project root is ../..
const PROJECT_ROOT = join(__dirname, "..", "..");
const SCRIPTS = {
    create: join(PROJECT_ROOT, "scripts/systemd/create.sh"),
    stop: join(PROJECT_ROOT, "scripts/systemd/stop.sh"),
    start: join(PROJECT_ROOT, "scripts/systemd/start.sh"),
    restart: join(PROJECT_ROOT, "scripts/systemd/restart.sh"),
    status: join(PROJECT_ROOT, "scripts/systemd/status.sh"),
    logs: join(PROJECT_ROOT, "scripts/systemd/logs.sh"),
};

const APPS_DIR = join(OKASTR8_HOME, "apps");

export interface DeployConfig {
    runtime: string;
    buildSteps: string[];
    startCommand: string;
    port?: number;
    domain?: string;
    env?: Record<string, string>;
}

export interface DeployFromPathOptions {
    appName: string;
    releasePath: string;         // Path to version folder containing okastr8.yaml
    versionId: number;
    gitRepo?: string;            // Optional: for app.json metadata
    gitBranch?: string;
    onProgress?: (msg: string) => void;
}

export interface DeployResult {
    success: boolean;
    message: string;
    config?: DeployConfig;
}

/**
 * Deploy from an existing path (used for both fresh deploys and rollbacks)
 * 
 * Steps:
 * 1. Load okastr8.yaml from releasePath
 * 2. Validate runtime is installed
 * 3. Run build steps
 * 4. Stop existing service (if running)
 * 5. Update symlink to this version
 * 6. Create/update systemd service
 * 7. Start service
 * 8. Health check
 */
export async function deployFromPath(options: DeployFromPathOptions): Promise<DeployResult> {
    const { appName, releasePath, versionId, gitRepo, gitBranch, onProgress } = options;

    const log = onProgress || ((msg: string) => console.log(msg));
    const appDir = join(APPS_DIR, appName);
    const currentPath = join(appDir, "current");

    // 1. Load configuration from okastr8.yaml
    log("📄 Loading okastr8.yaml configuration...");
    const configPath = join(releasePath, "okastr8.yaml");

    if (!existsSync(configPath)) {
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
            runtime: rawConfig.runtime || 'custom',
            buildSteps: rawConfig.build || [],
            startCommand: rawConfig.start || '',
            port: rawConfig.port,
            domain: rawConfig.domain,
            env: rawConfig.env,
        };

        log(`✅ Configuration loaded`);
    } catch (error: any) {
        return {
            success: false,
            message: `Failed to parse okastr8.yaml: ${error.message}`,
        };
    }

    if (!config.startCommand) {
        return {
            success: false,
            message: "No start command specified in okastr8.yaml",
            config,
        };
    }

    // 2. Validate runtime is installed
    const supportedRuntimes = ['node', 'python', 'go', 'bun', 'deno'];
    if (supportedRuntimes.includes(config.runtime)) {
        const { checkRuntimeInstalled, formatMissingRuntimeError } = await import("./env");
        const isInstalled = await checkRuntimeInstalled(config.runtime);

        if (!isInstalled) {
            return {
                success: false,
                message: formatMissingRuntimeError(config.runtime as any),
                config,
            };
        }
    }

    log(`🔧 Runtime: ${config.runtime}`);
    log(`📝 Build steps: ${config.buildSteps.join(", ") || "none"}`);
    log(`▶️  Start command: ${config.startCommand}`);

    // 3. Run build steps
    if (config.buildSteps.length > 0) {
        log("🔨 Running build steps...");

        for (const step of config.buildSteps) {
            log(`  → ${step}`);
            const buildResult = await runCommand("bash", ["-c", step], releasePath);
            if (buildResult.exitCode !== 0) {
                return {
                    success: false,
                    message: `Build failed: ${step}\n${buildResult.stderr}`,
                    config,
                };
            }
        }
        log("✅ Build complete");
    }

    // 4. Stop existing service (if running)
    log("🛑 Stopping existing service...");
    // Use helper script
    await runCommand("sudo", [SCRIPTS.stop, appName]);

    // 5. Update symlink to this version
    log("🔄 Switching to version...");
    const { setCurrentVersion } = await import("./version");
    await setCurrentVersion(appName, versionId);

    // 6. Create/update systemd service (always reconfigure)
    log("📦 Configuring systemd service...");

    // Prepare Start Command with Env Vars
    let execStart = config.startCommand;
    if (config.env) {
        // Inject env vars as exports before the command
        // Format: export KEY="VAL"; export KEY2="VAL2"; cmd
        const envExports = Object.entries(config.env)
            .map(([key, value]) => `export ${key}="${value}"`)
            .join("; ");
        execStart = `${envExports}; ${config.startCommand}`;
    }

    // Use create.sh helper
    // Usage: create.sh <name> <description> <exec_start> <work_dir> <user> <wanted_by> <auto_start>
    const user = process.env.USER || "root";
    const description = `${appName} - Managed by okastr8`;

    // We pass "true" for auto_start so the script handles the enable/start logic

    const createResult = await runCommand("sudo", [
        SCRIPTS.create,
        appName,
        description,
        execStart,
        currentPath,
        user,
        "multi-user.target",
        "true"
    ]);

    if (createResult.exitCode !== 0) {
        return {
            success: false,
            message: `Failed to create/start service: ${createResult.stderr}`,
            config,
        };
    }

    // 7. Service is already started by create.sh, but let's verify
    // log("▶️  Starting service..."); 
    // (Skipped explicit start since create.sh does it)

    // 8. Health check - Poll until port is listening or timeout
    const maxWaitSeconds = 30;
    const pollIntervalMs = 1000;
    let isHealthy = false;

    if (config.port) {
        log(`🏥 Waiting for service to listen on port ${config.port} (max ${maxWaitSeconds}s)...`);

        for (let elapsed = 0; elapsed < maxWaitSeconds; elapsed++) {
            // Check if port is listening using ss (faster than lsof)
            const portCheck = await runCommand("ss", ["-ltn", `sport = :${config.port}`]);
            const isListening = portCheck.stdout.includes(`:${config.port}`);

            if (isListening) {
                log(`✅ Port ${config.port} is listening after ${elapsed + 1}s`);
                isHealthy = true;
                break;
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }
    } else {
        // No port configured, fall back to service status check with short wait
        log("⏳ No port configured. Waiting 3 seconds then checking service status...");
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Always verify systemd reports active
    log("🏥 Verifying systemd service status...");
    const healthCheck = await runCommand("sudo", [SCRIPTS.status, appName]);
    const serviceStatus = healthCheck.stdout.trim();
    const isActive = healthCheck.exitCode === 0 && (serviceStatus.includes("active (running)") || serviceStatus === "active");

    if (!isActive) {
        log(`❌ Service failed to start. Status: ${serviceStatus}`);

        // Get logs using helper
        const logsResult = await runCommand("sudo", [SCRIPTS.logs, appName, "30"]);
        const logs = logsResult.stdout || logsResult.stderr || "No logs available";

        return {
            success: false,
            message: `Deployment failed: Service is not active.\n\nRecent logs:\n${logs.slice(0, 500)}...`,
            config,
        };
    }

    // If port was configured but never started listening
    if (config.port && !isHealthy) {
        log(`⚠️ Service is active but port ${config.port} not listening after ${maxWaitSeconds}s`);

        const logsResult = await runCommand("sudo", [SCRIPTS.logs, appName, "30"]);
        const logs = logsResult.stdout || logsResult.stderr || "No logs available";

        return {
            success: false,
            message: `Deployment warning: Service is active but not listening on port ${config.port}.\n\nRecent logs:\n${logs.slice(0, 500)}...`,
            config,
        };
    }

    log("✅ Service is running successfully!");

    // Update app.json with metadata
    const metadataPath = join(appDir, "app.json");
    let existingMetadata: any = {};
    try {
        const content = await readFile(metadataPath, "utf-8");
        existingMetadata = JSON.parse(content);
    } catch { }

    const { writeFile: fsWriteFile } = await import("fs/promises");
    // We can't know the exact unit file path since we used the script, but standard location is:
    const unitFilePath = `/etc/systemd/system/${appName}.service`;

    await fsWriteFile(
        metadataPath,
        JSON.stringify(
            {
                name: appName,
                description: description,
                execStart: config.startCommand,
                workingDirectory: currentPath,
                user: user,
                port: config.port,
                domain: config.domain,
                gitRepo,
                gitBranch,
                buildSteps: config.buildSteps,
                env: config.env,
                createdAt: existingMetadata.createdAt || new Date().toISOString(),
                unitFile: unitFilePath,
                // Preserve versioning data
                versions: existingMetadata.versions || [],
                currentVersionId: versionId,
            },
            null,
            2
        )
    );

    return {
        success: true,
        message: `Successfully deployed ${appName} (v${versionId})`,
        config,
    };
}
