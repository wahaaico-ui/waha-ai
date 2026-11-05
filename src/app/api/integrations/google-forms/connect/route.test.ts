const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
const readApprovedQuestionnaire = jest.fn();
const buildGoogleFormsAuthorizationUrl = jest.fn();
const googleFormsOAuthConfig = jest.fn();
const encryptIntegrationSecret = jest.fn();
const cookieSet = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

jest.mock('@/lib/integrations/google-forms/server', () => ({
  readApprovedQuestionnaire: (...args: unknown[]) => readApprovedQuestionnaire(...args),
}));

jest.mock('@/lib/integrations/google-forms/oauth', () => ({
  buildGoogleFormsAuthorizationUrl: (...args: unknown[]) => buildGoogleFormsAuthorizationUrl(...args),
  googleFormsOAuthConfig: (...args: unknown[]) => googleFormsOAuthConfig(...args),
}));

jest.mock('@/lib/integrations/crypto', () => ({
  encryptIntegrationSecret: (...args: unknown[]) => encryptIntegrationSecret(...args),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ set: cookieSet }),
}));

import { GET } from './route';

const projectId = 'eb52bade-75cb-4bd0-a1d3-d5681650a00e';
const access = {
  user: { id: 'user-a', email: 'owner@example.test', user_metadata: {} },
  supabase: { from: jest.fn() },
};
const originalEnvironment = { ...process.env };
afterAll(() => { process.env = originalEnvironment; });

describe('Google Forms OAuth connect route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_FORMS_CLIENT_ID = 'fixture-client';
    process.env.GOOGLE_FORMS_CLIENT_SECRET = 'fixture-secret';
    process.env.INTEGRATIONS_ENCRYPTION_KEY = 'fixture-encryption-key-at-least-32-chars';
    googleFormsOAuthConfig.mockReturnValue({ clientId: 'client', clientSecret: 'secret', callbackUrl: 'https://waha.test/api/integrations/google-forms/callback' });
    buildGoogleFormsAuthorizationUrl.mockReturnValue(new URL('https://accounts.google.com/o/oauth2/v2/auth?state=opaque'));
    encryptIntegrationSecret.mockReturnValue('encrypted-state');
    readApprovedQuestionnaire.mockResolvedValue({ title: 'استبانة معتمدة' });
  });

  test('redirects an unauthenticated visitor before reading a project', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await GET(new Request(`https://waha.test/api/integrations/google-forms/connect?projectId=${projectId}`));
    expect(response.headers.get('location')).toBe('https://waha.test/login');
    expect(ownsProject).not.toHaveBeenCalled();
    expect(readApprovedQuestionnaire).not.toHaveBeenCalled();
  });

  test('never starts Google authorization for another user project', async () => {
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(false);
    const response = await GET(new Request(`https://waha.test/api/integrations/google-forms/connect?projectId=${projectId}`));
    expect(response.headers.get('location')).toContain('googleForm=forbidden');
    expect(ownsProject).toHaveBeenCalledWith(projectId, 'user-a', access.supabase);
    expect(readApprovedQuestionnaire).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  test('stores only encrypted short-lived state before redirecting the owner to Google', async () => {
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);
    const response = await GET(new Request(`https://waha.test/api/integrations/google-forms/connect?projectId=${projectId}`));
    expect(response.headers.get('location')).toContain('accounts.google.com');
    expect(readApprovedQuestionnaire).toHaveBeenCalledWith(projectId, access.supabase);
    expect(cookieSet).toHaveBeenCalledWith('waha_google_forms_oauth', 'encrypted-state', expect.objectContaining({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
    }));
  });

  test('missing configuration never reads or sends the questionnaire or sets OAuth state', async () => {
    requireAuthenticatedUser.mockResolvedValue(access); ownsProject.mockResolvedValue(true);
    delete process.env.GOOGLE_FORMS_CLIENT_SECRET;
    const response = await GET(new Request(`https://waha.test/api/integrations/google-forms/connect?projectId=${projectId}`));
    expect(response.headers.get('location')).toContain('googleForm=config');
    expect(readApprovedQuestionnaire).not.toHaveBeenCalled();
    expect(buildGoogleFormsAuthorizationUrl).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  test('a storage error is reported as a recoverable error without exposing its details', async () => {
    requireAuthenticatedUser.mockResolvedValue(access); ownsProject.mockResolvedValue(true);
    readApprovedQuestionnaire.mockRejectedValueOnce(new Error('private-database-details'));
    const response = await GET(new Request(`https://waha.test/api/integrations/google-forms/connect?projectId=${projectId}`));
    expect(response.headers.get('location')).toContain('googleForm=error');
    expect(response.headers.get('location')).not.toContain('private-database-details');
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
