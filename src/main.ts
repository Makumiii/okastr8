import { Command } from 'commander';
import { addSystemdCommands } from './commands/systemd';
import { addUserCommands } from './commands/user';
import { addOrchestrateCommand } from './commands/orchestrate';
import { addSetupCommands } from './commands/setup';
import { addAppCommands } from './commands/app';
import { addDeployCommands } from './commands/deploy';

const program = new Command();

program
  .name('okastr8')
  .description('CLI for orchestrating server environments and deployments')
  .version('0.0.1');

addSystemdCommands(program);
addUserCommands(program);
addOrchestrateCommand(program);
addSetupCommands(program);
addAppCommands(program);
addDeployCommands(program);

program.parse(process.argv);

