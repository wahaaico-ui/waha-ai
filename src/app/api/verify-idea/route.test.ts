const requireAuthenticatedUser = jest.fn();
const requestFingerprint = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
}));

jest.mock('@/proxy', () => ({
  requestFingerprint: (...args: unknown[]) => requestFingerprint(...args),
}));

import { NextRequest } from 'next/server';
import { POST } from './route';

describe('verify idea route validation and correlation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requestFingerprint.mockResolvedValue('anonymous-fingerprint');
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('rejects malformed JSON as a client error with the same request ID', async () => {
    const response = await POST(new NextRequest('https://waha.systems/api/verify-idea', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'verify-request-1' },
      body: '{',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.requestId).toBe('verify-request-1');
    expect(response.headers.get('x-waha-request-id')).toBe(body.requestId);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(requireAuthenticatedUser).not.toHaveBeenCalled();
  });

  test('rejects a short topic before authentication or provider calls', async () => {
    const response = await POST(new NextRequest('https://waha.systems/api/verify-idea', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'AI' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(JSON.stringify([
      ...(console.log as jest.Mock).mock.calls,
      ...(console.warn as jest.Mock).mock.calls,
      ...(console.error as jest.Mock).mock.calls,
    ])).not.toContain('AI');
  });
});
