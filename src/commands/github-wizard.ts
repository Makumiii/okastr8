import { existsSync } from "fs";
import { readFile } from "fs/promises";
import {
    finalizeRepoImport,
    getGitHubConfig,
    getRepo,
    listRepos,
    prepareRepoImport,
    type DetectedConfig,
} from "./github";
import { listRegistryCredentialSummaries } from "./registry";
import { randomBytes } from "crypto";
import { cancelDeployment, endDeploymentStream, startDeploymentStream } from "../utils/deploymentLogger";
import * as readline from "readline";

type EnquirerLike = {
    prompt: (question: any) => Promise<any>;
};

function parseBuildSteps(input: string): string[] {
    return input
        .split(",")
        .map((step) => step.trim())
        .filter(Boolean);
}

function parsePort(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function parseEnvContent(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const [k, ...v] = trimmed.split("=");
        if (k && v.length > 0) {
            env[k.trim()] = v.join("=").trim();
        }
    });
    return env;
}

async function parseEnvFile(filePath: string): Promise<Record<string, string>> {
    if (!existsSync(filePath)) {
        throw new Error(`Env file not found: ${filePath}`);
    }
    return parseEnvContent(await readFile(filePath, "utf-8"));
}

async function promptForEnv(enquirer: EnquirerLike, initialEnv: Record<string, string>) {
    const env = { ...initialEnv };
    const response = await enquirer.prompt({
        type: "select",
        name: "mode",
        message: "Environment variables:",
        choices: [
            "Keep current",
            "Import from .env file",
            "Manual entry (key=value)",
            "Clear all",
        ],
    });

    const mode = String(response.mode || "");
    if (mode === "Keep current") {
        return env;
    }

    if (mode === "Clear all") {
        return {};
    }

    if (mode === "Import from .env file") {
        const fileRes = await enquirer.prompt({
            type: "input",
            name: "path",
            message: "Path to .env file:",
            initial: ".env",
        });
        const imported = await parseEnvFile(String(fileRes.path || ".env"));
        return { ...env, ...imported };
    }

    console.log("Enter KEY=VALUE pairs. Empty input to finish.");
    while (true) {
        const pairRes = await enquirer.prompt({
            type: "input",
            name: "pair",
            message: "Variable:",
        });
        const pair = String(pairRes.pair || "").trim();
        if (!pair) break;
        const [key, ...valueParts] = pair.split("=");
        if (!key || valueParts.length === 0) {
            console.log("Invalid format. Use KEY=VALUE.");
            continue;
        }
        const normalizedKey = key.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizedKey)) {
            console.log(`Invalid env key: ${normalizedKey}`);
            continue;
        }
        env[normalizedKey] = valueParts.join("=").trim();
    }

    return env;
}

async function maybeConfigurePublishImage(
    enquirer: EnquirerLike,
    config: DetectedConfig,
    interactive: boolean
): Promise<void> {
    if (!interactive) return;

    const enableRes = await enquirer.prompt({
        type: "confirm",
        name: "enabled",
        message: "Publish built image to a registry after deploy?",
        initial: Boolean(config.publishImage?.enabled),
    });

    if (!enableRes.enabled) {
        config.publishImage = undefined;
        return;
    }

    const creds = await listRegistryCredentialSummaries();
    if (creds.length === 0) {
        throw new Error("No registry credentials found. Run `okastr8 registry add` first.");
    }

    const currentCred = config.publishImage?.registryCredentialId || creds[0]!.id;
    const imageRes = await enquirer.prompt({
        type: "input",
        name: "imageRef",
        message: "Target image ref (e.g., ghcr.io/org/app:tag):",
        initial: config.publishImage?.imageRef || "",
    });

    const credentialRes = await enquirer.prompt({
        type: "select",
        name: "credentialId",
        message: "Registry credential:",
        choices: creds.map((credential) => ({
            name: credential.id,
            message: `${credential.id} (${credential.provider} @ ${credential.server})`,
        })),
        initial: currentCred,
    });

    const imageRef = String(imageRes.imageRef || "").trim();
    const credentialId = String(credentialRes.credentialId || "").trim();
    if (!imageRef || !credentialId) {
        throw new Error("Publish image requires both image ref and registry credential.");
    }

    config.publishImage = {
        enabled: true,
        imageRef,
        registryCredentialId: credentialId,
    };
}

async function configureDeploymentConfig(
    enquirer: EnquirerLike,
    config: DetectedConfig,
    detectedRuntime: string | undefined,
    interactive: boolean
): Promise<DetectedConfig> {
    if (!interactive) return config;

    const defaults = {
        runtime: config.runtime || detectedRuntime || "node",
        buildSteps: (config.buildSteps || []).join(", "),
        startCommand: config.startCommand || "",
        port: String(config.port || 3000),
        domain: config.domain || "",
        routing: config.tunnel_routing ? "tunnel" : "caddy",
        database: config.database || "",
        cache: config.cache || "",
    };

    const answers = await enquirer.prompt([
        {
            type: "input",
            name: "runtime",
            message: "Runtime image:",
            initial: defaults.runtime,
        },
        {
            type: "input",
            name: "buildSteps",
            message: "Build steps (comma-separated, leave blank for none):",
            initial: defaults.buildSteps,
        },
        {
            type: "input",
            name: "startCommand",
            message: "Start command:",
            initial: defaults.startCommand,
        },
        {
            type: "input",
            name: "port",
            message: "Application port:",
            initial: defaults.port,
        },
        {
            type: "input",
            name: "domain",
            message: "Domain (optional):",
            initial: defaults.domain,
        },
        {
            type: "select",
            name: "routing",
            message: "Routing strategy:",
            choices: ["caddy", "tunnel"],
            initial: defaults.routing,
        },
        {
            type: "input",
            name: "database",
            message: "Database service (optional, e.g. postgres:15):",
            initial: defaults.database,
        },
        {
            type: "input",
            name: "cache",
            message: "Cache service (optional, e.g. redis:7):",
            initial: defaults.cache,
        },
    ]);

    config.runtime = String(answers.runtime || defaults.runtime).trim() || defaults.runtime;
    config.buildSteps = parseBuildSteps(String(answers.buildSteps || ""));
    config.startCommand = String(answers.startCommand || "").trim();
    config.port = parsePort(String(answers.port || defaults.port), config.port || 3000);
    config.domain = String(answers.domain || "").trim();
    config.tunnel_routing = String(answers.routing || defaults.routing) === "tunnel";
    config.database = String(answers.database || "").trim() || undefined;
    config.cache = String(answers.cache || "").trim() || undefined;

    return config;
}

async function chooseRepo(enquirer: EnquirerLike, accessToken: string, initialRepo?: string) {
    if (initialRepo) return initialRepo;

    const repos = await listRepos(accessToken);
    if (repos.length === 0) {
        throw new Error("No repositories found in this GitHub account.");
    }

    const repoRes = await enquirer.prompt({
        type: "autocomplete",
        name: "repo",
        message: "Select repository:",
        limit: 10,
        choices: repos.map((repo) => repo.full_name),
    });

    return String(repoRes.repo || "").trim();
}

export async function runGithubImportWizard(options: {
    repo?: string;
    branch?: string;
    env?: string[];
    envFile?: string;
    interactive?: boolean;
}) {
    const config = await getGitHubConfig();
    if (!config.accessToken) {
        throw new Error("Not connected to GitHub. Use web UI to connect first.");
    }

    const Enquirer = (await import("enquirer")).default;
    const enquirer: EnquirerLike = Enquirer;
    const interactive = options.interactive !== false;

    const repoFullName = await chooseRepo(enquirer, config.accessToken, options.repo);
    const repo = await getRepo(config.accessToken, repoFullName);

    let branch = options.branch || repo.default_branch;
    if (interactive) {
        const branchRes = await enquirer.prompt({
            type: "input",
            name: "branch",
            message: "Branch to deploy:",
            initial: branch,
        });
        branch = String(branchRes.branch || branch).trim() || branch;
    }

    let appName = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (interactive) {
        const appRes = await enquirer.prompt({
            type: "input",
            name: "appName",
            message: "App name:",
            initial: appName,
        });
        appName = String(appRes.appName || appName).trim() || appName;
    }

    const envFromFlags: Record<string, string> = {};
    for (const pair of options.env || []) {
        const [k, ...v] = pair.split("=");
        if (k && v.length > 0) envFromFlags[k.trim()] = v.join("=").trim();
    }
    const envFromFile = options.envFile ? await parseEnvFile(options.envFile) : {};
    let env = { ...envFromFile, ...envFromFlags };

    const prep = await prepareRepoImport({
        repoFullName,
        appName,
        branch,
    });

    if (!prep.success || !prep.config || !prep.appName || !prep.versionId) {
        throw new Error(prep.message || "Failed to prepare deployment");
    }

    const deployConfig: DetectedConfig = {
        ...prep.config,
        env: prep.config.env || {},
    };

    await configureDeploymentConfig(enquirer, deployConfig, prep.detectedRuntime, interactive);
    await maybeConfigurePublishImage(enquirer, deployConfig, interactive);
    env = await promptForEnv(enquirer, { ...deployConfig.env, ...env });
    deployConfig.env = env;

    if (interactive) {
        console.log("\nDeployment summary:");
        console.log(`  Repo: ${repoFullName}`);
        console.log(`  Branch: ${branch}`);
        console.log(`  App: ${prep.appName}`);
        console.log(`  Runtime: ${deployConfig.runtime}`);
        console.log(`  Port: ${deployConfig.port}`);
        console.log(`  Routing: ${deployConfig.tunnel_routing ? "tunnel" : "caddy"}`);
        console.log(`  Domain: ${deployConfig.domain || "-"}`);
        console.log(`  Database: ${deployConfig.database || "-"}`);
        console.log(`  Cache: ${deployConfig.cache || "-"}`);
        console.log(`  Publish image: ${deployConfig.publishImage?.enabled ? "yes" : "no"}`);
        console.log(`  Env vars: ${Object.keys(env).length}`);

        const confirm = await enquirer.prompt({
            type: "confirm",
            name: "ok",
            message: "Proceed with deployment?",
            initial: true,
        });

        if (!confirm.ok) {
            return {
                success: false,
                message: "Cancelled.",
                appName: prep.appName,
            };
        }
    }

    const deploymentId = randomBytes(16).toString("hex");
    startDeploymentStream(deploymentId);

    let cleanupInput: (() => void) | undefined;
    if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin);
        const hadRawMode = Boolean((process.stdin as any).isRaw);
        if (!hadRawMode && typeof process.stdin.setRawMode === "function") {
            process.stdin.setRawMode(true);
        }
        const onKeypress = (_str: string, key: { name?: string; ctrl?: boolean }) => {
            if (key?.name?.toLowerCase() === "c") {
                cancelDeployment(deploymentId);
                return;
            }
            if (key?.ctrl && key?.name === "c") {
                cancelDeployment(deploymentId);
            }
        };
        process.stdin.on("keypress", onKeypress);
        console.log("Streaming deployment logs. Press 'c' to cancel.");
        cleanupInput = () => {
            process.stdin.off("keypress", onKeypress);
            if (!hadRawMode && typeof process.stdin.setRawMode === "function") {
                process.stdin.setRawMode(false);
            }
        };
    }

    try {
        const result = await finalizeRepoImport(prep.appName, prep.versionId, deployConfig, deploymentId);
        return {
            ...result,
            appName: prep.appName,
        };
    } finally {
        cleanupInput?.();
        endDeploymentStream(deploymentId);
    }
}
