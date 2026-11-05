const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
const readApprovedQuestionnaire = jest.fn();
const createGoogleForm = jest.fn();
const exchangeGoogleFormsCode = jest.fn();
const cookieGet = jest.fn();
const cookieSet = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args), ownsProject: (...args: unknown[]) => ownsProject(...args) }));
jest.mock('@/lib/integrations/google-forms/server', () => ({ readApprovedQuestionnaire: (...args: unknown[]) => readApprovedQuestionnaire(...args) }));
jest.mock('@/lib/integrations/google-forms/client', () => ({ createGoogleForm: (...args: unknown[]) => createGoogleForm(...args) }));
jest.mock('@/lib/integrations/google-forms/oauth', () => ({
  GOOGLE_FORMS_SCOPE: 'https://www.googleapis.com/auth/forms.body',
  googleFormsOAuthConfig: () => ({ clientId: 'fixture', clientSecret: 'fixture' }),
  exchangeGoogleFormsCode: (...args: unknown[]) => exchangeGoogleFormsCode(...args),
}));
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({ get: cookieGet, set: cookieSet }) }));

import { GET } from './route';
import { encryptIntegrationSecret } from '@/lib/integrations/crypto';
import { GOOGLE_FORMS_RECEIPT_COOKIE, readGoogleFormsReceipt } from '@/lib/integrations/google-forms/receipt';

const originalEnvironment = { ...process.env };
const projectId = 'eb52bade-75cb-4bd0-a1d3-d5681650a00e';
const oauthState = () => ({ userId: 'user-a', projectId, state: 'opaque-state', expiresAt: Date.now() + 60_000 });
const request = () => new Request('https://waha.test/api/integrations/google-forms/callback?code=fixture-code&state=opaque-state');
const successfulReceipt = () => cookieSet.mock.calls.find(([name, value, options]) => name === GOOGLE_FORMS_RECEIPT_COOKIE && value && options.maxAge > 0);
beforeEach(() => {
  jest.clearAllMocks();
  process.env.INTEGRATIONS_ENCRYPTION_KEY = 'fixture-only-encryption-key-longer-than-32';
  requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' }, supabase: {} }); ownsProject.mockResolvedValue(true);
  readApprovedQuestionnaire.mockResolvedValue({ title: 'Approved questionnaire fixture' });
  cookieGet.mockReturnValue({ value: encryptIntegrationSecret(oauthState()) });
  exchangeGoogleFormsCode.mockResolvedValue({ accessToken: 'fixture-token', scope: 'https://www.googleapis.com/auth/forms.body' });
  createGoogleForm.mockResolvedValue({ formId: 'verified_form_123456', responderUri: 'https://docs.google.com/forms/d/e/verified/viewform' });
});
afterAll(() => { process.env = originalEnvironment; });

test('only provider success produces an encrypted user/project receipt with no token or result query parameters', async () => {
  const response = await GET(request());
  const url = new URL(response.headers.get('location')!);
  expect(url.searchParams.get('googleForm')).toBe('created');
  expect(url.searchParams.has('formId')).toBe(false);
  expect(url.searchParams.has('responderUri')).toBe(false);
  const stored = successfulReceipt()!;
  expect(stored[2]).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/api/integrations/google-forms/status' });
  expect(stored[1]).not.toContain('fixture-token');
  expect(readGoogleFormsReceipt(stored[1], 'user-a', projectId)?.formId).toBe('verified_form_123456');
  expect(cookieSet).toHaveBeenCalledWith('waha_google_forms_oauth', '', expect.objectContaining({ maxAge: 0, path: '/api/integrations/google-forms/callback' }));
});

test.each(['user', 'state', 'expiry'])('invalid OAuth %s never creates a form or success receipt', async (invalid) => {
  const state = oauthState();
  if (invalid === 'user') state.userId = 'another-user';
  if (invalid === 'state') state.state = 'different-state';
  if (invalid === 'expiry') state.expiresAt = Date.now() - 1;
  cookieGet.mockReturnValue({ value: encryptIntegrationSecret(state) });
  const response = await GET(request());
  expect(response.headers.get('location')).toContain('googleForm=error');
  expect(exchangeGoogleFormsCode).not.toHaveBeenCalled(); expect(createGoogleForm).not.toHaveBeenCalled();
  expect(successfulReceipt()).toBeUndefined();
});

test('missing required scope never sends the questionnaire to Google', async () => {
  exchangeGoogleFormsCode.mockResolvedValueOnce({ accessToken: 'fixture-token', scope: 'other-scope' });
  expect((await GET(request())).headers.get('location')).toContain('googleForm=error');
  expect(createGoogleForm).not.toHaveBeenCalled(); expect(successfulReceipt()).toBeUndefined();
});

test('provider or creation failure invalidates prior receipt without claiming success or leaking details', async () => {
  createGoogleForm.mockRejectedValueOnce(new Error('private token and provider payload'));
  const response = await GET(request());
  expect(response.headers.get('location')).toContain('googleForm=error');
  expect(response.headers.get('location')).not.toContain('private');
  expect(cookieSet).toHaveBeenCalledWith(GOOGLE_FORMS_RECEIPT_COOKIE, '', expect.objectContaining({ maxAge: 0, path: '/api/integrations/google-forms/status' }));
  expect(successfulReceipt()).toBeUndefined();
});

test('unauthenticated callback cannot read cookies, create forms or issue receipts', async () => {
  requireAuthenticatedUser.mockResolvedValueOnce(null);
  expect((await GET(request())).headers.get('location')).toBe('https://waha.test/login');
  expect(cookieGet).not.toHaveBeenCalled(); expect(createGoogleForm).not.toHaveBeenCalled(); expect(cookieSet).not.toHaveBeenCalled();
});
