import { createHmac, randomBytes } from 'node:crypto';

const REQUEST_TOKEN_URL = 'https://www.zotero.org/oauth/request';
const ACCESS_TOKEN_URL = 'https://www.zotero.org/oauth/access';
export const ZOTERO_AUTHORIZE_URL = 'https://www.zotero.org/oauth/authorize';

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthHeader(method: string, url: string, extra: Record<string, string>, tokenSecret = '') {
  const clientKey = process.env.ZOTERO_CLIENT_KEY;
  const clientSecret = process.env.ZOTERO_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error('Zotero OAuth credentials are not configured');

  const oauth: Record<string, string> = {
    oauth_consumer_key: clientKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...extra,
  };
  const normalized = Object.entries(oauth)
    .filter(([name]) => name !== 'oauth_signature')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .join('&');
  const signatureBase = [method.toUpperCase(), encode(url), encode(normalized)].join('&');
  oauth.oauth_signature = createHmac('sha1', `${encode(clientSecret)}&${encode(tokenSecret)}`)
    .update(signatureBase)
    .digest('base64');

  return `OAuth ${Object.entries(oauth).map(([name, value]) => `${encode(name)}="${encode(value)}"`).join(', ')}`;
}

async function postOAuth(url: string, extra: Record<string, string>, tokenSecret = '') {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', url, extra, tokenSecret) },
    cache: 'no-store',
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Zotero OAuth request failed (${response.status})`);
  return Object.fromEntries(new URLSearchParams(body));
}

export function requestZoteroToken(callbackUrl: string) {
  return postOAuth(REQUEST_TOKEN_URL, { oauth_callback: callbackUrl });
}

export function exchangeZoteroToken(oauthToken: string, oauthTokenSecret: string, verifier: string) {
  return postOAuth(ACCESS_TOKEN_URL, { oauth_token: oauthToken, oauth_verifier: verifier }, oauthTokenSecret);
}
