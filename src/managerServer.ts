import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import api from './api';
import { startScheduler } from './services/scheduler';
import { startResourceMonitor } from './services/monitor';

const app = new Hono();

// Start background services
startScheduler();
startResourceMonitor();

// Mount the API
app.route('/api', api);

// Serve static files
app.use('/*', serveStatic({ root: './public' }));

// SPA Fallback
app.get('*', (c) => {
  return new Response(Bun.file('./public/index.html'));
});

console.log('Hono server listening on port 41788');

export default {
  port: 41788,
  fetch: app.fetch,
};