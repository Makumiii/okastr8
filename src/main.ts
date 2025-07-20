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

program.command('serve')
  .description('Start the GitHub webhook server')
  .action(async () => {
    interface Env {
      Variables: {
        rawBody: string;
      };
    }
    const app = new Hono<Env>();
    await addGithubWebhookRoute(app);

    console.log('Hono server listening on port 8787');
    // Bun.serve is used here as it's a Bun project
    // If this were a Node.js project, a different server setup would be needed
    Bun.serve({
      port: 8787,
      fetch: app.fetch,
    });
  });

program.parse(process.argv);
