import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import api from './api';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { getSystemConfig, saveSystemConfig } from './config';

// Load API key from config
async function getApiKey(): Promise<string | null> {
  const config = await getSystemConfig();
  return config.manager?.api_key || null;
}

// Generate a new API key
async function generateApiKey(): Promise<string> {
  const apiKey = randomBytes(32).toString('hex');
  try {
    await saveSystemConfig({
      manager: { api_key: apiKey }
    });
    return apiKey;
  } catch (error) {
    console.error('Failed to save API key:', error);
    throw error;
  }
}

const app = new Hono();

// API key authentication middleware for all /api routes
app.use('/api/*', async (c, next) => {
  const apiKey = await getApiKey();

  // If no API key configured, allow access (first-time setup)
  if (!apiKey) {
    await next();
    return;
  }

  const providedKey = c.req.header('X-API-Key');
  if (!providedKey || providedKey !== apiKey) {
    return c.json({ success: false, message: 'Unauthorized: Invalid API key' }, 401);
  }

  await next();
});

// API key management endpoint (accessible without auth for initial setup)
app.post('/auth/generate-key', async (c) => {
  const existingKey = await getApiKey();
  if (existingKey) {
    // Require current key to regenerate
    const providedKey = c.req.header('X-API-Key');
    if (!providedKey || providedKey !== existingKey) {
      return c.json({ success: false, message: 'Unauthorized: Provide current API key to regenerate' }, 401);
    }
  }

  const newKey = await generateApiKey();
  return c.json({
    success: true,
    message: 'API key generated. Store this securely - it will not be shown again.',
    apiKey: newKey
  });
});

// Check if auth is configured
app.get('/auth/status', async (c) => {
  const apiKey = await getApiKey();
  return c.json({
    success: true,
    authEnabled: !!apiKey,
    message: apiKey ? 'API key authentication is enabled' : 'No API key configured - open access'
  });
});

app.route('/api', api);
app.use('/*', serveStatic({ root: './public' }));

console.log('Hono server listening on port 8788');
console.log('API key auth: Check /auth/status for authentication state');

export default {
  port: 8788,
  fetch: app.fetch,
};