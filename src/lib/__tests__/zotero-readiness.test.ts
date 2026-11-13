const mockAuth = jest.fn();
const mockEntitlement = jest.fn();
const mockFrom = jest.fn();
const mockCookieSet = jest.fn();
const mockToken = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: () => mockAuth() }));
jest.mock('@/lib/billing/entitlements', () => ({ hasEntitlement: (...args: unknown[]) => mockEntitlement(...args), hasPaidPlan: jest.fn().mockResolvedValue(false) }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }) }));
jest.mock('next/headers', () => ({ cookies: async () => ({ set: mockCookieSet }) }));
jest.mock('@/lib/integrations/crypto', () => ({ encryptIntegrationSecret: () => 'encrypted-test-state' }));
jest.mock('@/lib/integrations/zotero/oauth', () => ({ ZOTERO_AUTHORIZE_URL: 'https://www.zotero.org/oauth/authorize', requestZoteroToken: (...args: unknown[]) => mockToken(...args) }));

import { GET as status } from '@/app/api/integrations/zotero/status/route';
import { GET as connect } from '@/app/api/integrations/zotero/connect/route';

function storedIntegration(data: unknown, error: unknown = null) {
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: async () => ({ data, error }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  mockFrom.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production', ZOTERO_CLIENT_KEY: '', ZOTERO_CLIENT_SECRET: '', INTEGRATIONS_ENCRYPTION_KEY: 'fixture-encryption-secret-at-least-32-characters' });
  mockAuth.mockResolvedValue({ user: { id: 'owned-user' } });
  mockEntitlement.mockResolvedValue(true);
  mockToken.mockResolvedValue({ oauth_token: 'fixture-token', oauth_token_secret: 'fixture-secret' });
  storedIntegration(null);
});
afterEach(() => jest.restoreAllMocks());

test('authenticated status reports missing OAuth configuration rather than advertising a usable connect button', async () => {
  const response = await status();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ entitled: true, configured: false, integration: null });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

test('database read failure is a retryable error, never an apparently disconnected account', async () => {
  storedIntegration(null, { message: 'private database error details' });
  const response = await status();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private database error details');
});

test('missing OAuth credentials redirect to an explanatory settings state before contacting Zotero', async () => {
  mockToken.mockRejectedValue(new Error('Zotero OAuth credentials are not configured'));
  const response = await connect(new Request('https://waha.test/api/integrations/zotero/connect'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://waha.test/settings/integrations?zotero=unavailable');
  expect(mockToken).not.toHaveBeenCalled();
  expect(mockCookieSet).not.toHaveBeenCalled();
});

test('provider failure returns a recoverable settings state without leaking error details or writing OAuth state', async () => {
  process.env.ZOTERO_CLIENT_KEY = 'fixture-client'; process.env.ZOTERO_CLIENT_SECRET = 'fixture-secret';
  mockToken.mockRejectedValue(new Error('private provider credentials must not be rendered'));
  const response = await connect(new Request('https://waha.test/api/integrations/zotero/connect'));
  expect(response.headers.get('location')).toBe('https://waha.test/settings/integrations?zotero=error');
  expect(mockCookieSet).not.toHaveBeenCalled();
});

test('unauthenticated requests disclose no integration configuration or account status', async () => {
  mockAuth.mockResolvedValue(null);
  expect((await status()).status).toBe(401);
  expect((await connect(new Request('https://waha.test/api/integrations/zotero/connect'))).headers.get('location')).toBe('https://waha.test/login');
  expect(mockFrom).not.toHaveBeenCalled(); expect(mockToken).not.toHaveBeenCalled();
});
