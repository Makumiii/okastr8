import { expect, test } from '@playwright/test';
import { createLiveTestToken, getBaseUrl, setSessionCookie } from './live-auth.helpers';

const BASE_URL = getBaseUrl();

test.describe('live manager authenticated flows', () => {
  test('authenticated session can open dashboard root', async ({ context, page }) => {
    const token = createLiveTestToken('e2e-dashboard-user');
    await setSessionCookie(context, token, BASE_URL);

    await page.goto(`${BASE_URL}/`);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('authenticated session can access protected system status API', async ({ context, request }) => {
    const token = createLiveTestToken('e2e-api-user');
    await setSessionCookie(context, token, BASE_URL);

    const response = await request.get(`${BASE_URL}/api/system/status`, {
      headers: {
        Cookie: `okastr8_session=${token}`,
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: 'System status',
    });
  });

  test('logout invalidates browser session for auth/me contract', async ({ context, request }) => {
    const token = createLiveTestToken('e2e-logout-user');
    await setSessionCookie(context, token, BASE_URL);

    const beforeLogout = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Cookie: `okastr8_session=${token}`,
      },
    });
    expect(beforeLogout.status()).toBe(200);

    const logout = await request.post(`${BASE_URL}/api/auth/logout`, {
      headers: {
        Cookie: `okastr8_session=${token}`,
      },
    });
    expect(logout.status()).toBe(200);

    const afterLogout = await request.get(`${BASE_URL}/api/auth/me`);
    expect(afterLogout.status()).toBe(401);
    await expect(afterLogout.json()).resolves.toMatchObject({
      success: false,
      message: 'Not authenticated',
    });
  });
});
