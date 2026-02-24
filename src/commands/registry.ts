import { Command } from "commander";
import { join } from "path";
import { mkdir, readFile, writeFile, chmod } from "fs/promises";
import { existsSync } from "fs";
import { OKASTR8_HOME } from "../config";
import { checkDockerInstalled, dockerLogin, dockerLogout } from "./docker";
import { runCommand } from "../utils/command";

const REGISTRY_FILE = join(OKASTR8_HOME, "registries.json");

export type RegistryProvider = "ghcr" | "dockerhub" | "ecr" | "generic";

export interface RegistryCredential {
    id: string;
    provider: RegistryProvider;
    server: string;
    username: string;
    token: string;
    createdAt: string;
}

interface RegistryStore {
    credentials: RegistryCredential[];
}

export function deriveEcrRegionFromServer(server: string): string | undefined {
    // Example: 123456789012.dkr.ecr.us-east-1.amazonaws.com
    const match = server.match(/\.ecr\.([a-z0-9-]+)\.amazonaws\.com$/i);
    if (match && match[1]) {
        return match[1];
    }
    return undefined;
}

async function getEcrPassword(
    server: string
): Promise<{ success: boolean; password?: string; message?: string }> {
    const region = deriveEcrRegionFromServer(server);
    if (!region) {
        return {
            success: false,
            message: `Unable to derive AWS region from ECR server '${server}'`,
        };
    }

    const result = await runCommand("aws", ["ecr", "get-login-password", "--region", region]);
    if (result.exitCode !== 0) {
        return {
            success: false,
            message: `Failed to fetch ECR login token: ${result.stderr || result.stdout}`,
        };
    }

    const password = result.stdout.trim();
    if (!password) {
        return {
            success: false,
            message: "ECR login token response was empty",
        };
    }

    return { success: true, password };
}

export async function getRegistryLoginMaterial(id: string): Promise<{
    success: boolean;
    server?: string;
    username?: string;
    password?: string;
    provider?: RegistryProvider;
    message?: string;
}> {
    const credential = await getRegistryCredential(id);
    if (!credential) {
        return { success: false, message: `Credential '${id}' not found` };
    }

    if (credential.provider === "ecr") {
        const ecr = await getEcrPassword(credential.server);
        if (!ecr.success) {
            return { success: false, message: ecr.message };
        }
        return {
            success: true,
            server: credential.server,
            provider: credential.provider,
            username: "AWS",
            password: ecr.password,
        };
    }

    return {
        success: true,
        server: credential.server,
        provider: credential.provider,
        username: credential.username,
        password: credential.token,
    };
}

async function loadStore(): Promise<RegistryStore> {
    if (!existsSync(REGISTRY_FILE)) {
        return { credentials: [] };
    }
    try {
        const content = await readFile(REGISTRY_FILE, "utf-8");
        const parsed = JSON.parse(content) as RegistryStore;
        return parsed?.credentials ? parsed : { credentials: [] };
    } catch {
        return { credentials: [] };
    }
}

async function saveStore(store: RegistryStore): Promise<void> {
    await mkdir(OKASTR8_HOME, { recursive: true });
    await writeFile(REGISTRY_FILE, JSON.stringify(store, null, 2), "utf-8");
    await chmod(REGISTRY_FILE, 0o600).catch(() => {});
}

export async function listRegistryCredentials(): Promise<RegistryCredential[]> {
    const store = await loadStore();
    return store.credentials;
}

export async function listRegistryCredentialSummaries(): Promise<
    Array<{
        id: string;
        provider: RegistryProvider;
        server: string;
        username: string;
        createdAt: string;
    }>
> {
    const store = await loadStore();
    return store.credentials.map((credential) => ({
        id: credential.id,
        provider: credential.provider,
        server: credential.server,
        username: credential.username,
        createdAt: credential.createdAt,
    }));
}

export async function getRegistryCredential(id: string): Promise<RegistryCredential | undefined> {
    const store = await loadStore();
    return store.credentials.find((c) => c.id === id);
}

export async function upsertRegistryCredential(credential: RegistryCredential): Promise<void> {
    const store = await loadStore();
    const next = store.credentials.filter((c) => c.id !== credential.id);
    next.push(credential);
    await saveStore({ credentials: next });
}

export async function removeRegistryCredential(id: string): Promise<boolean> {
    const store = await loadStore();
    const next = store.credentials.filter((c) => c.id !== id);
    if (next.length === store.credentials.length) {
        return false;
    }
    await saveStore({ credentials: next });
    return true;
}

export async function testRegistryCredential(
    id: string
): Promise<{ success: boolean; message: string }> {
    const loginMaterial = await getRegistryLoginMaterial(id);
    if (
        !loginMaterial.success ||
        !loginMaterial.server ||
        !loginMaterial.username ||
        !loginMaterial.password
    ) {
        return { success: false, message: loginMaterial.message || "Invalid login material" };
    }

    const dockerReady = await checkDockerInstalled();
    if (!dockerReady) {
        return { success: false, message: "Docker is not installed or unavailable" };
    }

    const login = await dockerLogin(
        loginMaterial.server,
        loginMaterial.username,
        loginMaterial.password
    );
    if (!login.success) {
        return login;
    }

    await dockerLogout(loginMaterial.server).catch(() => {});
    return { success: true, message: `Credential '${id}' authenticated successfully` };
}

async function ghcrFetch(
    token: string,
    path: string
): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
        const response = await fetch(`https://api.github.com${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });
        if (!response.ok) {
            const text = await response.text();
            return {
                success: false,
                message: `GHCR API ${response.status}: ${text || response.statusText}`,
            };
        }
        const data = await response.json();
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function listGhcrPackages(options: {
    credentialId: string;
    ownerType?: "user" | "org";
    owner?: string;
}): Promise<{
    success: boolean;
    ownerType?: "user" | "org";
    owner?: string;
    packages?: Array<{ name: string; visibility?: string; updatedAt?: string }>;
    message?: string;
}> {
    const credential = await getRegistryCredential(options.credentialId);
    if (!credential) {
        return { success: false, message: `Credential '${options.credentialId}' not found` };
    }
    if (credential.provider !== "ghcr") {
        return { success: false, message: `Credential '${options.credentialId}' is not GHCR` };
    }

    const ownerType = options.ownerType || "user";
    const owner = options.owner || credential.username;
    const basePath =
        ownerType === "org"
            ? `/orgs/${encodeURIComponent(owner)}/packages?package_type=container&per_page=100`
            : `/users/${encodeURIComponent(owner)}/packages?package_type=container&per_page=100`;

    const result = await ghcrFetch(credential.token, basePath);
    if (!result.success) return { success: false, message: result.message };
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
        success: true,
        ownerType,
        owner,
        packages: rows.map((row: any) => ({
            name: row.name,
            visibility: row.visibility,
            updatedAt: row.updated_at,
        })),
    };
}

export async function listGhcrPackageTags(options: {
    credentialId: string;
    packageName: string;
    ownerType?: "user" | "org";
    owner?: string;
}): Promise<{
    success: boolean;
    ownerType?: "user" | "org";
    owner?: string;
    packageName?: string;
    versions?: Array<{ id: string; tags: string[]; digest?: string; updatedAt?: string }>;
    message?: string;
}> {
    const credential = await getRegistryCredential(options.credentialId);
    if (!credential) {
        return { success: false, message: `Credential '${options.credentialId}' not found` };
    }
    if (credential.provider !== "ghcr") {
        return { success: false, message: `Credential '${options.credentialId}' is not GHCR` };
    }
    if (!options.packageName) {
        return { success: false, message: "packageName is required" };
    }

    const ownerType = options.ownerType || "user";
    const owner = options.owner || credential.username;
    const scope =
        ownerType === "org"
            ? `/orgs/${encodeURIComponent(owner)}`
            : `/users/${encodeURIComponent(owner)}`;
    const path = `${scope}/packages/container/${encodeURIComponent(options.packageName)}/versions?per_page=100`;

    const result = await ghcrFetch(credential.token, path);
    if (!result.success) return { success: false, message: result.message };
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
        success: true,
        ownerType,
        owner,
        packageName: options.packageName,
        versions: rows.map((row: any) => ({
            id: String(row.id),
            tags: row.metadata?.container?.tags || [],
            digest: row.name,
            updatedAt: row.updated_at,
        })),
    };
}

export function addRegistryCommands(program: Command) {
    const registry = program
        .command("registry")
        .description("Manage container registry credentials");

    registry
        .command("add")
        .description("Add or update a registry credential")
        .argument("<id>", "Credential identifier")
        .argument("<provider>", "Provider: ghcr|dockerhub|ecr|generic")
        .argument("<server>", "Registry server (e.g., ghcr.io)")
        .argument("<username>", "Registry username")
        .argument("<token>", "Registry token/password")
        .action(
            async (
                id: string,
                provider: RegistryProvider,
                server: string,
                username: string,
                token: string
            ) => {
                try {
                    const providerValue = provider.toLowerCase() as RegistryProvider;
                    if (!["ghcr", "dockerhub", "ecr", "generic"].includes(providerValue)) {
                        console.error(
                            "Unsupported provider. Use ghcr, dockerhub, ecr, or generic."
                        );
                        process.exit(1);
                    }

                    await upsertRegistryCredential({
                        id,
                        provider: providerValue,
                        server,
                        username,
                        token,
                        createdAt: new Date().toISOString(),
                    });
                    console.log(`Saved registry credential '${id}' (${providerValue} @ ${server})`);
                } catch (error: any) {
                    console.error(`Failed to save credential: ${error.message}`);
                    process.exit(1);
                }
            }
        );

    registry
        .command("list")
        .description("List saved registry credentials")
        .action(async () => {
            const creds = await listRegistryCredentials();
            if (creds.length === 0) {
                console.log("No registry credentials saved.");
                return;
            }
            console.log("Registry credentials:");
            for (const c of creds) {
                console.log(`  • ${c.id} (${c.provider}) -> ${c.server} as ${c.username}`);
            }
        });

    registry
        .command("remove")
        .description("Remove a saved registry credential")
        .argument("<id>", "Credential identifier")
        .action(async (id: string) => {
            const removed = await removeRegistryCredential(id);
            if (!removed) {
                console.error(`Credential '${id}' not found`);
                process.exit(1);
            }
            console.log(`Removed credential '${id}'`);
        });

    registry
        .command("test")
        .description("Test registry credential via docker login")
        .argument("<id>", "Credential identifier")
        .action(async (id: string) => {
            const result = await testRegistryCredential(id);
            if (!result.success) {
                console.error(result.message);
                process.exit(1);
            }
            console.log(result.message);
        });
}
