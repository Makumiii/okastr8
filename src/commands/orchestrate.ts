import { Command } from "commander";
import { orchestrateEnvironment as coreOrchestrate } from "../utils/ochestrateEnvironment";

// Core Function
export async function orchestrateEnvironment() {
    return await coreOrchestrate();
}

// Commander Integration
export function addOrchestrateCommand(program: Command) {
    program
        .command("orchestrate")
        .description(
            "Orchestrate the server environment using a JSON configuration file from ~/.okastr8/environment.json"
        )
        .action(async () => {
            const result = await orchestrateEnvironment();
            console.log(result.stdout || result.stderr);
        });
}
