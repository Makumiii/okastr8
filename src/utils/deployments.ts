import { homedir } from "os";
import type { Deployment, DeploymentRecord, DeploysMetadata } from "../types";
import { readFile, writeFile } from "./fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runCommand } from "./command";

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/utils/
const PROJECT_ROOT = join(__dirname, "..", "..");

const pathToDeployment = `${homedir()}/.okastr8/deployment.json`;
const projectsFolder = `${homedir()}/.okastr8/projects`;

export async function saveDeployment(
    deployment: DeploysMetadata,
    serviceId: { serviceName: string; gitRemoteName: string }
) {
    try {
        const content = await readFile(pathToDeployment).catch((e: any) => {
            if (e.code === "ENOENT") {
                return JSON.stringify({ deployments: [] });
            }
            throw e;
        });
        const existingDeployments = JSON.parse(content) as DeploymentRecord;
        const entry = existingDeployments.deployments.find(
            (d) =>
                d.serviceName === serviceId.serviceName &&
                d.gitRemoteName === serviceId.gitRemoteName
        );
        if (!entry) {
            throw new Error(
                `No deployment found for service ${serviceId.serviceName} with remote ${serviceId.gitRemoteName}`
            );
        }
        entry.deploys.push(deployment);
        entry.lastSuccessfulDeploy = deployment;

        await writeFile(
            pathToDeployment,
            JSON.stringify(existingDeployments, null, 2)
        );
        console.log(`Deployment saved to ${pathToDeployment}`);
    } catch (error) {
        console.error(`Error saving deployment:`, error);
        throw error; // Re-throw instead of process.exit(1)
    }
}

export async function rollbackDeployment(
    hash: string,
    serviceId: { serviceName: string; gitRemoteName: string }
) {
    try {
        const content = await readFile(pathToDeployment).catch((e: any) => {
            if (e.code === "ENOENT") {
                return JSON.stringify({ deployments: [] });
            }
            throw e;
        });
        const existingDeployments = JSON.parse(content) as DeploymentRecord;
        const entry = existingDeployments.deployments.find(
            (d) =>
                d.serviceName === serviceId.serviceName &&
                d.gitRemoteName === serviceId.gitRemoteName
        );
        if (!entry) {
            throw new Error(
                `No deployment found for service ${serviceId.serviceName} with remote ${serviceId.gitRemoteName}`
            );
        }
        const foundDeployment = entry.deploys.find((d) => d.gitHash === hash);
        if (!foundDeployment) {
            throw new Error(
                `No deployment found with hash ${hash} for service ${serviceId.serviceName}`
            );
        }
        const { serviceName } = entry;
        const { ssh_url } = foundDeployment;

        // Use absolute path from project root (not fragile relative path)
        const pathToRollback = join(PROJECT_ROOT, "scripts", "git", "rollback.sh");
        await runCommand(pathToRollback, [ssh_url, hash, projectsFolder]);

        const pathToRestart = join(PROJECT_ROOT, "scripts", "systemd", "restart.sh");
        await runCommand("sudo", [pathToRestart, serviceName]);

        console.log(`Rollback script executed successfully for ${hash}`);
    } catch (e) {
        console.error(`Error rolling back deployment for ${hash}:`, e);
        throw e; // Re-throw instead of process.exit(1)
    }
}

export default async function autoRollbackDeployment(serviceId: string) {
    try {
        const content = await readFile(pathToDeployment);
        const existingDeployments = JSON.parse(content) as DeploymentRecord;
        if (existingDeployments.deployments.length === 0) {
            console.log(`No deployments found in ${pathToDeployment}`);
            return;
        }
        const entry = existingDeployments.deployments.find(
            (d) => d.serviceName === serviceId
        );
        if (!entry) {
            console.log(`No deployment found for service ${serviceId}`);
            return;
        }
        const lastSuccess = entry.lastSuccessfulDeploy;
        if (!lastSuccess) {
            console.log(`No successful deployment found for service ${serviceId}`);
            return;
        }

        await rollbackDeployment(lastSuccess.gitHash, {
            serviceName: entry.serviceName,
            gitRemoteName: entry.gitRemoteName,
        });
    } catch (e) {
        console.error(`Error during auto rollback deployment:`, e);
        throw e; // Re-throw instead of process.exit(1)
    }
}