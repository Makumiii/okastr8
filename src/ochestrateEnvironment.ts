import { runCommand } from "./utils/command";
import { join } from 'path';
export async function orchestrateEnvironment(){
    try{

        const pathToScript = join(process.cwd(),'..','scripts', 'setup.sh')
        await runCommand(pathToScript);

    }catch(error){
        console.error(`Error orchestrating environment:`, error);
        process.exit(1);
    }
}