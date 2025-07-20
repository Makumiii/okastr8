import { Command } from 'commander';
import { orchestrateEnvironment } from '../utils/ochestrateEnvironment';

export function addOrchestrateCommand(program: Command) {
  program.command('orchestrate')
    .description('Orchestrate the server environment using a JSON configuration file')
    .argument('<environment-json-path>', 'Path to the environment JSON configuration file')
    .action(async (envJsonPath) => {
      await orchestrateEnvironment(envJsonPath);
    });
}
