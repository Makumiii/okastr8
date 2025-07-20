import { homedir } from 'os';
import type { Deployment, DeploymentRecord, DeploysMetadata } from './types';
import { readFile, writeFile } from './utils/fs';
const pathToDeployment = `${homedir()}/.okastr8/deployment.json`;

export async function saveDeployment(deployment: DeploysMetadata, serviceId:{ serviceName: string, gitRemoteName: string }) {
    try{

        const content = await readFile(pathToDeployment);
        const existingDeployments = JSON.parse(content) as DeploymentRecord
        const entry = existingDeployments.deployments.find((d) => d.serviceName === serviceId.serviceName && d.gitRemoteName === serviceId.gitRemoteName)
        if(!entry){
            throw new Error(`No deployment found for service ${serviceId.serviceName} with remote ${serviceId.gitRemoteName}`);
        }
        entry.deploys.push(deployment);

        await writeFile(pathToDeployment, JSON.stringify(existingDeployments, null, 2));
        console.log(`Deployment saved to ${pathToDeployment}`);

    }catch(error){  
        console.error(`Error saving deployment:`, error);
        process.exit(1);
    }

}

export async function rollbackDeployment(hash:string, ){
    try{
        const content = await readFile(pathToDeployment);
        const existingDeployments = JSON.parse(content) as DeploymentRecord;

        

    }catch(e){
        console.error(`Error rolling back deployment for ${hash}:`, e);
        process.exit(1);
    }
}