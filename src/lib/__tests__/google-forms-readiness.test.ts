const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
const cookieGet = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({ get: cookieGet }) }));

import { GET } from '@/app/api/integrations/google-forms/status/route';
import { encryptIntegrationSecret } from '@/lib/integrations/crypto';
import { isGoogleFormsOAuthConfigured } from '@/lib/integrations/configuration';
import { readGoogleFormsReceipt, safeGoogleFormsResponderUri, type GoogleFormsReceipt } from '@/lib/integrations/google-forms/receipt';

const originalEnvironment = { ...process.env };
const projectId = 'eb52bade-75cb-4bd0-a1d3-d5681650a00e';
const receipt: GoogleFormsReceipt = { userId: 'user-a', projectId, formId: 'verified_form_123456', responderUri: 'https://docs.google.com/forms/d/e/verified/viewform', expiresAt: Date.now() + 60_000 };
const request = () => new Request(`https://waha.test/api/integrations/google-forms/status?projectId=${projectId}&googleForm=created&formId=forged_form_123456`);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.INTEGRATIONS_ENCRYPTION_KEY = 'fixture-only-encryption-key-longer-than-32';
  delete process.env.GOOGLE_FORMS_CLIENT_ID; delete process.env.GOOGLE_FORMS_CLIENT_SECRET;
  requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' }, supabase: {} });
  ownsProject.mockResolvedValue(true); cookieGet.mockReturnValue(undefined);
});
afterAll(() => { process.env = originalEnvironment; });

test('missing keys and forged success parameters yield no form or secret values', async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ configured: false, form: null });
});

test('requires authentication and ownership before reading a receipt', async () => {
  requireAuthenticatedUser.mockResolvedValueOnce(null);
  expect((await GET(request())).status).toBe(401);
  expect(cookieGet).not.toHaveBeenCalled();
  ownsProject.mockResolvedValueOnce(false);
  expect((await GET(request())).status).toBe(403);
  expect(cookieGet).not.toHaveBeenCalled();
});

test('rejects malformed project identifiers without a database read', async () => {
  const response = await GET(new Request('https://waha.test/api/integrations/google-forms/status?projectId=invalid'));
  expect(response.status).toBe(403); expect(ownsProject).not.toHaveBeenCalled();
});

test('accepts only an encrypted unexpired receipt belonging to this user and project', async () => {
  cookieGet.mockReturnValue({ value: encryptIntegrationSecret(receipt) });
  expect((await (await GET(request())).json()).form).toEqual({ formId: receipt.formId, editUrl: `https://docs.google.com/forms/d/${receipt.formId}/edit`, responderUri: receipt.responderUri });
  for (const invalid of [{ ...receipt, userId: 'another-user' }, { ...receipt, projectId: 'another-project' }, { ...receipt, expiresAt: Date.now() - 1 }, { ...receipt, formId: '../../unsafe' }]) {
    expect(readGoogleFormsReceipt(encryptIntegrationSecret(invalid), 'user-a', projectId)).toBeNull();
  }
  const encrypted = encryptIntegrationSecret(receipt);
  const tampered = encrypted.split('.'); tampered[1] = 'AAAAAAAAAAAAAAAAAAAAAA';
  expect(readGoogleFormsReceipt(tampered.join('.'), 'user-a', projectId)).toBeNull();
});

test('does not allow external, credential-bearing or non-form result links', () => {
  for (const uri of ['javascript:alert(1)', 'https://docs.google.com.evil.test/forms/', 'https://user:pass@docs.google.com/forms/', 'https://docs.google.com/document/d/other']) {
    expect(safeGoogleFormsResponderUri(uri)).toBeNull();
  }
});

test('configuration requires both client values and the encryption key', () => {
  expect(isGoogleFormsOAuthConfigured()).toBe(false);
  process.env.GOOGLE_FORMS_CLIENT_ID = 'client'; process.env.GOOGLE_FORMS_CLIENT_SECRET = 'secret';
  expect(isGoogleFormsOAuthConfigured()).toBe(true);
  process.env.INTEGRATIONS_ENCRYPTION_KEY = 'short'; expect(isGoogleFormsOAuthConfigured()).toBe(false);
});

test('storage or authentication failures return a private generic recoverable response', async () => {
  ownsProject.mockRejectedValueOnce(new Error('private database host'));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.text()).not.toContain('private database host');
});
