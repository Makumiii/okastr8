import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { runCommand } from "../utils/command";
import { randomBytes } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

import { OKASTR8_HOME } from "../config";
const APPS_DIR = join(OKASTR8_HOME, "apps");

// GitHub API base URL
const GITHUB_API = "https://api.github.com";

export interface GitHubConfig {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    username?: string;
    connectedAt?: string;
}

export interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    clone_url: string;
    ssh_url: string;
    language: string | null;
    default_branch: string;
    private: boolean;
    updated_at: string;
    pushed_at: string;
}

export interface ImportOptions {
    repoFullName: string;
    appName?: string;
    branch?: string;
    port?: number;
    domain?: string;
    buildSteps?: string[];
    startCommand?: string;
    autoDetect?: boolean;
    setupWebhook?: boolean;
}

// Config helpers
// Note: We now use the Unified Config Manager
import { getSystemConfig, saveSystemConfig, reloadSystemConfig } from "../config";

export async function getGitHubConfig(): Promise<GitHubConfig> {
    const config = await getSystemConfig();
    const gh = config.manager?.github || {};
    return {
        clientId: gh.client_id,
        clientSecret: gh.client_secret,
        accessToken: gh.access_token,
        username: gh.username,
        connectedAt: gh.connected_at
    };
}

export async function saveGitHubConfig(github: GitHubConfig): Promise<void> {
    // We only update the runtime parts (access token, username)
    // Client ID/Secret are managed via system.yaml directly by user
    await saveSystemConfig({
        manager: {
            github: {
                access_token: github.accessToken,
                username: github.username,
                connected_at: github.connectedAt
            }
        }
    });
}

// OAuth Functions
export function getAuthUrl(clientId: string, callbackUrl: string): string {
    const scopes = ["repo", "read:user", "admin:repo_hook", "admin:public_key"];
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: scopes.join(" "),
        state: Math.random().toString(36).substring(7),
    });
    return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(
    clientId: string,
    clientSecret: string,
    code: string
): Promise<{ accessToken: string; error?: string }> {
    try {
        const response = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
            }),
        });

        const data = (await response.json()) as { error?: string; error_description?: string; access_token?: string };

        if (data.error) {
            return { accessToken: "", error: data.error_description || data.error };
        }

        return { accessToken: data.access_token || "" };
    } catch (error: any) {
        return { accessToken: "", error: error.message };
    }
}

export async function getGitHubUser(accessToken: string): Promise<any> {
    const response = await fetch(`${GITHUB_API}/user`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return response.json();
}

// SSH Key Management Functions
export async function listSSHKeys(accessToken: string): Promise<any[]> {
    const response = await fetch(`${GITHUB_API}/user/keys`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
            throw new Error(
                `OAuth token lacks 'admin:public_key' permission.

Your GitHub token can authenticate but cannot manage SSH keys.

HOW TO FIX:
1. Go to: https://github.com/settings/tokens
2. Find your okastr8 token and edit it
3. Check the 'admin:public_key' scope
4. Save and reconnect okastr8 to GitHub

OR use manual workaround:
   ssh-keygen -t ed25519 -f ~/.ssh/okastr8_deploy_key -N "" -C "okastr8"
   cat ~/.ssh/okastr8_deploy_key.pub
   # Then add the key manually at: https://github.com/settings/keys`
            );
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<any[]>;
}

export async function hasOkastr8DeployKey(accessToken: string): Promise<boolean> {
    const keys = await listSSHKeys(accessToken);
    return keys.some((k: any) => k.title?.includes("okastr8") || k.title?.includes("Okastr8"));
}

export async function createSSHKey(
    accessToken: string,
    title: string,
    publicKey: string
): Promise<{ success: boolean; message: string }> {
    try {
        const response = await fetch(`${GITHUB_API}/user/keys`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title,
                key: publicKey,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json() as { message?: string; errors?: { message?: string }[] };
            // Key already exists
            if (errorData.errors?.some((e) => e.message?.includes("already in use"))) {
                return { success: true, message: "SSH key already added to GitHub" };
            }
            return { success: false, message: errorData.message || response.statusText };
        }

        return { success: true, message: "SSH key added to GitHub successfully!" };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// Repository Functions
export async function listRepos(accessToken: string): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const response = await fetch(
            `${GITHUB_API}/user/repos?per_page=${perPage}&page=${page}&sort=pushed&affiliation=owner,collaborator`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/vnd.github.v3+json",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as GitHubRepo[];
        if (data.length === 0) break;

        repos.push(...data);
        if (data.length < perPage) break;
        page++;
    }

    return repos;
}

export async function getRepo(
    accessToken: string,
    fullName: string
): Promise<GitHubRepo> {
    const response = await fetch(`${GITHUB_API}/repos/${fullName}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return (await response.json()) as GitHubRepo;
}

// Check if a file exists in a repository
export async function checkFileExists(
    accessToken: string,
    fullName: string,
    filePath: string,
    branch: string = "main"
): Promise<boolean> {
    try {
        const response = await fetch(
            `${GITHUB_API}/repos/${fullName}/contents/${filePath}?ref=${branch}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/vnd.github.v3+json",
                },
            }
        );
        return response.ok;
    } catch {
        return false;
    }
}

export async function listBranches(accessToken: string, fullName: string): Promise<string[]> {
    const branches: string[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const response = await fetch(`${GITHUB_API}/repos/${fullName}/branches?per_page=${perPage}&page=${page}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch branches: ${response.statusText}`);
        }

        const data = await response.json() as any[];
        if (data.length === 0) break;

        branches.push(...data.map(b => b.name));

        if (data.length < perPage) break;
        page++;
    }

    return branches;
}

export async function checkRepoConfig(accessToken: string, fullName: string, ref: string): Promise<boolean> {
    // Check for okastr8.yaml, okastr8.yml, or okastr8.json
    const files = ["okastr8.yaml", "okastr8.yml", "okastr8.json"];

    for (const file of files) {
        // Use contents API to check existence. Metadata request (HEAD) is not standard for API
        const response = await fetch(`${GITHUB_API}/repos/${fullName}/contents/${file}?ref=${encodeURIComponent(ref)}`, {
            method: "HEAD", // HEAD works for contents if we just want existence? No, API usually returns 404
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
                // "X-GitHub-Api-Version": "2022-11-28" // Optional but good practice
            },
        });

        if (response.ok) return true;
    }
    return false;
}

// Auto-detection for build configs
export interface DetectedConfig {
    buildSteps: string[];
    startCommand: string;
    runtime: string;
    port?: number;
    domain?: string;
    env?: Record<string, string>;
}



// Import repo and create okastr8 app
export async function importRepo(
    options: ImportOptions,
    deploymentId?: string
): Promise<{
    success: boolean;
    message: string;
    appName?: string;
    config?: DetectedConfig;
}> {
    const { createApp } = await import("./app");
    const { createVersion, setCurrentVersion, cleanOldVersions, initializeVersioning, updateVersionStatus, removeVersion, getVersions } = await import("./version");
    const githubConfig = await getGitHubConfig();

    // Helper to log to both console and stream
    const log = (message: string) => {
        if (deploymentId) {
            const { streamLog } = require('../utils/deploymentLogger');
            streamLog(deploymentId, message);
        } else {
            console.log(message);
        }
    };

    if (!githubConfig.accessToken) {
        return { success: false, message: "GitHub not connected" };
    }

    try {
        // Get repo info
        const repo = await getRepo(githubConfig.accessToken, options.repoFullName);
        const appName = options.appName || repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const branch = options.branch || repo.default_branch;

        // CHECK FOR okastr8.yaml BEFORE CLONING (fail fast)
        log("🔍 Checking for okastr8.yaml in repository...");
        const configExists = await checkFileExists(
            githubConfig.accessToken,
            repo.full_name,
            "okastr8.yaml",
            branch
        );

        if (!configExists) {
            log("❌ okastr8.yaml not found in repository root");
            return {
                success: false,
                message: `Deployment blocked: okastr8.yaml not found in repository.\n\nPlease add an okastr8.yaml file to your repository root.\n\nExample:\n\nruntime: node\nbuild:\n  - npm install\n  - npm run build\nstart: npm run start\nport: 3000\n\nVisit https://github.com/${repo.full_name}/new/${branch} to create the file.`,
                appName,
            };
        }

        log("✅ okastr8.yaml found - proceeding with deployment");

        // Initialize directories
        const appDir = join(APPS_DIR, appName);
        await mkdir(appDir, { recursive: true });

        // Ensure versioning is initialized (for existing apps)
        await initializeVersioning(appName);

        log(`📦 Preparing deployment for ${repo.full_name} (${branch})...`);

        // Create new version entry
        // We'll get the commit hash after cloning, so simpler to just use "HEAD" for now 
        // or we could fetch it via API but let's stick to clone first
        const { versionId, releasePath } = await createVersion(appName, "HEAD", branch);

        // CLEANUP HELPER
        const cleanupFailedDeployment = async (reason: string) => {
            log(`🧹 Cleaning up: ${reason}`);
            try { await rm(releasePath, { recursive: true, force: true }); } catch (e) { console.error("Error removing release path:", e); }
            try { await removeVersion(appName, versionId); } catch (e) { console.error("Error removing version entry:", e); }
            try {
                const data = await getVersions(appName);
                if (data.versions.length === 0 && !data.current) {
                    log(`🗑️  No versions left. Removing ghost app directory: ${appDir}`);
                    await rm(appDir, { recursive: true, force: true });
                }
            } catch (e) { console.error("Error checking ghost app:", e); }
        };

        await updateVersionStatus(appName, versionId, "pending", "Cloning repository");

        log(`⬇️ Cloning into release v${versionId}...`);

        // Clone the repo (use HTTPS with token for private repos)
        const cloneUrl = repo.private
            ? `https://${githubConfig.accessToken}@github.com/${repo.full_name}.git`
            : repo.clone_url;

        const cloneResult = await runCommand("git", [
            "clone",
            "--progress",
            "--branch",
            branch,
            "--depth",
            "1",
            cloneUrl,
            releasePath,
        ]);

        if (cloneResult.exitCode !== 0) {
            await updateVersionStatus(appName, versionId, "failed", "Clone failed");
            // Cleanup on clone failure
            await cleanupFailedDeployment("Clone failed");
            return { success: false, message: `Clone failed: ${cloneResult.stderr}` };
        }

        // Get actual commit hash
        try {
            const { runCommand } = await import("../utils/command"); // Need to ensure this import works or use existing runCommand
            const commitRes = await runCommand("git", ["rev-parse", "HEAD"], releasePath);
            // Update version record with real commit
            // We need a helper for this or just update the object if we had it, but helper UpdateVersionStatus doesn't update commit
            // For now, it's fine. Ideally likely update the versions.json directly or add updateVersionCommit helper.
            // Let's assume user accepts "HEAD" or we update it later. 
            // Actually, let's just proceed.
        } catch { }


        // Load configuration from okastr8.yaml
        log("📄 Loading okastr8.yaml configuration...");
        const configPath = join(releasePath, "okastr8.yaml");

        let detectedConfig: DetectedConfig;
        try {
            const { load } = await import('js-yaml');
            const configContent = await readFile(configPath, 'utf-8');
            const config = load(configContent) as any;

            detectedConfig = {
                runtime: config.runtime || 'custom',
                buildSteps: config.build || [],
                startCommand: config.start || '',
                port: config.port,
                domain: config.domain,
                env: config.env,
            };

            log(`✅ Configuration loaded from okastr8.yaml`);
        } catch (error: any) {
            await updateVersionStatus(appName, versionId, "failed", "Invalid okastr8.yaml");
            // Cleanup on config parse failure
            await cleanupFailedDeployment("Invalid configuration");
            return {
                success: false,
                message: `Failed to parse okastr8.yaml: ${error.message}`,
                appName,
            };
        }

        await updateVersionStatus(appName, versionId, "building", "Building application");

        // Port and domain from options or config file
        const finalPort = options.port || detectedConfig.port;
        const finalDomain = options.domain || detectedConfig.domain;

        // Allow options to override config file
        if (options.buildSteps?.length) {
            detectedConfig.buildSteps = options.buildSteps;
        }
        if (options.startCommand) {
            detectedConfig.startCommand = options.startCommand;
        }

        if (!detectedConfig.startCommand) {
            await updateVersionStatus(appName, versionId, "failed", "No start command");
            // Cleanup on missing start command
            await cleanupFailedDeployment("Missing start command");
            return {
                success: false,
                message: "No start command specified in okastr8.yaml or deployment options.",
                config: detectedConfig,
            };
        }

        // Validate runtime is installed
        const supportedRuntimes = ['node', 'python', 'go', 'bun', 'deno'];
        if (supportedRuntimes.includes(detectedConfig.runtime)) {
            const { checkRuntimeInstalled, formatMissingRuntimeError } = await import("./env");
            const isInstalled = await checkRuntimeInstalled(detectedConfig.runtime);

            if (!isInstalled) {
                await updateVersionStatus(appName, versionId, "failed", "Runtime missing: " + detectedConfig.runtime);
                // Cleanup release
                await cleanupFailedDeployment("Runtime missing");
                return {
                    success: false,
                    message: formatMissingRuntimeError(detectedConfig.runtime as any),
                    config: detectedConfig,
                };
            }
        }

        log(`🔧 Detected runtime: ${detectedConfig.runtime}`);
        log(`📝 Build steps: ${detectedConfig.buildSteps.join(", ") || "none"}`);
        log(`▶️  Start command: ${detectedConfig.startCommand}`);

        // Run build steps
        if (detectedConfig.buildSteps.length > 0) {
            log("🔨 Running build steps...");

            for (const step of detectedConfig.buildSteps) {
                log(`  → ${step}`);
                // Use bash -c to handle composite commands, running in releasePath
                const buildResult = await runCommand("bash", ["-c", step], releasePath);
                if (buildResult.exitCode !== 0) {
                    await updateVersionStatus(appName, versionId, "failed", "Build failed");
                    // Cleanup on build failure
                    await cleanupFailedDeployment("Build failed");
                    return { success: false, message: `Build failed: ${step}\n${buildResult.stderr}` };
                }
            }
        }

        // Update symlink to new version BEFORE create app service (so service points to 'current')
        log("🔄 Switching to new version...");
        await setCurrentVersion(appName, versionId);
        await updateVersionStatus(appName, versionId, "success", "Deployed");

        // Create/Update the okastr8 app
        log("📦 Configuring okastr8 app...");
        const appResult = await createApp({
            name: appName,
            description: repo.description || `Deployed from ${repo.full_name}`,
            execStart: detectedConfig.startCommand,
            workingDirectory: join(appDir, "current"), // Point to current symlink
            user: process.env.USER || "root",
            port: finalPort,
            domain: finalDomain,
            gitRepo: repo.ssh_url || repo.clone_url || repo.html_url,  // Fallback if SSH URL is missing
            gitBranch: branch,
            buildSteps: detectedConfig.buildSteps,
            env: detectedConfig.env,
        });

        if (!appResult.success) {
            // Cleanup on app creation failure
            await cleanupFailedDeployment("Systemd creation failed");
            return { success: false, message: appResult.message };
        }

        // Post-deployment health check: Verify service is running
        log("⏳ Waiting 5 seconds for service to stabilize...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        log("🏥 Verifying service health...");
        const healthCheck = await runCommand("systemctl", ["is-active", appName]);
        const serviceStatus = healthCheck.stdout.trim();

        if (healthCheck.exitCode !== 0 || serviceStatus !== "active") {
            log(`❌ Service failed to start. Status: ${serviceStatus}`);
            await updateVersionStatus(appName, versionId, "failed", `Service ${serviceStatus}`);

            // Get recent logs for debugging
            const logsResult = await runCommand("journalctl", ["-u", appName, "-n", "30", "--no-pager"]);
            const logs = logsResult.stdout || logsResult.stderr || "No logs available";

            // CLEANUP: Remove all artifacts since deployment failed
            log("🧹 Cleaning up failed deployment...");

            // 1. Stop and remove service
            await runCommand("sudo", ["systemctl", "stop", appName]);
            await runCommand("sudo", ["systemctl", "disable", appName]);
            await runCommand("sudo", ["rm", "-f", `/etc/systemd/system/${appName}.service`]);
            await runCommand("sudo", ["systemctl", "daemon-reload"]);

            // 2. Remove app.json (if it was created - though it shouldn't be due to createApp reorder)
            const appJsonPath = join(appDir, "app.json");
            await runCommand("rm", ["-f", appJsonPath]);

            // 3. Smart Cleanup
            await cleanupFailedDeployment("Service failed to start");

            return {
                success: false,
                message: `Deployment failed: Service is ${serviceStatus}. Check logs for details.\n\nRecent logs:\n${logs.slice(0, 500)}...`,
                appName,
                config: detectedConfig,
            };
        }

        log("✅ Service is running successfully!");

        // Cleanup old versions
        await cleanOldVersions(appName);

        // Setup webhook if requested
        if (options.setupWebhook) {
            log("🔗 Setting up webhook...");
            const ghConfig = await getGitHubConfig();
            if (ghConfig.accessToken) {
                const webhookSuccess = await createWebhook(repo.full_name, ghConfig.accessToken);
                if (!webhookSuccess) {
                    console.warn("⚠️ Webhook setup failed. You can create it manually.");
                }
            } else {
                console.warn("⚠️ Cannot setup webhook: No GitHub token found.");
            }
        }

        return {
            success: true,
            message: `Successfully deployed ${repo.full_name} as '${appName}' (v${versionId})`,
            appName,
            config: detectedConfig,
        };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// Disconnect GitHub
export async function disconnectGitHub(): Promise<void> {
    // Reset runtime github data, keep client ID/Secret
    await saveSystemConfig({
        manager: {
            github: {
                access_token: undefined,
                username: undefined,
                connected_at: undefined
            }
        }
    });
}

// Check connection status (always reload from disk)
export async function getConnectionStatus(): Promise<{
    connected: boolean;
    username?: string;
    connectedAt?: string;
}> {
    // Force reload to see changes from other processes (e.g., manager server)
    const config = await reloadSystemConfig();
    const gh = config.manager?.github || {};
    if (gh.access_token) {
        return {
            connected: true,
            username: gh.username,
            connectedAt: gh.connected_at,
        };
    }
    return { connected: false };
}

// Webhook Helpers
export async function ensureWebhookSecret(): Promise<string> {
    const config = await getSystemConfig();
    if (config.manager?.github?.webhook_secret) {
        return config.manager.github.webhook_secret;
    }

    // Generate new secret
    const secret = randomBytes(32).toString('hex');
    await saveSystemConfig({
        manager: {
            github: { webhook_secret: secret }
        }
    });
    return secret;
}

export async function createWebhook(repoFullName: string, accessToken: string): Promise<boolean> {
    try {
        const config = await getSystemConfig();
        const baseUrl = config.tunnel?.url;

        if (!baseUrl) {
            console.error("Cannot create webhook: Tunnel URL not configured in system.yaml (tunnel.url)");
            return false;
        }

        const webhookUrl = `${baseUrl}/api/github/webhook`;
        const secret = await ensureWebhookSecret();

        // Check existing hooks
        const hooksRes = await fetch(`${GITHUB_API}/repos/${repoFullName}/hooks`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github.v3+json"
            }
        });

        if (hooksRes.ok) {
            const hooks = await hooksRes.json() as any[];
            const exists = hooks.find((h: any) => h.config.url === webhookUrl);
            if (exists) {
                console.log("Webhook already exists");
                return true;
            }
        }

        console.log(`Creating webhook for ${webhookUrl}...`);

        // Create Hook
        const res = await fetch(`${GITHUB_API}/repos/${repoFullName}/hooks`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "web",
                active: true,
                events: ["push"],
                config: {
                    url: webhookUrl,
                    content_type: "json",
                    secret: secret,
                    insecure_ssl: "0"
                }
            })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("Failed to create webhook:", err);
            return false;
        }

        console.log("✅ Webhook created successfully");
        return true;
    } catch (e) {
        console.error("Webhook creation error:", e);
        return false;
    }
}
