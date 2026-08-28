const exchangeCodeForSession = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { exchangeCodeForSession },
  })),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    getAll: jest.fn(() => []),
    set: jest.fn(),
  })),
}));

import { GET } from '@/app/auth/callback/route';

describe('auth callback route', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
  });

  test('exchanges a recovery code and preserves the flow id', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(new Request(
      'https://waha-ai.vercel.app/auth/callback?code=recovery-code&sb_flow_id=flow-1&next=/reset-password',
    ));

    expect(exchangeCodeForSession).toHaveBeenCalledWith('recovery-code', { flowId: 'flow-1' });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://waha-ai.vercel.app/reset-password');
  });

  test('keeps a failed recovery inside the recovery flow', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });

    const response = await GET(new Request(
      'https://waha-ai.vercel.app/auth/callback?code=expired&next=/reset-password',
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://waha-ai.vercel.app/reset-password?error=invalid-or-expired',
    );
  });

  test('rejects a removed project-creation destination', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(new Request(
      'https://waha-ai.vercel.app/auth/callback?code=oauth-code&next=/projects/create',
    ));

    expect(response.headers.get('location')).toBe('https://waha-ai.vercel.app/dashboard');
  });
});
