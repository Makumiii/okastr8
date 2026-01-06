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

export async function genCaddyFile() {
  try {
    const content = await readFile(userConfigPath);
    const config = JSON.parse(content) as Okastr8Config;

    const caddyEntries = config.services
      .filter((s) => s.networking?.domain && s.networking?.port)
      .map((s) => {
        const { port, domain } = s.networking;
        return `${domain} {\n  reverse_proxy localhost:${port}\n}`;
      });

    const caddyFile = caddyEntries.join("\n\n") + "\n"; 

    await writeFile(caddyFilePath, caddyFile);
    
    // Use absolute path from project root (not fragile relative path)
    const pathToReloadCaddy = join(PROJECT_ROOT, "scripts", "caddy", "reloadCaddy.sh");
    await runCommand("sudo", [pathToReloadCaddy]);
    
    console.log(`Caddyfile generated at ${caddyFilePath}`);
  } catch (e) {
    console.error("Error generating Caddyfile:", e);
    throw e;
  }
}

