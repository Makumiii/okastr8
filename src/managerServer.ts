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

console.log('Hono server listening on port 8788');

export default {
  port: 8788,
  fetch: app.fetch,
};