import { buildGoogleFormsAuthorizationUrl, exchangeGoogleFormsCode, googleFormsOAuthConfig, GOOGLE_FORMS_SCOPE } from '@/lib/integrations/google-forms/oauth';

const originalFetch = global.fetch;
const originalEnvironment = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_FORMS_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_FORMS_CLIENT_SECRET = 'google-client-secret';
  process.env.GOOGLE_FORMS_CALLBACK_URL = 'https://waha-ai.vercel.app/api/integrations/google-forms/callback';
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnvironment };
  jest.restoreAllMocks();
});

describe('Google Forms OAuth', () => {
  test('requests only the Forms body scope and preserves CSRF state', () => {
    const config = googleFormsOAuthConfig('https://waha-ai.vercel.app');
    const url = buildGoogleFormsAuthorizationUrl(config, 'csrf-state');
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe(GOOGLE_FORMS_SCOPE);
    expect(url.searchParams.get('state')).toBe('csrf-state');
    expect(url.searchParams.get('access_type')).toBe('online');
  });

  test('exchanges the code server-side without returning a refresh token', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'one-time-token',
      expires_in: 3600,
      scope: GOOGLE_FORMS_SCOPE,
      token_type: 'Bearer',
    }), { status: 200 }));
    const token = await exchangeGoogleFormsCode('authorization-code', googleFormsOAuthConfig('https://waha-ai.vercel.app'));
    expect(token).toEqual({ accessToken: 'one-time-token', expiresIn: 3600, scope: GOOGLE_FORMS_SCOPE });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(init.body)).toContain('grant_type=authorization_code');
    expect(String(init.body)).not.toContain('access_type');
  });

  test('rejects an insecure production callback', () => {
    process.env.GOOGLE_FORMS_CALLBACK_URL = 'http://example.com/callback';
    expect(() => googleFormsOAuthConfig('https://waha-ai.vercel.app')).toThrow('must use HTTPS');
  });
});
