import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { runCommand } from "./command";

type AppRouteMetadata = {
    appName: string;
    domain?: unknown;
    port?: unknown;
    tunnel_routing?: unknown;
};

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/utils/
const PROJECT_ROOT = join(__dirname, "..", "..");
const caddyFilePath = "/etc/caddy/Caddyfile";

const globalOptions = `{
  servers {
    metrics
  }
}
`;

function caddySiteAddress(domain: string): string {
    return domain === "localhost" || domain.endsWith(".localhost") ? `http://${domain}` : domain;
}

export function buildCaddyRoute(domain: string, port: number): string {
    return `${caddySiteAddress(domain)} {\n  reverse_proxy 127.0.0.1:${port}\n}`;
}

export function buildCaddyFile(
    apps: AppRouteMetadata[],
    onLog?: (msg: string) => void
): { content: string; routeCount: number } {
    const caddyEntries: string[] = [];

    for (const metadata of apps) {
        const domain = typeof metadata.domain === "string" ? metadata.domain.trim() : "";
        const port = Number(metadata.port);

        if (!domain || !Number.isFinite(port)) {
            continue;
        }

        if (metadata.tunnel_routing) {
            onLog?.(`  Skipped route: ${domain} (using Cloudflare Tunnel)`);
            continue;
        }

        caddyEntries.push(buildCaddyRoute(domain, port));
        onLog?.(`  Added Caddy route: ${domain} -> 127.0.0.1:${port} (${metadata.appName})`);
    }

    return {
        content: globalOptions + caddyEntries.join("\n\n") + "\n",
        routeCount: caddyEntries.length,
    };
}

export async function genCaddyFile(onLog?: (msg: string) => void) {
    const { readdir, readFile } = await import("fs/promises");
    const { OKASTR8_HOME } = await import("../config.ts");

    const appsDir = join(OKASTR8_HOME, "apps");
    const appsToCheck = await readdir(appsDir).catch(() => [] as string[]);

    const apps: AppRouteMetadata[] = [];

    for (const appName of appsToCheck) {
        try {
            const appMetadataPath = join(appsDir, appName, "app.json");
            const content = await readFile(appMetadataPath, "utf-8");
            const metadata = JSON.parse(content);
            apps.push({ appName, ...metadata });
        } catch {
            // Skip invalid apps or those without app.json.
        }
    }

    const { content: caddyFile, routeCount } = buildCaddyFile(apps, onLog);

    // Write Caddyfile using sudo helper script to avoid permission issues.
    const pathToWriteCaddyfile = join(PROJECT_ROOT, "scripts", "caddy", "writeCaddyfile.sh");
    const writeResult = await runCommand("sudo", [pathToWriteCaddyfile], undefined, caddyFile);

    if (writeResult.exitCode !== 0) {
        throw new Error(
            `Failed to write Caddyfile: ${writeResult.stderr || writeResult.stdout || "unknown error"}`
        );
    }

    // Use absolute path from project root (not fragile relative path).
    const pathToReloadCaddy = join(PROJECT_ROOT, "scripts", "caddy", "reloadCaddy.sh");
    const reloadResult = await runCommand("sudo", [pathToReloadCaddy]);

    if (reloadResult.exitCode !== 0) {
        throw new Error(
            `Failed to reload Caddy: ${reloadResult.stderr || reloadResult.stdout || "unknown error"}`
        );
    }

    onLog?.(`Caddyfile regenerated with ${routeCount} routes at ${caddyFilePath}`);
}
