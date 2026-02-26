import { Command } from "commander";
import { listApps, deleteApp } from "./app";
import { stopService, startService, restartService, disableService } from "./systemd";
import { OKASTR8_HOME } from "../config";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import { runCommand } from "../utils/command";

// ============ Global Service Controls ============

export async function controlAllServices(action: "start" | "stop" | "restart") {
    console.log(`${action.toUpperCase()}ING all services...`);
    const { apps } = await listApps();

    if (apps.length === 0) {
        console.log("No apps found.");
        return;
    }

    const results = [];
    for (const app of apps) {
        console.log(`  • ${app.name}...`);
        try {
            if (action === "start") await startService(app.name);
            if (action === "stop") await stopService(app.name);
            if (action === "restart") await restartService(app.name);
            results.push({ name: app.name, success: true });
        } catch (e: any) {
            console.error(`     Failed: ${e.message}`);
            results.push({ name: app.name, success: false, error: e.message });
        }
    }

    console.log("\nOperation complete.");
}

// ============ Nuke Protocol ============

async function nukeSystem() {
    console.clear();
    console.log(`
WARNING: NUKE PROTOCOL INITIATED

You are about to DESTROY the entire okastr8 ecosystem on this machine.
This action is IRREVERSIBLE.

The following will happen:
1. All okastr8 applications will be STOPPED and DELETED.
2. All services and containers managed by okastr8 will be REMOVED.
3. The ~/.okastr8 configuration directory will be ERASED.
4. Database, logs, and user data will be LOST FOREVER.
`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const phrase = "DELETE EVERYTHING";

    const answer = await new Promise<string>((resolve) => {
        rl.question(`To confirm, type exactly "${phrase}": `, resolve);
    });
    rl.close();

    if (answer !== phrase) {
        console.log("\nConfirmation failed. Aborting nuke protocol.");
        return;
    }

    console.log("\nNUKE CONFIRMED. DESTRUCTION IMMINENT in 5 seconds...");
    await new Promise((r) => setTimeout(r, 5000));

    console.log("\nStep 1: Destroying Applications...");
    const { apps } = await listApps();
    for (const app of apps) {
        process.stdout.write(`  Killing ${app.name}... `);
        try {
            try {
                await stopService(app.name);
            } catch {}
            try {
                await disableService(app.name);
            } catch {}
            // Use deleteApp to clean up unit files and directories
            await deleteApp(app.name);
            process.stdout.write("Done\n");
        } catch (e) {
            console.log(`Failed (Ignored): ${e}`);
        }
    }

    console.log("\nStep 2: Stopping Manager Service...");
    try {
        await stopService("okastr8-manager");
        await disableService("okastr8-manager");
        // Manually delete manager unit file if deleteApp didn't cover it (it shouldn't)
        // Check scripts/systemd/delete.sh logic? Assuming manual cleanup for manager.
        // We'll trust the uninstall script or user to remove the manager unit if it was installed manually.
        // But let's try to be thorough if we can.
        // Assuming okastr8-manager was set up as a standard service.
    } catch {
        console.log("   (Manager service not running or not found)");
    }

    console.log("\nStep 3: Incinerating Configuration...");
    if (existsSync(OKASTR8_HOME)) {
        await fs.rm(OKASTR8_HOME, { recursive: true, force: true });
        console.log(`   Deleted ${OKASTR8_HOME}`);
    }

    console.log("\nSYSTEM NUKED. Okastr8 has been reset to factory application state.");
}

// ============ Uninstall Helper ============

async function uninstallOkastr8() {
    await nukeSystem();

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         UNINSTALLATION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The system has been cleaned. To remove the CL tool, run:

  npm uninstall -g okastr8

Or if installed via binary/other package manager, remove the binary manually.

Goodbye!
`);
}

interface UpdateSystemOptions {
    branch?: string;
    installDir?: string;
    skipDashboardBuild?: boolean;
}

function resolveHomePath(inputPath: string) {
    if (inputPath === "~") return os.homedir();
    if (inputPath.startsWith("~/")) return path.join(os.homedir(), inputPath.slice(2));
    return inputPath;
}

async function runStep(label: string, command: string, args: string[], cwd?: string) {
    console.log(`• ${label}`);
    const result = await runCommand(command, args, cwd);
    if (result.exitCode !== 0) {
        const details = result.stderr.trim() || result.stdout.trim() || "Unknown error";
        throw new Error(details);
    }
}

function hasFrozenLockfileError(result: { stdout: string; stderr: string }): boolean {
    const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
    return text.includes("lockfile had changes") && text.includes("frozen");
}

async function runDashboardInstallWithFallback(dashboardDir: string) {
    console.log("• Installing dashboard dependencies");
    const frozen = await runCommand("bun", ["install", "--frozen-lockfile"], dashboardDir);
    if (frozen.exitCode === 0) return;

    if (!hasFrozenLockfileError(frozen)) {
        const details = frozen.stderr.trim() || frozen.stdout.trim() || "Unknown error";
        throw new Error(details);
    }

    console.log("  Lockfile mismatch detected, retrying without --frozen-lockfile");
    const fallback = await runCommand("bun", ["install"], dashboardDir);
    if (fallback.exitCode !== 0) {
        const details = fallback.stderr.trim() || fallback.stdout.trim() || "Unknown error";
        throw new Error(details);
    }
}

async function updateOkastr8(options: UpdateSystemOptions) {
    const branch = options.branch ?? "main";
    const resolvedInstallDir = path.resolve(resolveHomePath(options.installDir ?? "~/okastr8"));
    const dashboardDir = path.join(resolvedInstallDir, "dashboard");

    if (!existsSync(resolvedInstallDir)) {
        throw new Error(
            `Install directory not found: ${resolvedInstallDir}\nUse --install-dir to point to your okastr8 source directory.`
        );
    }

    if (!existsSync(path.join(resolvedInstallDir, ".git"))) {
        throw new Error(
            `Directory is not a git checkout: ${resolvedInstallDir}\nThis command expects an okastr8 git clone.`
        );
    }

    console.log("Updating okastr8 installation...");
    console.log(`Install directory: ${resolvedInstallDir}`);
    console.log(`Branch: ${branch}`);
    console.log("State directory preserved: ~/.okastr8");

    await runStep("Fetching latest git refs", "git", ["fetch", "origin"], resolvedInstallDir);
    await runStep("Checking out target branch", "git", ["checkout", branch], resolvedInstallDir);
    await runStep(
        "Pulling latest code (fast-forward only)",
        "git",
        ["pull", "--ff-only", "origin", branch],
        resolvedInstallDir
    );

    await runStep("Installing root dependencies", "bun", ["install", "--frozen-lockfile"], resolvedInstallDir);

    if (!options.skipDashboardBuild && existsSync(path.join(dashboardDir, "package.json"))) {
        await runDashboardInstallWithFallback(dashboardDir);
        await runStep("Building dashboard", "bun", ["run", "build"], dashboardDir);
    } else if (options.skipDashboardBuild) {
        console.log("• Skipping dashboard build (--skip-dashboard-build)");
    }

    try {
        await runStep("Restarting manager service", "sudo", ["systemctl", "restart", "okastr8-manager"]);
        await runStep("Checking manager service health", "sudo", [
            "systemctl",
            "is-active",
            "okastr8-manager",
        ]);
    } catch (error: any) {
        throw new Error(
            `${error.message}\nIf sudo prompts for a password, configure non-interactive access with: okastr8 setup sudoers`
        );
    }

    console.log("\nUpdate complete.");
}

// ============ Integration ============

export function addSystemCommands(program: Command) {
    const service = program.command("service").description("Global service controls");

    service
        .command("start-all")
        .description("Start all managed services")
        .action(() => controlAllServices("start"));
    service
        .command("stop-all")
        .description("Stop all managed services")
        .action(() => controlAllServices("stop"));
    service
        .command("restart-all")
        .description("Restart all managed services")
        .action(() => controlAllServices("restart"));

    const system = program.command("system").description("System level commands");

    system.command("nuke").description("DANGEROUS: Destroy all apps and data").action(nukeSystem);

    system
        .command("uninstall")
        .description("Nuke system and show uninstall instructions")
        .action(uninstallOkastr8);

    system
        .command("update")
        .description("Update okastr8 source installation and restart manager service")
        .option("-b, --branch <branch>", "Git branch to update from", "main")
        .option("--install-dir <path>", "okastr8 source directory", "~/okastr8")
        .option("--skip-dashboard-build", "Skip dashboard dependency install and build", false)
        .action(updateOkastr8);
}
