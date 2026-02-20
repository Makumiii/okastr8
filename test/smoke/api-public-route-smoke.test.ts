import { describe, expect, it } from 'bun:test';
import api from '../../src/api';

describe('API public route smoke', () => {
  it('exposes auth/github endpoint without requiring prior session', async () => {
    const response = await api.request('/auth/github', {
      method: 'GET',
    });

    expect(response.status).toBe(302);
    const location = response.headers.get('location') || '';
    expect(location.length).toBeGreaterThan(0);
  });
});
