const requireAuthenticatedUser = jest.fn();
const verifyAccountDeletion = jest.fn();
const permanentlyDeleteAccount = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
}));
jest.mock('@/lib/account-privacy', () => ({
  verifyAccountDeletion: (...args: unknown[]) => verifyAccountDeletion(...args),
  permanentlyDeleteAccount: (...args: unknown[]) => permanentlyDeleteAccount(...args),
}));

import { DELETE } from './route';

const confirmation = 'حذف حسابي نهائياً';
const user = { id: 'owner-1', app_metadata: { providers: ['email'] } };
const supabase = { auth: { getSession: jest.fn() } };

function request(body: unknown) {
  return new Request('https://waha.systems/api/account/delete', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('permanent account deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue({ user, supabase });
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
  });

  test('rejects anonymous deletion before parsing or mutating', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await DELETE(request({ confirmation }));
    expect(response.status).toBe(401);
    expect(verifyAccountDeletion).not.toHaveBeenCalled();
    expect(permanentlyDeleteAccount).not.toHaveBeenCalled();
  });

  test('requires the exact irreversible-action phrase', async () => {
    const response = await DELETE(request({ confirmation: 'احذف' }));
    expect(response.status).toBe(400);
    expect(verifyAccountDeletion).not.toHaveBeenCalled();
  });

  test('requires successful reauthentication', async () => {
    verifyAccountDeletion.mockResolvedValue(false);
    const response = await DELETE(request({ confirmation, password: 'wrong password' }));
    expect(response.status).toBe(403);
    expect(permanentlyDeleteAccount).not.toHaveBeenCalled();
  });

  test('revokes and deletes only the authenticated user after verification', async () => {
    verifyAccountDeletion.mockResolvedValue(true);
    permanentlyDeleteAccount.mockResolvedValue(undefined);
    const response = await DELETE(request({ confirmation, password: 'valid password' }));
    expect(response.status).toBe(200);
    expect(verifyAccountDeletion).toHaveBeenCalledWith(user, 'valid password', supabase);
    expect(permanentlyDeleteAccount).toHaveBeenCalledWith('owner-1', 'session-token');
    expect(await response.json()).toEqual({ deleted: true });
  });

  test('does not claim success when an active subscription blocks deletion', async () => {
    verifyAccountDeletion.mockResolvedValue(true);
    permanentlyDeleteAccount.mockRejectedValue(new Error('ACCOUNT_DELETE_ACTIVE_SUBSCRIPTION'));
    const response = await DELETE(request({ confirmation, password: 'valid password' }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('اشتراك نشط');
  });
});
