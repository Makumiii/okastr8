import { Command } from 'commander';
import { addSystemdCommands } from './commands/systemd';
import { addUserCommands } from './commands/user';

const program = new Command();

program
  .name('okastr8')
  .description('CLI for orchestrating server environments and deployments')
  .version('0.0.1');

addSystemdCommands(program);
addUserCommands(program);

program.parse(process.argv);
