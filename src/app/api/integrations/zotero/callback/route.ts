import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '@/lib/integrations/crypto';
import { exchangeZoteroToken } from '@/lib/integrations/zotero/oauth';

type OAuthState = { userId: string; oauthToken: string; oauthTokenSecret: string; expiresAt: number };

export async function GET(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.redirect(new URL('/login', request.url));

  const url = new URL(request.url);
  const oauthToken = url.searchParams.get('oauth_token');
  const verifier = url.searchParams.get('oauth_verifier');
  const cookieStore = await cookies();
  const encryptedState = cookieStore.get('waha_zotero_oauth')?.value;
  cookieStore.delete('waha_zotero_oauth');

  try {
    if (!oauthToken || !verifier || !encryptedState) throw new Error('Missing OAuth callback data');
    const state = decryptIntegrationSecret<OAuthState>(encryptedState);
    if (state.userId !== access.user.id || state.oauthToken !== oauthToken || state.expiresAt < Date.now()) {
      throw new Error('Invalid or expired OAuth state');
    }

    const token = await exchangeZoteroToken(oauthToken, state.oauthTokenSecret, verifier);
    if (!token.oauth_token || !token.userID) throw new Error('Zotero did not return an access token');

    const supabase = createServiceClient();
    const { error } = await supabase.from('user_integrations').upsert({
      user_id: access.user.id,
      provider: 'zotero',
      external_user_id: token.userID,
      access_token_encrypted: encryptIntegrationSecret({ apiKey: token.oauth_token }),
      permissions: { library: 'read', groups: 'read', notes: false, write: false },
      status: 'connected',
      connected_at: new Date().toISOString(),
      revoked_at: null,
    }, { onConflict: 'user_id,provider' });
    if (error) throw error;

    return NextResponse.redirect(new URL('/settings/integrations?zotero=connected', request.url));
  } catch {
    return NextResponse.redirect(new URL('/settings/integrations?zotero=error', request.url));
  }
}
