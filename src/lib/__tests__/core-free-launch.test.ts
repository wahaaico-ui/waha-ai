const mockAuth = jest.fn();
const mockOwns = jest.fn();
const mockFrom = jest.fn();
const mockGenerate = jest.fn();
const mockIntegration = jest.fn();
const mockCollections = jest.fn();
const mockItems = jest.fn();
const mockCookieSet = jest.fn();
const mockEncrypt = jest.fn<string, [unknown]>(() => 'encrypted-oauth-state');
const mockToken = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: () => mockAuth(), ownsProject: (...args: unknown[]) => mockOwns(...args) }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }) }));
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: (...args: unknown[]) => mockGenerate(...args) }));
jest.mock('@/lib/language/DeepLService', () => ({ DeepLService: { configured: () => false } }));
jest.mock('@/lib/language/MicrosoftTranslatorService', () => ({ MicrosoftTranslatorService: { configured: () => false } }));
jest.mock('@/lib/language/LanguageToolService', () => ({ LanguageToolService: { configured: () => false } }));
jest.mock('@/lib/integrations/zotero/server', () => ({ getZoteroIntegration: (...args: unknown[]) => mockIntegration(...args) }));
jest.mock('@/lib/integrations/zotero/client', () => ({ listZoteroCollections: (...args: unknown[]) => mockCollections(...args), listZoteroItems: (...args: unknown[]) => mockItems(...args), normalizeZoteroItem: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: async () => ({ set: mockCookieSet }) }));
jest.mock('@/lib/integrations/crypto', () => ({ encryptIntegrationSecret: (state: unknown) => mockEncrypt(state) }));
jest.mock('@/lib/integrations/zotero/oauth', () => ({ ZOTERO_AUTHORIZE_URL: 'https://www.zotero.org/oauth/authorize', requestZoteroToken: (...args: unknown[]) => mockToken(...args) }));

import { hasEntitlement, type Entitlement } from '@/lib/billing/entitlements';
import { POST as language } from '@/app/api/academic/language-tools/route';
import { GET as collections } from '@/app/api/integrations/zotero/collections/route';
import { GET as connect } from '@/app/api/integrations/zotero/connect/route';
import { POST as importItems } from '@/app/api/integrations/zotero/import/route';

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production', WAHA_CORE_FREE_LAUNCH: 'true', ALLOW_DEV_ENTITLEMENTS: 'false' });
  process.env.ZOTERO_CLIENT_KEY = 'fixture-client';
  process.env.ZOTERO_CLIENT_SECRET = 'fixture-secret';
  process.env.INTEGRATIONS_ENCRYPTION_KEY = 'fixture-encryption-key-at-least-32-characters';
  mockAuth.mockResolvedValue({ user: { id: 'ordinary-user' }, supabase: {} });
  mockOwns.mockResolvedValue(true);
  mockGenerate.mockResolvedValue({ output: 'Edited academic text (Author, 2024), 42.' });
  mockIntegration.mockResolvedValue({ external_user_id: 'z-user', secret: { apiKey: 'test-only-key' } });
  mockCollections.mockResolvedValue([{ key: 'c1', data: { name: 'Research' } }]);
  mockToken.mockResolvedValue({ oauth_token: 'request-token', oauth_token_secret: 'test-only-secret' });
});
afterEach(() => jest.restoreAllMocks());

test.each(['academic_language_tools', 'zotero_sync'] as const)('free launch grants %s without any subscription lookup', async (feature) => {
  expect(await hasEntitlement('ordinary-user', feature)).toBe(true);
  expect(mockFrom).not.toHaveBeenCalled();
});
test('free launch defaults on, refuses an empty identity, and grants no other feature', async () => {
  delete process.env.WAHA_CORE_FREE_LAUNCH;
  expect(await hasEntitlement('ordinary-user', 'zotero_sync')).toBe(true);
  expect(await hasEntitlement('', 'zotero_sync')).toBe(false);
  const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), maybeSingle: async () => ({ data: null, error: null }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.in.mockReturnValue(query); mockFrom.mockReturnValue(query);
  expect(await hasEntitlement('ordinary-user', 'billing' as Entitlement)).toBe(false);
});
test('explicit opt-out keeps existing subscription policy, not a production dev override', async () => {
  process.env.WAHA_CORE_FREE_LAUNCH = 'false'; process.env.ALLOW_DEV_ENTITLEMENTS = 'true';
  const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), maybeSingle: async () => ({ data: null, error: null }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.in.mockReturnValue(query); mockFrom.mockReturnValue(query);
  expect(await hasEntitlement('ordinary-user', 'zotero_sync')).toBe(false);
  expect(mockFrom).toHaveBeenCalledWith('subscriptions');
});

const request = (body: unknown) => new Request('https://waha.test/api/academic/language-tools', { method: 'POST', body: JSON.stringify(body) });
test.each(['translate', 'proofread'])('ordinary authenticated users can %s with citation-preserving instructions', async (operation) => {
  const response = await language(request({ operation, targetLanguage: 'en', text: 'An academic observation (Author, 2024), 42.' }));
  expect(response.status).toBe(200);
  expect(mockGenerate.mock.calls[0][0].prompt).toContain('Preserve names, numbers, citations, DOI');
  expect(mockFrom).not.toHaveBeenCalled();
});
test.each([['short', 400], ['x'.repeat(12001), 413]])('free access retains text limits (%s)', async (text, status) => {
  const response = await language(request({ operation: 'proofread', targetLanguage: 'en', text }));
  expect(response.status).toBe(status);
  expect(mockGenerate).not.toHaveBeenCalled();
});
test('free access retains authentication for language, collections, import and OAuth', async () => {
  mockAuth.mockResolvedValue(null);
  expect((await language(request({}))).status).toBe(401);
  expect((await collections()).status).toBe(401);
  expect((await importItems(request({ projectId: 'p' }))).status).toBe(401);
  expect((await connect(new Request('https://waha.test/api/integrations/zotero/connect'))).headers.get('location')).toBe('https://waha.test/login');
  expect(mockToken).not.toHaveBeenCalled(); expect(mockIntegration).not.toHaveBeenCalled();
});
test('free Zotero still requires a connected integration and returns no credentials', async () => {
  const response = await collections();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ collections: [{ key: 'c1', name: 'Research', parentCollection: null }] });
  expect(mockIntegration).toHaveBeenCalledWith('ordinary-user');
  mockIntegration.mockResolvedValue(null);
  expect((await collections()).status).toBe(409);
});
test('free Zotero import refuses cross-project access before reading credentials or writing', async () => {
  mockOwns.mockResolvedValue(false);
  expect((await importItems(request({ projectId: '81000000-0000-0000-0000-000000000099' }))).status).toBe(404);
  expect(mockIntegration).not.toHaveBeenCalled(); expect(mockItems).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
test('free Zotero OAuth preserves read-only consent and encrypted user-bound state', async () => {
  const response = await connect(new Request('https://waha.test/api/integrations/zotero/connect'));
  const location = new URL(response.headers.get('location')!);
  expect(location.origin).toBe('https://www.zotero.org');
  expect(location.searchParams.get('write_access')).toBe('0');
  expect(mockEncrypt).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ordinary-user', oauthTokenSecret: 'test-only-secret' }));
  expect(mockCookieSet).toHaveBeenCalledWith('waha_zotero_oauth', 'encrypted-oauth-state', expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }));
});
