import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Okastr8Config } from "../types";
import { runCommand } from "./command";
import { readFile, writeFile } from "./fs";
import { homedir } from "os";

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/utils/
const PROJECT_ROOT = join(__dirname, "..", "..");

const userConfigPath = `${homedir()}/.okastr8/config.json`;
const caddyFilePath = "/etc/caddy/Caddyfile"; // Correct casing

export async function genCaddyFile(onLog?: (msg: string) => void) {
  try {
    const { readdir, readFile, stat } = await import('fs/promises');
    const { join } = await import('path');
    const { OKASTR8_HOME } = await import('../config.ts');

    const appsDir = join(OKASTR8_HOME, 'apps');
    let appsToCheck: string[] = [];

    try {
      appsToCheck = await readdir(appsDir);
    } catch {
      // Apps dir might not exist yet
      appsToCheck = [];
    }

    const caddyEntries: string[] = [];

    for (const appName of appsToCheck) {
      try {
        const appMetadataPath = join(appsDir, appName, 'app.json');
        // Check if file exists first? readFile throws if not found
        const content = await readFile(appMetadataPath, 'utf-8');
        const metadata = JSON.parse(content);

        const domain = metadata.domain;
        const port = metadata.port;

        if (domain && port) {
          // Use http:// prefix for localhost domains to avoid auto-HTTPS
          const scheme = domain.endsWith('.localhost') ? 'http://' : '';
          caddyEntries.push(`${scheme}${domain} {\n  reverse_proxy localhost:${port}\n}`);
          // Only log if not silent (onLog provided)
          if (onLog) onLog(`  Added route: ${domain} -> :${port} (${appName})`);
        }
      } catch (e) {
        // Skip invalid apps or those without app.json
        continue;
      }
    }

    // Global options block enables metrics on admin API (localhost:2019/metrics)
    const globalOptions = `{
  servers {
    metrics
  }
}
`;

    const caddyFile = globalOptions + caddyEntries.join("\n\n") + "\n";

    // Write Caddyfile using sudo helper script to avoid permission issues
    const pathToWriteCaddyfile = join(PROJECT_ROOT, "scripts", "caddy", "writeCaddyfile.sh");
    const writeResult = await runCommand("sudo", [pathToWriteCaddyfile], undefined, caddyFile);

    if (writeResult.exitCode !== 0) {
      throw new Error(`Failed to write Caddyfile: ${writeResult.stderr}`);
    }

    // Use absolute path from project root (not fragile relative path)
    const pathToReloadCaddy = join(PROJECT_ROOT, "scripts", "caddy", "reloadCaddy.sh");
    await runCommand("sudo", [pathToReloadCaddy]);

    if (onLog) onLog(`Caddyfile regenerated with ${caddyEntries.length} routes at ${caddyFilePath}`);
  } catch (e) {
    console.error("Error generating Caddyfile:", e);
    // Don't throw, just log. Deployment shouldn't fail if Caddy fails? 
    // Actually, maybe it should warn.
    // throw e; 
  }
}
