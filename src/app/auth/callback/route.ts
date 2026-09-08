import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { safeAuthRedirect } from '@/lib/auth/safe-redirect';

function secureRedirect(url: URL | string) {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const flowId = searchParams.get('sb_flow_id');
  const next = safeAuthRedirect(searchParams.get('next'));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {}
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const destination = assurance?.currentLevel === 'aal1' && assurance.nextLevel === 'aal2'
        ? `/auth/mfa?next=${encodeURIComponent(next)}`
        : next;
      return secureRedirect(new URL(destination, origin));
    }

    console.error('[auth/callback] code exchange failed', {
      errorCode: error.code ?? 'unknown',
      status: error.status ?? null,
      destination: next,
      hasFlowId: Boolean(flowId),
    });
  } else {
    console.error('[auth/callback] missing authorization code', {
      destination: next,
      hasFlowId: Boolean(flowId),
    });
  }

  if (next === '/reset-password') {
    return secureRedirect(`${origin}/reset-password?error=invalid-or-expired`);
  }

  return secureRedirect(`${origin}/login?error=auth-code-error`);
}
