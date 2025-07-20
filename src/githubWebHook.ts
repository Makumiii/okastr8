import { Hono } from 'hono';
import { createHmac } from 'node:crypto';
import { homedir } from 'os';
import { readFile } from './utils/fs';
import type { GitWebhookPayload, Okastr8Config } from './types';

import { deploy } from './deploy';

interface Env {
  Variables: {
    rawBody: string;
  };
}

const userConfigPath = `${homedir()}/.okastr8/config.json`;
let config: Okastr8Config = {} as Okastr8Config;
try {
  const content = await readFile(userConfigPath);
  config = JSON.parse(content);
} catch (e) {
  console.error(`Failed to load config from ${userConfigPath}`, e);
}


const app = new Hono<Env>();

app.use('/webhook', async (c, next) => {
  if (c.req.method === 'POST') {
    const rawBody = await c.req.text();
    c.set('rawBody', rawBody);
  }
  await next();
})


app.post('/webhook', async (c) => {
  const signature = c.req.header('x-hub-signature-256');
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const rawBody = c.get('rawBody');

  if (!signature || !secret || !rawBody) {
    console.error('Missing signature, secret, or raw body.');
    return c.text('Bad Request', 400);
  }

  const expectedSignature = 'sha256=' +
    createHmac('sha256', secret).update(rawBody).digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid signature.');
    return c.text('Forbidden', 403);
  }

  let payload: GitWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as GitWebhookPayload;
  } catch (error) {
    console.error('Failed to parse JSON payload:', error);
    return c.text('Bad Request - Invalid JSON', 400);
  }

  if (!payload || !payload.ref || !payload.repository) {
    console.error('Invalid payload structure.');
    return c.text('Bad Request - Invalid Payload', 400);
  }

  const repoName = payload.repository.name;
  const branch = payload.ref.split('/')[2];
  if(!branch) {
    console.error('Invalid branch name in payload.');
    return c.text('Bad Request - Invalid Branch', 400);
  }
  const service = config.services.find((service)=> service.git.remoteName.trim() === repoName.trim() && service.git.watchRemoteBranch.trim() === branch.trim())
  if (!service) {
    console.error(`No service found for repository ${repoName} on branch ${branch}`);
    return c.text('Not Found - No Service Configured', 404);
  }

  const buildCommands = service.buildSteps
  await deploy({serviceName:service.systemd.serviceName, gitRemoteName:service.git.remoteName}, buildCommands, {ssh_url:payload.repository.ssh_url, gitHash:payload.before
  })





  return c.text('Webhook received and deployment initiated!', 200);
});

console.log('Hono server listening on port 8787');

export default {
  port: 8787,
  fetch: app.fetch,
};
