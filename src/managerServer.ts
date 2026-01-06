import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import api from './api';
import { homedir } from 'os';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

const CONFIG_PATH = join(homedir(), '.okastr8', 'config.json');

// Load API key from config
async function getApiKey(): Promise<string | null> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);
    return config.apiKey || null;
  } catch {
    return null;
  }
}

// Generate a new API key
async function generateApiKey(): Promise<string> {
  const apiKey = randomBytes(32).toString('hex');
  try {
    let config: any = {};
    try {
      const content = await readFile(CONFIG_PATH, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid
      await mkdir(join(homedir(), '.okastr8'), { recursive: true });
    }
    config.apiKey = apiKey;
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
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