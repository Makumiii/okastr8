import { Hono } from 'hono';
import { createHmac } from 'node:crypto';

interface Env {
  Variables: {
    rawBody: string;
  };
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

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Failed to parse JSON payload:', error);
    return c.text('Bad Request - Invalid JSON', 400);
  }

  if (payload.ref && payload.repository) {
    const branch = payload.ref.split('/').pop();
    const repoName = payload.repository.name;
    console.log(`Received push to repository: ${repoName}, branch: ${branch}`);
  }

  // Run deploy script
  Bun.spawn(['/bin/bash', './scripts/deploy.sh'], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  return c.text('Webhook received and deployment initiated!', 200);
});

console.log('Hono server listening on port 8787');

export default {
  port: 8787,
  fetch: app.fetch,
};
