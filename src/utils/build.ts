import { runCommand } from "./command";

export default async function build(buildSteps:string[], serviceName:string){
    try{
        for(const step of buildSteps){
            await runCommand(step);
        }
    }catch(error){
        console.error(`Error executing build steps: ${error}`);
        process.exit(1);
    }

}