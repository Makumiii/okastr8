import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { readFile, writeFile, mkdir } from "fs/promises";
import { runCommand } from "../utils/command";
import { randomBytes } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

const OKASTR8_HOME = join(homedir(), ".okastr8");
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
// Config helpers
// Note: We now use the Unified Config Manager
import { getSystemConfig, saveSystemConfig } from "../config";

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
    const scopes = ["repo", "read:user", "admin:repo_hook"];
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

export async function detectProjectConfig(repoPath: string): Promise<DetectedConfig> {
    const defaultConfig: DetectedConfig = {
        buildSteps: [],
        startCommand: "",
        runtime: "unknown",
    };

    try {
        // 1. Check for yaml/json configs
        const configFiles = ["okastr8.yaml", "okastr8.yml", "okastr8.json", "app.yaml", "app.json"];
        for (const file of configFiles) {
            try {
                const configPath = join(repoPath, file);
                const content = await readFile(configPath, "utf-8");

                let config: any;
                if (file.endsWith('.yaml') || file.endsWith('.yml')) {
                    // Dynamic import needed if context requires, or just use import at top level
                    // Since we're in Bun, we can rely on our existing ConfigManager logic or just import
                    const { load } = await import('js-yaml');
                    config = load(content);
                } else {
                    config = JSON.parse(content);
                }

                // Validate minimal config
                if (config && (config.build || config.start)) {
                    return {
                        buildSteps: Array.isArray(config.build) ? config.build : (config.build ? [config.build] : []),
                        startCommand: config.start || "",
                        runtime: "config-file",
                        port: config.port,
                        domain: config.domain,
                        env: config.env
                    };
                }
            } catch {
                // Continue if file not found or invalid
            }
        }

        // 2. Check for package.json (Node/Bun)
        try {
            const pkgJson = JSON.parse(
                await readFile(join(repoPath, "package.json"), "utf-8")
            );

            // Check for bun.lockb
            let isBun = false;
            try {
                await readFile(join(repoPath, "bun.lockb"));
                isBun = true;
            } catch { }

            const pm = isBun ? "bun" : "npm";
            const buildSteps: string[] = [`${pm} install`];

            if (pkgJson.scripts?.build) {
                buildSteps.push(`${pm} run build`);
            }

            let startCommand = "";
            if (pkgJson.scripts?.start) {
                startCommand = `${pm} run start`;
            } else if (pkgJson.scripts?.dev) {
                startCommand = `${pm} run dev`;
            } else if (pkgJson.main) {
                startCommand = isBun ? `bun run ${pkgJson.main}` : `node ${pkgJson.main}`;
            }

            return {
                buildSteps,
                startCommand,
                runtime: isBun ? "bun" : "node",
            };
        } catch { }

        // Check for Cargo.toml (Rust)
        try {
            await readFile(join(repoPath, "Cargo.toml"));
            return {
                buildSteps: ["cargo build --release"],
                startCommand: "./target/release/$(basename $(pwd))",
                runtime: "rust",
            };
        } catch { }

        // Check for go.mod (Go)
        try {
            await readFile(join(repoPath, "go.mod"));
            return {
                buildSteps: ["go build -o app ."],
                startCommand: "./app",
                runtime: "go",
            };
        } catch { }

        // Check for requirements.txt (Python)
        try {
            await readFile(join(repoPath, "requirements.txt"));
            return {
                buildSteps: ["pip install -r requirements.txt"],
                startCommand: "python app.py",
                runtime: "python",
            };
        } catch { }

        // Check for Dockerfile
        try {
            await readFile(join(repoPath, "Dockerfile"));
            return {
                buildSteps: ["docker build -t $(basename $(pwd)) ."],
                startCommand: "docker run -d $(basename $(pwd))",
                runtime: "docker",
            };
        } catch { }

        return defaultConfig;
    } catch {
        return defaultConfig;
    }
}

// Import repo and create okastr8 app
export async function importRepo(options: ImportOptions): Promise<{
    success: boolean;
    message: string;
    appName?: string;
    config?: DetectedConfig;
}> {
    const { createApp } = await import("./app");
    const githubConfig = await getGitHubConfig();

    if (!githubConfig.accessToken) {
        return { success: false, message: "GitHub not connected" };
    }

    try {
        // Get repo info
        const repo = await getRepo(githubConfig.accessToken, options.repoFullName);
        const appName = options.appName || repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const branch = options.branch || repo.default_branch;

        // Create app directory
        const appDir = join(APPS_DIR, appName);
        const repoDir = join(appDir, "repo");
        await mkdir(appDir, { recursive: true });

        console.log(`📦 Cloning ${repo.full_name}...`);

        // Clone the repo (use HTTPS with token for private repos)
        const cloneUrl = repo.private
            ? `https://${githubConfig.accessToken}@github.com/${repo.full_name}.git`
            : repo.clone_url;

        const cloneResult = await runCommand("git", [
            "clone",
            "--branch",
            branch,
            "--depth",
            "1",
            cloneUrl,
            repoDir,
        ]);

        if (cloneResult.exitCode !== 0) {
            return { success: false, message: `Clone failed: ${cloneResult.stderr}` };
        }

        // Detect or use provided config
        let detectedConfig: DetectedConfig;
        if (options.autoDetect !== false) {
            console.log("🔍 Detecting project configuration...");
            detectedConfig = await detectProjectConfig(repoDir);
        } else {
            detectedConfig = {
                buildSteps: options.buildSteps || [],
                startCommand: options.startCommand || "",
                runtime: "custom",
            };
        }

        // Use detected settings if not provided
        const finalPort = options.port || detectedConfig.port;
        const finalDomain = options.domain || detectedConfig.domain;

        // Override with explicit options
        if (options.buildSteps?.length) {
            detectedConfig.buildSteps = options.buildSteps;
        }
        if (options.startCommand) {
            detectedConfig.startCommand = options.startCommand;
        }

        if (!detectedConfig.startCommand) {
            return {
                success: false,
                message: "Could not detect start command. Please provide one.",
                config: detectedConfig,
            };
        }

        console.log(`🔧 Detected runtime: ${detectedConfig.runtime}`);
        console.log(`📝 Build steps: ${detectedConfig.buildSteps.join(", ") || "none"}`);
        console.log(`▶️  Start command: ${detectedConfig.startCommand}`);

        // Run build steps
        if (detectedConfig.buildSteps.length > 0) {
            console.log("🔨 Running build steps...");

            for (const step of detectedConfig.buildSteps) {
                console.log(`  → ${step}`);
                // Use bash -c to handle composite commands, running in repoDir
                const buildResult = await runCommand("bash", ["-c", step], repoDir);
                if (buildResult.exitCode !== 0) {
                    return { success: false, message: `Build failed: ${step}\n${buildResult.stderr}` };
                }
            }
        }

        // Create the okastr8 app
        console.log("📦 Creating okastr8 app...");
        const appResult = await createApp({
            name: appName,
            description: repo.description || `Deployed from ${repo.full_name}`,
            execStart: detectedConfig.startCommand,
            workingDirectory: repoDir,
            user: process.env.USER || "root",
            port: finalPort,
            domain: finalDomain,
            gitRepo: repo.clone_url,
            gitBranch: branch,
            buildSteps: detectedConfig.buildSteps,
            env: detectedConfig.env, // Pass environment variables
        });

        if (!appResult.success) {
            return { success: false, message: appResult.message };
        }

        // Setup webhook if requested
        // Setup webhook if requested
        // Setup webhook if requested
        if (options.setupWebhook) {
            console.log("🔗 Setting up webhook...");
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
            message: `Successfully deployed ${repo.full_name} as '${appName}'`,
            appName,
            config: detectedConfig,
        };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// Disconnect GitHub
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

// Check connection status
export async function getConnectionStatus(): Promise<{
    connected: boolean;
    username?: string;
    connectedAt?: string;
}> {
    const github = await getGitHubConfig();
    if (github.accessToken) {
        return {
            connected: true,
            username: github.username,
            connectedAt: github.connectedAt,
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
