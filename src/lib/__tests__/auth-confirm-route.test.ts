const verifyOtp = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { verifyOtp },
  })),
}));

import { GET } from '@/app/auth/confirm/route';

describe('auth token-hash confirmation route', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    verifyOtp.mockReset();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('verifies a signup token and returns to the confirmed-email page', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(new Request(
      'https://waha-ai.vercel.app/auth/confirm?token_hash=signup-hash&type=email&next=/email-confirmed%3Fnext%3D%252Fverify-idea',
    ));

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: 'signup-hash',
      type: 'email',
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://waha-ai.vercel.app/email-confirmed?next=%2Fverify-idea',
    );
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  test('verifies recovery across browsers without a PKCE verifier cookie', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(new Request(
      'https://waha-ai.vercel.app/auth/confirm?token_hash=recovery-hash&type=recovery',
    ));

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: 'recovery-hash',
      type: 'recovery',
    });
    expect(response.headers.get('location')).toBe(
      'https://waha-ai.vercel.app/reset-password',
    );
  });

  test('keeps invalid recovery tokens inside the recovery flow', async () => {
    verifyOtp.mockResolvedValue({ error: new Error('expired') });

    const response = await GET(new Request(
      'https://waha-ai.vercel.app/auth/confirm?token_hash=expired&type=recovery',
    ));

    expect(response.headers.get('location')).toBe(
      'https://waha-ai.vercel.app/reset-password?error=invalid-or-expired',
    );
    expect(consoleError).toHaveBeenCalledWith(
      '[auth/confirm] token verification failed',
      expect.objectContaining({ type: 'recovery' }),
    );
  });

  test('rejects external and unapproved destinations', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(new Request(
      'https://waha-ai.vercel.app/auth/confirm?token_hash=signup-hash&type=email&next=https%3A%2F%2Fevil.example',
    ));

    expect(response.headers.get('location')).toBe(
      'https://waha-ai.vercel.app/email-confirmed',
    );
  });
});
