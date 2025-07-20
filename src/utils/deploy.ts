import { homedir } from "os";
import build from "./build";
import { runCommand } from "./command";
import {join, resolve} from 'path'
import { readFile } from "./fs";
import type { DeploymentRecord } from "../types";
import { saveDeployment } from "./deployments";
import { genCaddyFile } from "../genCaddyFile";
const projectsFolder = `${homedir()}/.okastr8/projects`;
const pathToDeployment = `${homedir()}/.okastr8/deployment.json`;

export async function deploy(service:{ serviceName: string, gitRemoteName: string },buildSteps:string[], git:{ ssh_url: string, gitHash: string }) {
    try{

        process.chdir(resolve(projectsFolder, service.serviceName));
        await build(buildSteps, service.serviceName);
        const pathToScript = join(process.cwd(),'..','..','scripts','systemd', 'restart.sh')
        await runCommand(pathToScript, [service.serviceName]);
        await saveDeployment({gitHash:git.gitHash, timeStamp:new Date(), ssh_url:git.ssh_url
        }, { serviceName: service.serviceName, gitRemoteName: service.gitRemoteName });
        await genCaddyFile()

    }
    catch(error){
        console.error(`Error deploying service ${service.serviceName}:`, error);
        process.exit(1);
    }
}