import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { encryptIntegrationSecret } from '@/lib/integrations/crypto';
import { isGoogleFormsOAuthConfigured } from '@/lib/integrations/configuration';
import { buildGoogleFormsAuthorizationUrl, googleFormsOAuthConfig } from '@/lib/integrations/google-forms/oauth';
import { readApprovedQuestionnaire } from '@/lib/integrations/google-forms/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GoogleFormsOAuthState = { userId: string; projectId: string; state: string; expiresAt: number };

function instrumentUrl(requestUrl: string, projectId: string, result: string) {
  const redirect = new URL('/research/instrument', requestUrl);
  redirect.searchParams.set('projectId', projectId);
  redirect.searchParams.set('googleForm', result);
  return redirect;
}

export async function GET(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.redirect(new URL('/login', request.url));
  const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || '';
  try {
    if (!UUID_PATTERN.test(projectId) || !(await ownsProject(projectId, access.user.id, access.supabase))) {
      return NextResponse.redirect(instrumentUrl(request.url, projectId, 'forbidden'));
    }
    if (!isGoogleFormsOAuthConfigured()) return NextResponse.redirect(instrumentUrl(request.url, projectId, 'config'));
    const config = googleFormsOAuthConfig(request.url);
    const questionnaire = await readApprovedQuestionnaire(projectId, access.supabase);
    if (!questionnaire) return NextResponse.redirect(instrumentUrl(request.url, projectId, 'not-ready'));
    const state = randomBytes(32).toString('base64url');
    const cookieStore = await cookies();
    const oauthState: GoogleFormsOAuthState = {
      userId: access.user.id,
      projectId,
      state,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    cookieStore.set('waha_google_forms_oauth', encryptIntegrationSecret(oauthState), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/integrations/google-forms/callback',
      maxAge: 600,
      priority: 'high',
    });
    return NextResponse.redirect(buildGoogleFormsAuthorizationUrl(config, state));
  } catch {
    return NextResponse.redirect(instrumentUrl(request.url, projectId, 'error'));
  }
}
