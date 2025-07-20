import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

const app = new Hono();

app.use('/*', serveStatic({ root: './public' }));

console.log('Hono server listening on port 8788');

export default {
  port: 8788,
  fetch: app.fetch,
};