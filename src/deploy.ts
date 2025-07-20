import build from "./build";
import { runCommand } from "./utils/command";
import {join, resolve} from 'path'

export async function deploy(serviceName:string,buildSteps:string[]){
    try{
        await build(buildSteps);
        const pathToScript = join(process.cwd(),'..','scripts','systemd', 'restart.sh')
        await runCommand(pathToScript, [serviceName]);
    }
    catch(error){
        console.error(`Error deploying service ${serviceName}:`, error);
        process.exit(1);
    }
}