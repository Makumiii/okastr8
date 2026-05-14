import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiModule from './api';

describe('api client smoke', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds /api URL and includes credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, message: 'ok' }),
    } as Response);

    const response = await apiModule.get('/system/status');

    expect(response).toMatchObject({ success: true, message: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/system/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
  });

  it('preserves full /api endpoint paths', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, message: 'ok' }),
    } as Response);

    await apiModule.apiRequest('/api/activity/stats');

    expect(fetchMock).toHaveBeenCalledWith('/api/activity/stats', expect.any(Object));
  });

  it('redirects to login and throws on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 401,
      json: async () => ({ success: false, message: 'nope' }),
    } as Response);

    await expect(apiModule.post('/apps/create', { name: 'demo' })).rejects.toThrow('Unauthorized');
  });
});
