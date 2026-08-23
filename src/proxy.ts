import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const RATE_LIMITED_API_PREFIXES = new Map<string, { maxRequests: number; windowSeconds: number }>([
  ['/api/academic/parse-pdf', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/pdf-analyzer', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/export', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/academic/paraphrase', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/academic/literature-synth', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/analyze', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/analyze-idea', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/verify-idea', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/chat', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/waha/analyze', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/stripe/checkout', { maxRequests: 10, windowSeconds: 60 }],
]);

function rateLimitFor(pathname: string) {
  return [...RATE_LIMITED_API_PREFIXES.entries()].find(([prefix]) => pathname === prefix)?.[1];
}

async function requestFingerprint(request: NextRequest) {
  // Vercel supplies this header at the edge. The fallback makes local development
  // deterministic without trusting a client-provided user identifier.
  const ip = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const input = new TextEncoder().encode(`waha-api-rate-limit:${ip}:${request.nextUrl.pathname}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function isRateLimited(request: NextRequest, policy: { maxRequests: number; windowSeconds: number }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return false;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_ip: await requestFingerprint(request),
        p_max_requests: policy.maxRequests,
        p_window_seconds: policy.windowSeconds,
      }),
    });
    return response.ok && (await response.json()) === false;
  } catch {
    // Rate limiting is protective but must not turn an upstream telemetry failure
    // into an authentication or authorization bypass.
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const rateLimitPolicy = rateLimitFor(request.nextUrl.pathname);
  if (rateLimitPolicy && await isRateLimited(request, rateLimitPolicy)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimitPolicy.windowSeconds) } }
    );
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/academic')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/academic/:path*', '/api/:path*'],
};
