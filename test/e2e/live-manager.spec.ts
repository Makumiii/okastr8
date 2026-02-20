import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';

const BASE_URL = process.env.OKASTR8_BASE_URL || 'http://127.0.0.1:41788';

test.describe('live manager smoke', () => {
  test('login page renders GitHub sign-in CTA', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible();
  });

  test('login page renders mapped oauth error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?error=github_not_configured`);
    await expect(page.getByText(/github oauth is not configured/i)).toBeVisible();
  });

  test('public/auth API routes return expected live contracts', async ({ request }) => {
    const meResponse = await request.get(`${BASE_URL}/api/auth/me`);
    expect(meResponse.status()).toBe(401);
    await expect(meResponse.json()).resolves.toMatchObject({
      success: false,
      message: 'Not authenticated',
    });

    const systemResponse = await request.get(`${BASE_URL}/api/system/status`);
    expect(systemResponse.status()).toBe(401);
    await expect(systemResponse.json()).resolves.toMatchObject({
      success: false,
      message: 'Authentication required',
    });

    const githubAuthResponse = await request.get(`${BASE_URL}/api/auth/github`, {
      maxRedirects: 0,
    });
    expect(githubAuthResponse.status()).toBe(302);

    const location = githubAuthResponse.headers()['location'] || '';
    expect(location).toContain('github.com/login/oauth/authorize');
    expect(location).toContain('redirect_uri=');
  });

  test('CLI command surface is usable in live environment', () => {
    const version = spawnSync('bun', ['run', 'src/main.ts', '--version'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toBe('0.0.1');

    const help = spawnSync('bun', ['run', 'src/main.ts', '--help'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('CLI for orchestrating server environments and deployments');
  });
});
