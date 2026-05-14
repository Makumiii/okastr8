import { runCommand } from "./command";
import { join } from "path";

export async function orchestrateEnvironment() {
    try {
        const pathToScript = join(process.cwd(), "scripts", "ochestrateEnvironment.sh");
        return await runCommand(pathToScript, []); // No arguments passed to the script
    } catch (error) {
        console.error(`Error orchestrating environment:`, error);
        throw error; // Re-throw the error for the caller to handle
    }
}
