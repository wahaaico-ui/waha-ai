import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { encryptIntegrationSecret } from '@/lib/integrations/crypto';
import { requestZoteroToken, ZOTERO_AUTHORIZE_URL } from '@/lib/integrations/zotero/oauth';
import { isZoteroOAuthConfigured } from '@/lib/integrations/configuration';

export async function GET(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.redirect(new URL('/login', request.url));
  if (!(await hasEntitlement(access.user.id, 'zotero_sync'))) {
    return NextResponse.redirect(new URL('/pricing?required=zotero', request.url));
  }

  if (!isZoteroOAuthConfigured()) {
    return NextResponse.redirect(new URL('/settings/integrations?zotero=unavailable', request.url));
  }

  try {
    const callbackUrl = process.env.ZOTERO_CALLBACK_URL || new URL('/api/integrations/zotero/callback', request.url).toString();
    const token = await requestZoteroToken(callbackUrl);
    if (!token.oauth_token || !token.oauth_token_secret) throw new Error('Incomplete request token');

    const cookieStore = await cookies();
    cookieStore.set('waha_zotero_oauth', encryptIntegrationSecret({
      userId: access.user.id,
      oauthToken: token.oauth_token,
      oauthTokenSecret: token.oauth_token_secret,
      expiresAt: Date.now() + 10 * 60 * 1000,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/integrations/zotero/callback',
      maxAge: 600,
    });

    const authorize = new URL(ZOTERO_AUTHORIZE_URL);
    authorize.searchParams.set('oauth_token', token.oauth_token);
    authorize.searchParams.set('name', 'WAHA');
    authorize.searchParams.set('library_access', '1');
    authorize.searchParams.set('notes_access', '0');
    authorize.searchParams.set('write_access', '0');
    authorize.searchParams.set('all_groups', 'read');
    return NextResponse.redirect(authorize);
  } catch {
    return NextResponse.redirect(new URL('/settings/integrations?zotero=error', request.url));
  }
}
