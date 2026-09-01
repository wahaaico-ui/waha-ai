const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const GOOGLE_FORMS_SCOPE = 'https://www.googleapis.com/auth/forms.body';

type GoogleFormsOAuthConfig = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

type GoogleTokenResponse = {
  accessToken: string;
  expiresIn: number;
  scope: string;
};

function requiredEnvironmentValue(name: 'GOOGLE_FORMS_CLIENT_ID' | 'GOOGLE_FORMS_CLIENT_SECRET') {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function googleFormsOAuthConfig(requestUrl: string): GoogleFormsOAuthConfig {
  const callbackUrl = process.env.GOOGLE_FORMS_CALLBACK_URL?.trim()
    || new URL('/api/integrations/google-forms/callback', requestUrl).toString();
  const parsedCallback = new URL(callbackUrl);
  if (parsedCallback.protocol !== 'https:' && parsedCallback.hostname !== 'localhost') {
    throw new Error('GOOGLE_FORMS_CALLBACK_URL must use HTTPS');
  }
  return {
    clientId: requiredEnvironmentValue('GOOGLE_FORMS_CLIENT_ID'),
    clientSecret: requiredEnvironmentValue('GOOGLE_FORMS_CLIENT_SECRET'),
    callbackUrl: parsedCallback.toString(),
  };
}

export function buildGoogleFormsAuthorizationUrl(config: GoogleFormsOAuthConfig, state: string) {
  const authorize = new URL(GOOGLE_AUTHORIZATION_URL);
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', config.callbackUrl);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', GOOGLE_FORMS_SCOPE);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('include_granted_scopes', 'true');
  authorize.searchParams.set('access_type', 'online');
  authorize.searchParams.set('prompt', 'select_account');
  return authorize;
}

export async function exchangeGoogleFormsCode(code: string, config: GoogleFormsOAuthConfig): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Google token exchange failed');
  }
  const value = payload as Record<string, unknown>;
  if (typeof value.access_token !== 'string' || !value.access_token) {
    throw new Error('Google did not return an access token');
  }
  return {
    accessToken: value.access_token,
    expiresIn: typeof value.expires_in === 'number' ? value.expires_in : 0,
    scope: typeof value.scope === 'string' ? value.scope : '',
  };
}
