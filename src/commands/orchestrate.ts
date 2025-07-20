import { Command } from 'commander';
import { orchestrateEnvironment as coreOrchestrate } from '../utils/ochestrateEnvironment';
import * as path from 'path';

const SCRIPT_BASE_PATH = path.join(process.cwd(), 'scripts');

// Core Function
export async function orchestrateEnvironment(envJsonPath: string) {
    return await coreOrchestrate(path.join(SCRIPT_BASE_PATH, envJsonPath));
}

// Commander Integration
export function addOrchestrateCommand(program: Command) {
  program.command('orchestrate')
    .description('Orchestrate the server environment using a JSON configuration file')
    .argument('<environment-json-path>', 'Path to the environment JSON configuration file')
    .action(async (envJsonPath) => {
      const result = await orchestrateEnvironment(envJsonPath);
      console.log(result.stdout || result.stderr);
    });
}
