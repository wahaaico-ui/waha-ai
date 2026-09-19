const requireAuthenticatedUser = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
}));

import { POST } from './route';

describe('academic originality route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-1' } });
  });

  test('requires authentication', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await POST(new Request('https://waha.systems/api/academic/originality', {
      method: 'POST',
      body: JSON.stringify({ textToCheck: 'نص أكاديمي للاختبار' }),
    }));

    expect(response.status).toBe(401);
  });

  test('rejects an empty or invalid payload', async () => {
    const response = await POST(new Request('https://waha.systems/api/academic/originality', {
      method: 'POST',
      body: JSON.stringify({ textToCheck: '   ' }),
    }));

    expect(response.status).toBe(400);
  });

  test('does not fabricate an originality score when no comparison provider exists', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const response = await POST(new Request('https://waha.systems/api/academic/originality', {
      method: 'POST',
      body: JSON.stringify({ textToCheck: 'هذا نص أكاديمي يحتاج إلى مقارنة موثقة مع مصادر حقيقية.' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body).toMatchObject({ success: false, available: false, capability: 'source-backed-similarity-check' });
    expect(body).not.toHaveProperty('originalityScore');
    expect(JSON.stringify(body)).not.toMatch(/\b\d{1,3}%/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
