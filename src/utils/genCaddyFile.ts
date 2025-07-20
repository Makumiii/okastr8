import { join } from "path";
import type { Okastr8Config } from "../types";
import { runCommand } from "./command";
import { readFile, writeFile } from "./fs";
import { homedir } from "os";

const userConfigPath = `${homedir()}/.okastr8/config.json`;
const caddyFilePath = "/etc/caddy/caddyfile";

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
    const pathToReloadCaddy = join(process.cwd(), '..', '..', 'scripts', 'systemd', 'reloadCaddy.sh');
    await runCommand(pathToReloadCaddy, []);
    console.log(`Caddyfile generated at ${caddyFilePath}`);
  } catch (e) {
    console.error("Error generating Caddyfile:", e);
    throw e;
  }
}
