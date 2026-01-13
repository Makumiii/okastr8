import { Command } from "commander";
import { runCommand } from "../utils/command";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { saveSystemConfig, getSystemConfig } from "../config";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

const SCRIPTS = {
    install: join(PROJECT_ROOT, "scripts", "tunnel", "install.sh"),
};

async function isCloudflaredInstalled() {
    const result = await runCommand("which", ["cloudflared"]);
    return result.exitCode === 0;
}

export async function installTunnel(token: string) {
    // 1. Install Binary if missing
    if (!await isCloudflaredInstalled()) {
        console.log("Installing Cloudflared...");
        const installResult = await runCommand("bash", [SCRIPTS.install]);
        if (installResult.exitCode !== 0) {
            throw new Error(`Failed to install cloudflared: ${installResult.stderr}`);
        }
    }

    // 2. Install Service
    console.log("Registering Tunnel Service...");
    // cloudflared service uninstall first to be safe
    await runCommand("sudo", ["cloudflared", "service", "uninstall"]);

    const serviceResult = await runCommand("sudo", ["cloudflared", "service", "install", token]);
    if (serviceResult.exitCode !== 0) {
        throw new Error(`Failed to configure service: ${serviceResult.stderr}`);
    }

    // 3. Save Config
    await saveSystemConfig({
        tunnel: {
            enabled: true,
            auth_token: token // Start of token usually "ey..."
        }
    });

    return { success: true, message: "Tunnel installed and started successfully!" };
}

export async function uninstallTunnel() {
    console.log("Removing Tunnel Service...");
    const result = await runCommand("sudo", ["cloudflared", "service", "uninstall"]);

    // Ignore errors if service wasn't installed

    await saveSystemConfig({
        tunnel: {
            enabled: false,
            auth_token: undefined
        }
    });

    return { success: true, message: "Tunnel service removed." };
}

export async function getTunnelStatus() {
    if (!await isCloudflaredInstalled()) {
        return { installed: false, running: false };
    }

    const result = await runCommand("systemctl", ["is-active", "cloudflared"]);
    const running = result.stdout.trim() === "active";

    const config = await getSystemConfig();

    return {
        installed: true,
        running,
        configured: !!config.tunnel?.enabled
    };
}

export function addTunnelCommands(program: Command) {
    const tunnel = program
        .command("tunnel")
        .description("Manage Cloudflare Tunnel for remote access");

    tunnel
        .command("setup")
        .description("Install and configure Cloudflare Tunnel")
        .argument("<token>", "Tunnel Token from Cloudflare Dashboard")
        .action(async (token) => {
            console.log("Setting up Cloudflare Tunnel...");
            try {
                const result = await installTunnel(token);
                console.log(result.message);
                console.log("   Your dashboard should now be accessible at your configured domain.");
            } catch (error: any) {
                console.error("Setup failed:", error.message);
                process.exit(1);
            }
        });

    tunnel
        .command("uninstall")
        .description("Remove Cloudflare Tunnel service")
        .action(async () => {
            try {
                const result = await uninstallTunnel();
                console.log(result.message);
            } catch (error: any) {
                console.error("Uninstall failed:", error.message);
                process.exit(1);
            }
        });

    tunnel
        .command("status")
        .description("Check tunnel status")
        .action(async () => {
            const status = await getTunnelStatus();
            if (!status.installed) {
                console.log("cloudflared is not installed.");
            } else if (status.running) {
                console.log("Tunnel is RUNNING (active).");
            } else {
                console.log("Tunnel is INSTALLED but NOT RUNNING.");
            }
        });
}
