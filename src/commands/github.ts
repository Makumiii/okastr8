import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { runCommand } from "../utils/command";
import { randomBytes } from "crypto";
import { randomUUID } from "crypto";

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
    env?: Record<string, string>;
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
    // Check for okastr8.yaml or okastr8.yml
    const files = ["okastr8.yaml", "okastr8.yml"];

    for (const file of files) {
        const exists = await checkFileExists(accessToken, fullName, file, ref);
        if (exists) return true;
    }
    return false;
}

async function getRepoFileContent(
    accessToken: string,
    fullName: string,
    filePath: string,
    ref: string
): Promise<string | null> {
    try {
        const response = await fetch(
            `${GITHUB_API}/repos/${fullName}/contents/${filePath}?ref=${ref}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/vnd.github.v3+json",
                },
            }
        );

        if (!response.ok) return null;

        const data = await response.json() as any;
        if (!data?.content) return null;

        return Buffer.from(data.content, "base64").toString("utf-8");
    } catch {
        return null;
    }
}

async function detectRuntimeFromRepo(
    accessToken: string,
    fullName: string,
    ref: string
): Promise<string | null> {
    const checks: Array<[string, string[]]> = [
        ["node", ["package.json", "package-lock.json"]],
        ["python", ["requirements.txt", "Pipfile", "setup.py", "pyproject.toml"]],
        ["go", ["go.mod"]],
        ["rust", ["Cargo.toml"]],
        ["ruby", ["Gemfile"]],
        ["bun", ["bun.lockb"]],
        ["deno", ["deno.json", "deno.jsonc"]],
    ];

    for (const [runtime, files] of checks) {
        for (const file of files) {
            // eslint-disable-next-line no-await-in-loop
            const exists = await checkFileExists(accessToken, fullName, file, ref);
            if (exists) return runtime;
        }
    }

    return null;
}

export async function inspectRepoConfig(
    accessToken: string,
    fullName: string,
    ref: string
): Promise<{
    hasConfig: boolean;
    config: DetectedConfig;
    detectedRuntime?: string;
    hasUserDocker: boolean;
    hasUserCompose: boolean;
}> {
    const configFiles = ["okastr8.yaml", "okastr8.yml"];
    let configContent: string | null = null;
    let hasConfig = false;

    for (const file of configFiles) {
        // eslint-disable-next-line no-await-in-loop
        const content = await getRepoFileContent(accessToken, fullName, file, ref);
        if (content) {
            configContent = content;
            hasConfig = true;
            break;
        }
    }

    const hasDockerfile = await checkFileExists(accessToken, fullName, "Dockerfile", ref);
    const hasCompose = await checkFileExists(accessToken, fullName, "docker-compose.yml", ref);

    let detectedRuntime: string | undefined;

    let config: DetectedConfig = {
        runtime: "node",
        buildSteps: [],
        startCommand: "",
        port: 3000,
        env: {},
    };

    if (configContent) {
        try {
            const { load } = await import("js-yaml");
            const parsed = load(configContent) as any;
            config = {
                runtime: parsed.runtime || "custom",
                buildSteps: parsed.build || [],
                startCommand: parsed.start || "",
                port: parsed.port || 3000,
                domain: parsed.domain,
                database: parsed.database,
                cache: parsed.cache,
                env: {},
            };
        } catch {
            // keep defaults if parse fails
        }
    } else {
        const runtime = await detectRuntimeFromRepo(accessToken, fullName, ref);
        if (runtime) {
            detectedRuntime = runtime;
            config.runtime = runtime;
        }

        if (runtime === "node") {
            const pkgContent = await getRepoFileContent(accessToken, fullName, "package.json", ref);
            if (pkgContent) {
                try {
                    const pkg = JSON.parse(pkgContent);
                    config.buildSteps = pkg.scripts?.build
                        ? ["npm install", "npm run build"]
                        : ["npm install"];
                    config.startCommand = pkg.scripts?.start ? "npm run start" : "node index.js";
                } catch {
                    // ignore parse errors
                }
            }
        }
    }

    if (!config.runtime || config.runtime === "custom") {
        const runtime = await detectRuntimeFromRepo(accessToken, fullName, ref);
        if (runtime) {
            detectedRuntime = runtime;
            config.runtime = runtime;
        }
    }

    return {
        hasConfig,
        config,
        detectedRuntime,
        hasUserDocker: hasDockerfile || hasCompose,
        hasUserCompose: hasCompose,
    };
}


// Auto-detection for build configs
export interface DetectedConfig {
    buildSteps: string[];
    startCommand: string;
    runtime: string;
    port?: number;
    domain?: string;
    database?: string;
    cache?: string;
    env?: Record<string, string>;
}



// Prepare repository for deployment (Clone & Detect Config)
export async function prepareRepoImport(
    options: ImportOptions,
    deploymentId?: string
): Promise<{
    success: boolean;
    message: string;
    appName?: string;
    versionId?: number;
    config?: DetectedConfig;
    detectedRuntime?: string;
    hasUserDocker?: boolean;
}> {
    const { createApp } = await import("./app");
    const { createVersion, initializeVersioning, updateVersionStatus, removeVersion } = await import("./version");
    const githubConfig = await getGitHubConfig();

    // Helper to log
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
        const repo = await getRepo(githubConfig.accessToken, options.repoFullName);
        const appName = options.appName || repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const branch = options.branch || repo.default_branch;

        // Initialize directories
        const appDir = join(APPS_DIR, appName);
        await mkdir(appDir, { recursive: true });

        // Ensure versioning is initialized
        await initializeVersioning(appName);

        // Save app metadata if new
        const appMetaPath = join(appDir, "app.json");
        if (!existsSync(appMetaPath)) {
            await writeFile(appMetaPath, JSON.stringify({
                name: appName,
                repo: repo.full_name,
                branch: branch,
                created_at: new Date().toISOString()
            }, null, 2));
        }

        log(`Preparing deployment for ${repo.full_name} (${branch})...`);

        // Create new version entry
        const { versionId, releasePath } = await createVersion(appName, "HEAD", branch);

        // CLEANUP on failure
        const cleanupFailedPrepare = async (reason: string) => {
            log(`🧹 Cleaning up prepare: ${reason}`);
            try { await removeVersion(appName, versionId); } catch { }
            try { await rm(releasePath, { recursive: true, force: true }); } catch { }
        };

        await updateVersionStatus(appName, versionId, "pending", "Cloning repository");
        log(`⬇️ Cloning into release v${versionId}...`);

        const cloneUrl = repo.private
            ? `https://${githubConfig.accessToken}@github.com/${repo.full_name}.git`
            : repo.clone_url;

        const cloneResult = await runCommand("git", [
            "clone", "--progress", "--branch", branch, "--depth", "1", cloneUrl, releasePath
        ]);

        if (cloneResult.exitCode !== 0) {
            await updateVersionStatus(appName, versionId, "failed", "Clone failed");
            await cleanupFailedPrepare("Clone failed");
            return { success: false, message: `Clone failed: ${cloneResult.stderr}` };
        }

        // Detect Config
        log("Detecting configuration...");
        const configPathCandidates = [
            join(releasePath, "okastr8.yaml"),
            join(releasePath, "okastr8.yml"),
        ];
        const configPath = configPathCandidates.find((path) => existsSync(path));
        let detectedConfig: DetectedConfig = {
            runtime: 'node', // Default
            buildSteps: [],
            startCommand: '',
            port: 3000,
            env: {}
        };
        let detectedRuntime: string | undefined;

        if (configPath) {
            log(`✅ ${configPath.endsWith(".yml") ? "okastr8.yml" : "okastr8.yaml"} found`);
            try {
                const { load } = await import('js-yaml');
                const configContent = await readFile(configPath, 'utf-8');
                const config = load(configContent) as any;
                detectedConfig = {
                    runtime: config.runtime || 'custom',
                    buildSteps: config.build || [],
                    startCommand: config.start || '',
                    port: config.port || 3000,
                    domain: config.domain,
                    database: config.database,
                    cache: config.cache,
                    env: {},
                };
            } catch (e: any) {
                log(`⚠️ Failed to parse okastr8.yaml: ${e.message}`);
            }
        } else {
            log("ℹ️ No okastr8.yaml found - attempting auto-detection");
            try {
                const { detectRuntime } = await import("../utils/runtime-detector");
                const runtime = await detectRuntime(releasePath);
                detectedRuntime = runtime;
                detectedConfig.runtime = runtime;
                log(`   Detected runtime: ${runtime}`);

                // Basic heuristic defaults based on runtime
                if (runtime === 'node') {
                    const pkgJsonPath = join(releasePath, 'package.json');
                    if (existsSync(pkgJsonPath)) {
                        const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
                        detectedConfig.buildSteps = pkg.scripts?.build ? ['npm install', 'npm run build'] : ['npm install'];
                        detectedConfig.startCommand = pkg.scripts?.start ? 'npm run start' : 'node index.js';
                    }
                }
            } catch (e) {
                log("   Auto-detection failed, using defaults");
            }
        }

        // Merge with options if provided (e.g. from previous context)
        if (options.env) detectedConfig.env = { ...detectedConfig.env, ...options.env };

        const hasDockerfile = existsSync(join(releasePath, "Dockerfile"));
        const hasCompose = existsSync(join(releasePath, "docker-compose.yml"));
        const hasUserDocker = hasDockerfile || hasCompose;

        await updateVersionStatus(appName, versionId, "pending", "Waiting for configuration");

        return {
            success: true,
            message: "Repository prepared",
            appName,
            versionId,
            config: detectedConfig,
            detectedRuntime,
            hasUserDocker
        };

    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// Finalize deployment (Save Config & Build/Deploy)
export async function finalizeRepoImport(
    appName: string,
    versionId: number,
    config: DetectedConfig,
    deploymentId?: string
): Promise<{ success: boolean; message: string }> {
    const { updateVersionStatus, removeVersion, getVersions, setCurrentVersion, cleanOldVersions } = await import("./version");
    const { logActivity } = await import("../utils/activity");

    // Helper log
    const log = (message: string) => {
        if (deploymentId) {
            const { streamLog } = require('../utils/deploymentLogger');
            streamLog(deploymentId, message);
        } else {
            console.log(message);
        }
    };

    // Cancellation check helper
    const checkCancelled = async (cleanup?: () => Promise<void>) => {
        if (deploymentId) {
            const { isDeploymentCancelled } = require('../utils/deploymentLogger');
            if (isDeploymentCancelled(deploymentId)) {
                if (cleanup) await cleanup();
                throw new Error('DEPLOYMENT_CANCELLED');
            }
        }
    };

    const appDir = join(APPS_DIR, appName);
    const appMetaPath = join(appDir, "app.json");
    const releasePath = join(appDir, "releases", `v${versionId}`);
    const activityId = deploymentId ?? randomUUID();
    const startTime = Date.now();

    let branch: string | undefined;
    try {
        if (existsSync(appMetaPath)) {
            const meta = JSON.parse(await readFile(appMetaPath, "utf-8"));
            branch = meta.gitBranch || meta.branch;
        }
    } catch { }

    await logActivity("deploy", {
        id: activityId,
        status: "started",
        appName,
        branch,
        versionId,
        source: "github"
    });

    // CLEANUP HELPER
    const cleanupFailedDeployment = async (reason: string) => {
        log(`🧹 Cleaning up: ${reason}`);
        try {
            const { stopContainer, removeContainer, composeDown } = await import("./docker");
            await stopContainer(appName).catch(() => { });
            await removeContainer(appName).catch(() => { });

            // Check for compose files to clean up
            const composeFiles = [
                join(releasePath, "docker-compose.yml"),
                join(releasePath, "docker-compose.generated.yml")
            ];
            for (const f of composeFiles) {
                if (existsSync(f)) {
                    await composeDown(f, appName).catch(() => { });
                    break;
                }
            }
            // Also try to stop by project name label
            const { getProjectContainers } = await import("./docker");
            const projectContainers = await getProjectContainers(appName);
            if (projectContainers.length > 0) {
                for (const container of projectContainers) {
                    await stopContainer(container.name).catch(() => { });
                    await removeContainer(container.name).catch(() => { });
                }
            }
        } catch { }
        try { await rm(releasePath, { recursive: true, force: true }); } catch { }
        try { await removeVersion(appName, versionId); } catch { }

        // Remove app dir if empty
        try {
            const data = await getVersions(appName);
            if (data.versions.length === 0 && !data.current) {
                await rm(appDir, { recursive: true, force: true });
            }
        } catch { }
    };

    try {
        log(`Finalizing deployment for ${appName} (v${versionId})...`);

        // 1. Persist Config to okastr8.yaml in release path
        try {
            const { dump } = await import('js-yaml');
            const yamlContent = dump({
                runtime: config.runtime,
                build: config.buildSteps,
                start: config.startCommand,
                port: config.port,
                domain: config.domain,
                database: config.database,
                cache: config.cache,
            });
            await writeFile(join(releasePath, "okastr8.yaml"), yamlContent);
            log("✅ Configuration saved to release");
        } catch (e: any) {
            await logActivity("deploy", {
                id: activityId,
                status: "failed",
                appName,
                branch,
                versionId,
                error: e.message,
                duration: (Date.now() - startTime) / 1000,
                source: "github"
            });
            await cleanupFailedDeployment("Failed to save config");
            return { success: false, message: `Config save failed: ${e.message}` };
        }

        await updateVersionStatus(appName, versionId, "building", "Building application");

        // 2. Validate Runtime
        const supportedRuntimes = ['node', 'python', 'go', 'bun', 'deno'];
        if (supportedRuntimes.includes(config.runtime)) {
            const { checkRuntimeInstalled, formatMissingRuntimeError } = await import("./env");
            const isInstalled = await checkRuntimeInstalled(config.runtime);
            if (!isInstalled) {
                await logActivity("deploy", {
                    id: activityId,
                    status: "failed",
                    appName,
                    branch,
                    versionId,
                    error: `Runtime missing: ${config.runtime}`,
                    duration: (Date.now() - startTime) / 1000,
                    source: "github"
                });
                await cleanupFailedDeployment("Runtime missing");
                return { success: false, message: formatMissingRuntimeError(config.runtime as any) };
            }
        }

        log(`Detected runtime: ${config.runtime}`);
        log(`Build steps: ${config.buildSteps.join(", ") || "none"}`);
        log(`▶️  Start command: ${config.startCommand}`);

        await checkCancelled(() => cleanupFailedDeployment('Deployment cancelled'));

        // 3. Build
        if (config.buildSteps.length > 0) {
            log("Running build steps...");
            for (const step of config.buildSteps) {
                await checkCancelled(() => cleanupFailedDeployment('Deployment cancelled'));
                log(`  → ${step}`);
                const buildResult = await runCommand("bash", ["-c", step], releasePath);
                if (buildResult.exitCode !== 0) {
                    await updateVersionStatus(appName, versionId, "failed", "Build failed");
                    await logActivity("deploy", {
                        id: activityId,
                        status: "failed",
                        appName,
                        branch,
                        versionId,
                        error: buildResult.stderr || "Build failed",
                        duration: (Date.now() - startTime) / 1000,
                        source: "github"
                    });
                    await cleanupFailedDeployment("Build failed");
                    return { success: false, message: `Build failed: ${buildResult.stderr}` };
                }
            }
        }

        await updateVersionStatus(appName, versionId, "deploying", "Starting container");

        // 4. Deploy
        await checkCancelled(() => cleanupFailedDeployment('Deployment cancelled'));

        const { deployFromPath } = await import("./deploy-core");

        const deployResult = await deployFromPath({
            appName,
            releasePath,
            versionId,
            env: config.env,
            onProgress: log
        });

        if (!deployResult.success) {
            await updateVersionStatus(appName, versionId, "failed", deployResult.message);
            await logActivity("deploy", {
                id: activityId,
                status: "failed",
                appName,
                branch,
                versionId,
                error: deployResult.message,
                duration: (Date.now() - startTime) / 1000,
                source: "github"
            });
            await cleanupFailedDeployment(deployResult.message);
            return { success: false, message: deployResult.message };
        }

        await updateVersionStatus(appName, versionId, "active", "Running");

        // 5. Update Symlink
        log("Switching to new version...");
        await setCurrentVersion(appName, versionId);

        // 6. Cleanup old versions
        await cleanOldVersions(appName);

        // 7. Setup Webhook (skipped for now for brevity, or can be added back if needed)

        await logActivity("deploy", {
            id: activityId,
            status: "success",
            appName,
            branch,
            versionId,
            duration: (Date.now() - startTime) / 1000,
            source: "github"
        });

        return { success: true, message: `Successfully deployed ${appName}` };

    } catch (error: any) {
        if (error.message === 'DEPLOYMENT_CANCELLED') {
            await logActivity("deploy", {
                id: activityId,
                status: "failed",
                appName,
                branch,
                versionId,
                error: "Deployment cancelled",
                duration: (Date.now() - startTime) / 1000,
                source: "github"
            });
            return { success: false, message: 'Deployment was cancelled by user' };
        }
        await logActivity("deploy", {
            id: activityId,
            status: "failed",
            appName,
            branch,
            versionId,
            error: error.message,
            duration: (Date.now() - startTime) / 1000,
            source: "github"
        });
        await cleanupFailedDeployment(`Unexpected error: ${error.message}`);
        return { success: false, message: error.message };
    }
}

// Wrapper for backward compatibility (CLI/Legacy)
export async function importRepo(
    options: ImportOptions,
    deploymentId?: string
): Promise<{
    success: boolean;
    message: string;
    appName?: string;
    config?: DetectedConfig;
}> {
    // 1. Prepare
    const prep = await prepareRepoImport(options, deploymentId);
    if (!prep.success || !prep.config || !prep.appName || !prep.versionId) {
        return { success: false, message: prep.message, appName: prep.appName };
    }

    // 2. Finalize immediately (using detected config)
    const result = await finalizeRepoImport(prep.appName, prep.versionId, prep.config, deploymentId);
    return {
        ...result,
        appName: prep.appName,
        config: prep.config
    };
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
