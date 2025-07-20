import { Command } from 'commander';
import { Hono } from 'hono';
import { addSystemdCommands } from './commands/systemd';
import { addUserCommands } from './commands/user';
import { addOrchestrateCommand } from './commands/orchestrate';
import { addGithubWebhookRoute } from './githubWebHook';

const program = new Command();

program
  .name('okastr8')
  .description('CLI for orchestrating server environments and deployments')
  .version('0.0.1');

addSystemdCommands(program);
addUserCommands(program);
addOrchestrateCommand(program);

// If no arguments are provided, start the Hono server
if (process.argv.length === 2) {
  interface Env {
    Variables: {
      rawBody: string;
    };
  }
  const app = new Hono<Env>();
  addGithubWebhookRoute(app);

  console.log('Hono server listening on port 8787');
  Bun.serve({
    port: 8787,
    fetch: app.fetch,
  });
} else {
  program.parse(process.argv);
}
