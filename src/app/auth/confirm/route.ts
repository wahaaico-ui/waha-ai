import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { safeAuthRedirect } from '@/lib/auth/safe-redirect';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'email_change',
  'invite',
  'magiclink',
  'recovery',
  'signup',
]);

function secureRedirect(url: URL | string) {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const requestedType = url.searchParams.get('type');
  const type = requestedType && ALLOWED_EMAIL_OTP_TYPES.has(requestedType as EmailOtpType)
    ? requestedType as EmailOtpType
    : null;
  const fallback = type === 'recovery' ? '/reset-password' : '/email-confirmed';
  const destination = safeAuthRedirect(url.searchParams.get('next'), fallback);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return secureRedirect(new URL(destination, url.origin));
    }

    console.error('[auth/confirm] token verification failed', {
      errorCode: error.code ?? 'unknown',
      status: error.status ?? null,
      type,
      destination,
    });
  } else {
    console.error('[auth/confirm] missing or invalid confirmation parameters', {
      hasTokenHash: Boolean(tokenHash),
      requestedType: requestedType ?? 'missing',
      destination,
    });
  }

  if (type === 'recovery' || destination === '/reset-password') {
    return secureRedirect(`${url.origin}/reset-password?error=invalid-or-expired`);
  }

  return secureRedirect(`${url.origin}/email-confirmed?error=invalid-or-expired`);
}
