/**
 * Environment/Runtime Management
 * Detects and manages installed runtimes (node, python, go, bun, deno)
 */

import { runCommand } from "../utils/command";
import { getSystemConfig, saveSystemConfig } from "../config";
import type { RuntimeInfo, RuntimeName } from "../config";

// Detection configuration for each runtime
const RUNTIME_CHECKS: Record<RuntimeName, { cmd: string; args: string[]; regex: RegExp }> = {
    node: {
        cmd: "node",
        args: ["--version"],
        regex: /^v(\d+\.\d+\.\d+)/
    },
    python: {
        cmd: "python3",
        args: ["--version"],
        regex: /Python (\d+\.\d+\.\d+)/
    },
    go: {
        cmd: "go",
        args: ["version"],
        regex: /go(\d+\.\d+(?:\.\d+)?)/
    },
    bun: {
        cmd: "bun",
        args: ["--version"],
        regex: /^(\d+\.\d+\.\d+)/
    },
    deno: {
        cmd: "deno",
        args: ["--version"],
        regex: /deno (\d+\.\d+\.\d+)/
    },
};

// Install hints for each runtime per distro family
const INSTALL_HINTS: Record<RuntimeName, Record<string, string>> = {
    node: {
        fedora: "sudo dnf install nodejs",
        debian: "sudo apt install nodejs",
        arch: "sudo pacman -S nodejs",
        default: "https://nodejs.org/en/download/"
    },
    python: {
        fedora: "sudo dnf install python3",
        debian: "sudo apt install python3",
        arch: "sudo pacman -S python",
        default: "https://www.python.org/downloads/"
    },
    go: {
        fedora: "sudo dnf install golang",
        debian: "sudo apt install golang-go",
        arch: "sudo pacman -S go",
        default: "https://go.dev/dl/"
    },
    bun: {
        fedora: "curl -fsSL https://bun.sh/install | bash",
        debian: "curl -fsSL https://bun.sh/install | bash",
        arch: "curl -fsSL https://bun.sh/install | bash",
        default: "https://bun.sh/"
    },
    deno: {
        fedora: "curl -fsSL https://deno.land/install.sh | sh",
        debian: "curl -fsSL https://deno.land/install.sh | sh",
        arch: "curl -fsSL https://deno.land/install.sh | sh",
        default: "https://deno.land/"
    },
};

/**
 * Detect if a specific runtime is installed and get its version
 */
export async function detectRuntime(name: RuntimeName): Promise<RuntimeInfo> {
    const check = RUNTIME_CHECKS[name];
    if (!check) {
        return { installed: false };
    }

    try {
        const result = await runCommand(check.cmd, check.args);

        if (result.exitCode === 0) {
            const output = result.stdout.trim();
            const match = output.match(check.regex);
            const version = match ? match[1] : undefined;

            // Try to get the path
            const whichResult = await runCommand("which", [check.cmd]);
            const path = whichResult.exitCode === 0 ? whichResult.stdout.trim() : undefined;

            return {
                installed: true,
                version,
                path
            };
        }
    } catch (error) {
        // Command not found or failed
    }

    return { installed: false };
}

/**
 * Detect all supported runtimes
 */
export async function detectAllRuntimes(): Promise<Record<RuntimeName, RuntimeInfo>> {
    const runtimes: RuntimeName[] = ['node', 'python', 'go', 'bun', 'deno'];
    const results: Record<string, RuntimeInfo> = {};

    for (const runtime of runtimes) {
        console.log(`🔍 Checking ${runtime}...`);
        results[runtime] = await detectRuntime(runtime);

        if (results[runtime].installed) {
            console.log(`  ✅ ${runtime} ${results[runtime].version || ''} found at ${results[runtime].path || 'unknown'}`);
        } else {
            console.log(`  ❌ ${runtime} not found`);
        }
    }

    return results as Record<RuntimeName, RuntimeInfo>;
}

/**
 * Check if a specific runtime is installed (quick check)
 */
export async function checkRuntimeInstalled(name: string): Promise<boolean> {
    const runtimeName = name.toLowerCase() as RuntimeName;

    // First check cached config
    const config = await getSystemConfig();
    if (config.environments?.[runtimeName]?.installed) {
        return true;
    }

    // Fall back to live detection
    const info = await detectRuntime(runtimeName);
    return info.installed;
}

/**
 * Get runtime info from config or detect live
 */
export async function getRuntimeInfo(name: RuntimeName): Promise<RuntimeInfo> {
    const config = await getSystemConfig();

    // Return cached if available
    if (config.environments?.[name]) {
        return config.environments[name];
    }

    // Otherwise detect live
    return detectRuntime(name);
}

/**
 * Scan system for all runtimes and save to config
 */
export async function scanAndSaveEnvironments(): Promise<Record<RuntimeName, RuntimeInfo>> {
    console.log("🔧 Scanning for installed runtimes...\n");

    const environments = await detectAllRuntimes();

    // Save to config
    await saveSystemConfig({ environments });

    console.log("\n✅ Environment scan complete. Saved to system.yaml");

    return environments;
}

/**
 * Get install hint for a missing runtime
 */
export function getInstallHint(runtime: RuntimeName, distro?: string): string {
    const hints = INSTALL_HINTS[runtime];
    if (!hints) return "";

    // Try to detect distro from /etc/os-release or use provided
    const distroKey = distro?.toLowerCase() || 'default';

    // Map common distro names to hint keys
    let hintKey = 'default';
    if (distroKey.includes('fedora') || distroKey.includes('rhel') || distroKey.includes('centos')) {
        hintKey = 'fedora';
    } else if (distroKey.includes('ubuntu') || distroKey.includes('debian')) {
        hintKey = 'debian';
    } else if (distroKey.includes('arch')) {
        hintKey = 'arch';
    }

    return hints[hintKey] ?? hints.default ?? "";
}

/**
 * Format error message for missing runtime
 */
export function formatMissingRuntimeError(runtime: RuntimeName, distro?: string): string {
    const hint = getInstallHint(runtime, distro);

    return `
❌ Runtime '${runtime}' is required but not installed.

To install ${runtime}:
  ${hint}

After installing, run: okastr8 env scan
`.trim();
}
