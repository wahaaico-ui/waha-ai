import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '@/lib/integrations/crypto';
import { createGoogleForm } from '@/lib/integrations/google-forms/client';
import { exchangeGoogleFormsCode, googleFormsOAuthConfig, GOOGLE_FORMS_SCOPE } from '@/lib/integrations/google-forms/oauth';
import { readApprovedQuestionnaire } from '@/lib/integrations/google-forms/server';
import { GOOGLE_FORM_ID_PATTERN, GOOGLE_FORMS_RECEIPT_COOKIE, safeGoogleFormsResponderUri, type GoogleFormsReceipt } from '@/lib/integrations/google-forms/receipt';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

type GoogleFormsOAuthState = { userId: string; projectId: string; state: string; expiresAt: number };

function instrumentUrl(requestUrl: string, projectId: string, result: string) {
  const redirect = new URL('/research/instrument', requestUrl);
  if (projectId) redirect.searchParams.set('projectId', projectId);
  redirect.searchParams.set('googleForm', result);
  return redirect;
}

export async function GET(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.redirect(new URL('/login', request.url));
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const providerError = url.searchParams.get('error');
  const cookieStore = await cookies();
  const encryptedState = cookieStore.get('waha_google_forms_oauth')?.value;
  cookieStore.set('waha_google_forms_oauth', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/integrations/google-forms/callback', maxAge: 0 });
  // Invalidate any earlier success before handling this creation attempt.
  cookieStore.set(GOOGLE_FORMS_RECEIPT_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/integrations/google-forms/status', maxAge: 0 });
  let projectId = '';

  try {
    if (providerError) throw new Error('Google authorization was denied');
    if (!code || !returnedState || !encryptedState) throw new Error('Missing Google OAuth callback data');
    const state = decryptIntegrationSecret<GoogleFormsOAuthState>(encryptedState);
    projectId = state.projectId;
    if (state.userId !== access.user.id || state.state !== returnedState || state.expiresAt < Date.now()) {
      throw new Error('Invalid or expired Google OAuth state');
    }
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) throw new Error('Project not found');
    const questionnaire = await readApprovedQuestionnaire(projectId, access.supabase);
    if (!questionnaire) throw new Error('Questionnaire is not ready');
    const config = googleFormsOAuthConfig(request.url);
    const token = await exchangeGoogleFormsCode(code, config);
    if (token.scope && !token.scope.split(/\s+/u).includes(GOOGLE_FORMS_SCOPE)) throw new Error('Required Google Forms scope was not granted');
    const form = await createGoogleForm(questionnaire, token.accessToken);
    if (!GOOGLE_FORM_ID_PATTERN.test(form.formId)) throw new Error('Invalid Google form ID');
    const receipt: GoogleFormsReceipt = {
      userId: access.user.id, projectId, formId: form.formId,
      responderUri: safeGoogleFormsResponderUri(form.responderUri),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    cookieStore.set(GOOGLE_FORMS_RECEIPT_COOKIE, encryptIntegrationSecret(receipt), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      path: '/api/integrations/google-forms/status', maxAge: 600, priority: 'high',
    });
    const redirect = instrumentUrl(request.url, projectId, 'created');
    return NextResponse.redirect(redirect);
  } catch {
    return NextResponse.redirect(instrumentUrl(request.url, projectId, 'error'));
  }
}
