import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptIntegrationSecret } from '@/lib/integrations/crypto';
import { createGoogleForm } from '@/lib/integrations/google-forms/client';
import { exchangeGoogleFormsCode, googleFormsOAuthConfig, GOOGLE_FORMS_SCOPE } from '@/lib/integrations/google-forms/oauth';
import { readApprovedQuestionnaire } from '@/lib/integrations/google-forms/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

type GoogleFormsOAuthState = { userId: string; projectId: string; state: string; expiresAt: number };

function instrumentUrl(requestUrl: string, projectId: string, result: string) {
  const redirect = new URL('/research/instrument', requestUrl);
  if (projectId) redirect.searchParams.set('projectId', projectId);
  redirect.searchParams.set('googleForm', result);
  return redirect;
}

function safeResponderUri(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname === 'docs.google.com' ? parsed.toString() : null;
  } catch { return null; }
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
  cookieStore.delete('waha_google_forms_oauth');
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
    const redirect = instrumentUrl(request.url, projectId, 'created');
    redirect.searchParams.set('formId', form.formId);
    const responderUri = safeResponderUri(form.responderUri);
    if (responderUri) redirect.searchParams.set('responderUri', responderUri);
    return NextResponse.redirect(redirect);
  } catch {
    return NextResponse.redirect(instrumentUrl(request.url, projectId, 'error'));
  }
}
