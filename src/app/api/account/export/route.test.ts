const requireAuthenticatedUser = jest.fn();
const buildAccountArchive = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
}));
jest.mock('@/lib/account-privacy', () => ({
  buildAccountArchive: (...args: unknown[]) => buildAccountArchive(...args),
}));

import { GET } from './route';

describe('account data export', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects anonymous downloads without loading data', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(buildAccountArchive).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  test('downloads only the authenticated account archive with secure headers', async () => {
    const user = { id: 'owner-1', email: 'owner@example.test' };
    requireAuthenticatedUser.mockResolvedValue({ user, supabase: {} });
    buildAccountArchive.mockResolvedValue({ schemaVersion: 1, account: { id: 'owner-1' } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(buildAccountArchive).toHaveBeenCalledWith(user);
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="waha-account-data-/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.json()).toEqual({ schemaVersion: 1, account: { id: 'owner-1' } });
  });

  test('refuses to emit a partial archive when any required query fails', async () => {
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'owner-1' }, supabase: {} });
    buildAccountArchive.mockRejectedValue(new Error('query failed'));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'تعذر تجهيز نسخة بياناتك كاملة. لم يتم تنزيل ملف ناقص.' });
  });

  test('streams a large Unicode archive without truncation, caching, or splitting an emoji', async () => {
    const content = 'بحث🙂 '.repeat(800_000);
    const archive = { schemaVersion: 4, research: { documents: [{ content }] } };
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'owner-1' }, supabase: {} });
    buildAccountArchive.mockResolvedValue(archive);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-transform');
    expect(response.headers.get('content-length')).toBeNull();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '', bytes = 0, chunks = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      expect(value.length).toBeLessThan(100_000);
      text += decoder.decode(value, { stream: true }); bytes += value.length; chunks += 1;
    }
    text += decoder.decode();
    expect(bytes).toBeGreaterThan(4.5 * 1024 * 1024);
    expect(chunks).toBeGreaterThan(1);
    expect(JSON.parse(text)).toEqual(archive);
  });

  test('serialisation errors return an error before any download bytes are sent', async () => {
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'owner-1' }, supabase: {} });
    buildAccountArchive.mockResolvedValue({ invalid: BigInt(1) });
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.headers.get('content-disposition')).toBeNull();
  });
});
