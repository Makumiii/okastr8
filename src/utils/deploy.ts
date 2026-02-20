import { homedir } from "os";
import build from "./build";
import { runCommand } from "./command";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type { DeploymentRecord } from "../types";
import { saveDeployment } from "./deployments";
import { genCaddyFile } from "./genCaddyFile";

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/utils/
const PROJECT_ROOT = join(__dirname, "..", "..");

const projectsFolder = `${homedir()}/.okastr8/projects`;

export async function deploy(
    service: { serviceName: string; gitRemoteName: string },
    buildSteps: string[],
    git: { ssh_url: string; gitHash: string }
) {
    try {
        process.chdir(resolve(projectsFolder, service.serviceName));
        await build(buildSteps, service.serviceName);

        // Use absolute path from project root (not fragile relative path)
        const pathToScript = join(PROJECT_ROOT, "scripts", "systemd", "restart.sh");
        await runCommand("sudo", [pathToScript, service.serviceName]);

        await saveDeployment(
            { gitHash: git.gitHash, timeStamp: new Date(), ssh_url: git.ssh_url },
            { serviceName: service.serviceName, gitRemoteName: service.gitRemoteName }
        );
        await genCaddyFile();
    } catch (error) {
        console.error(`Error deploying service ${service.serviceName}:`, error);
        throw error; // Re-throw instead of process.exit(1) to not crash server
    }
}
