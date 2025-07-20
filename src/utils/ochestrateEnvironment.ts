import { runCommand } from "./command";
import { join } from 'path';

export async function orchestrateEnvironment(envJsonPath: string) {
    try {
        const pathToScript = join(process.cwd(),'..','..', 'scripts', 'ochestrateEnvironment.sh');
        await runCommand(pathToScript, [envJsonPath]);
    } catch (error) {
        console.error(`Error orchestrating environment:`, error);
        process.exit(1);
    }
}