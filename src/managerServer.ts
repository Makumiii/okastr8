import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import api from './api';

const app = new Hono();

app.route('/api', api);
app.use('/*', serveStatic({ root: './public' }));

console.log('Hono server listening on port 8788');

export default {
  port: 8788,
  fetch: app.fetch,
};