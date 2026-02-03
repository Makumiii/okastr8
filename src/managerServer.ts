import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import api from './api';
import { startResourceMonitor } from './services/monitor';
import { installConsoleLogger, logPaths } from './utils/structured-logger';

const app = new Hono();

installConsoleLogger({
  filePath: logPaths.unified,
  source: "manager",
  service: "okastr8-manager",
  maxBytes: 10 * 1024 * 1024,
  maxBackups: 3,
});

// Start background services
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
