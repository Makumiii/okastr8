import { Command } from 'commander';
import { addSystemdCommands } from './commands/systemd';
import { addUserCommands } from './commands/user';
import { addOrchestrateCommand } from './commands/orchestrate';
import { addSetupCommands } from './commands/setup';
import { addAppCommands } from './commands/app';
import { addDeployCommands } from './commands/deploy';
import { addGitHubCommands } from './commands/github-cli';
import { addMetricsCommands } from './commands/metrics-cli';
import { addAuthCommands } from './commands/auth-cli';
import { addAccessUserCommands } from './commands/user-cli';

const program = new Command();

program
  .name('okastr8')
  .description('CLI for orchestrating server environments and deployments')
  .version('0.0.1');

addSystemdCommands(program);
addUserCommands(program);        // Linux user management
addOrchestrateCommand(program);
addSetupCommands(program);
addAppCommands(program);
addDeployCommands(program);
addGitHubCommands(program);
addMetricsCommands(program);
addAuthCommands(program);        // Token management
addAccessUserCommands(program);  // Access user management

import { addSystemCommands } from './commands/system';
addSystemCommands(program);      // Global service & nuke (Must be last)

program.parse(process.argv);
