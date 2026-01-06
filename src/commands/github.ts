import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { readFile, writeFile, mkdir } from "fs/promises";
import { runCommand } from "../utils/command";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

const OKASTR8_HOME = join(homedir(), ".okastr8");
const CONFIG_FILE = join(OKASTR8_HOME, "config.json");
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
async function getConfig(): Promise<any> {
    try {
        const content = await readFile(CONFIG_FILE, "utf-8");
        return JSON.parse(content);
    } catch {
        return {};
    }
}

async function saveConfig(config: any): Promise<void> {
    await mkdir(OKASTR8_HOME, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
    const config = await getConfig();
    return config.github || {};
}

export async function saveGitHubConfig(github: GitHubConfig): Promise<void> {
    const config = await getConfig();
    config.github = { ...config.github, ...github };
    await saveConfig(config);
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

// Auto-detection for build configs
export interface DetectedConfig {
    buildSteps: string[];
    startCommand: string;
    runtime: string;
    port?: number;
    env?: Record<string, string>;
}

export async function detectProjectConfig(repoPath: string): Promise<DetectedConfig> {
    const defaultConfig: DetectedConfig = {
        buildSteps: [],
        startCommand: "",
        runtime: "unknown",
    };

    try {
        // 1. Check for okastr8.json or app.json
        const configFiles = ["okastr8.json", "app.json"];
        for (const file of configFiles) {
            try {
                const configPath = join(repoPath, file);
                const content = await readFile(configPath, "utf-8");
                const config = JSON.parse(content);

                // Validate minimal config
                if (config.build || config.start) {
                    return {
                        buildSteps: Array.isArray(config.build) ? config.build : (config.build ? [config.build] : []),
                        startCommand: config.start || "",
                        runtime: "config-file",
                        port: config.port,
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

        // Use detected port if not provided
        const finalPort = options.port || detectedConfig.port;

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
            const originalDir = process.cwd();
            process.chdir(repoDir);

            for (const step of detectedConfig.buildSteps) {
                console.log(`  → ${step}`);
                const buildResult = await runCommand("bash", ["-c", step]);
                if (buildResult.exitCode !== 0) {
                    process.chdir(originalDir);
                    return { success: false, message: `Build failed: ${step}\n${buildResult.stderr}` };
                }
            }

            process.chdir(originalDir);
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
            domain: options.domain,
            gitRepo: repo.clone_url,
            gitBranch: branch,
            env: detectedConfig.env, // Pass environment variables
        });

        if (!appResult.success) {
            return { success: false, message: appResult.message };
        }

        // Setup webhook if requested
        if (options.setupWebhook) {
            console.log("🔗 Setting up webhook...");
            // Webhook setup will be implemented separately
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
export async function disconnectGitHub(): Promise<void> {
    const config = await getConfig();
    delete config.github?.accessToken;
    delete config.github?.username;
    delete config.github?.connectedAt;
    await saveConfig(config);
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
