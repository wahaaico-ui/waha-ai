const createClient = jest.fn();

jest.mock('@/lib/supabase/server', () => ({ createClient: (...args: unknown[]) => createClient(...args) }));

import { POST } from './route';

const signInWithPassword = jest.fn();
const getAuthenticatorAssuranceLevel = jest.fn();
const request = (body: unknown) => new Request('https://waha.systems/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('server-backed password login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createClient.mockResolvedValue({ auth: { signInWithPassword, mfa: { getAuthenticatorAssuranceLevel } } });
    signInWithPassword.mockResolvedValue({ error: null });
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } });
  });

  it('rejects malformed credentials before calling Supabase', async () => {
    const response = await POST(request({ email: 'bad', password: '' }));
    expect(response.status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('does not expose provider errors for invalid credentials', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('private provider detail') });
    const response = await POST(request({ email: 'USER@example.com', password: 'wrong' }));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('private provider detail');
  });

  it('normalizes email and reports the MFA gate', async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' } });
    const response = await POST(request({ email: ' User@Example.com ', password: 'secret' }));
    expect(response.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret' });
    expect(await response.json()).toEqual({ authenticated: true, needsMfa: true });
  });
});
