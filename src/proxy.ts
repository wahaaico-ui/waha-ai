import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options';

const RATE_LIMITED_API_PREFIXES = new Map<string, { maxRequests: number; windowSeconds: number }>([
  ['/api/academic/parse-pdf', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/pdf-analyzer', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/export', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/academic/paraphrase', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/academic/language-tools', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/research/literature', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/research/orcid', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/research/library', { maxRequests: 30, windowSeconds: 60 }],
  ['/api/research/citations', { maxRequests: 30, windowSeconds: 60 }],
  ['/api/research/draft', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/research/analysis', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/research/titles', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/citations', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/academic/literature-synth', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/analyze', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/analyze-idea', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/verify-idea', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/idea-insights', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/journals', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/career', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/auth/signup', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/auth/login', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/auth/logout', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/auth/password', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/account/export', { maxRequests: 3, windowSeconds: 3_600 }],
  ['/api/account/delete', { maxRequests: 3, windowSeconds: 3_600 }],
  ['/api/email/project-snapshot', { maxRequests: 5, windowSeconds: 86_400 }],
  ['/api/support/tickets', { maxRequests: 3, windowSeconds: 3_600 }],
  ['/api/chat', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/waha/analyze', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/stripe/checkout', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/integrations/zotero/connect', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/integrations/zotero/collections', { maxRequests: 20, windowSeconds: 60 }],
  ['/api/integrations/zotero/import', { maxRequests: 5, windowSeconds: 60 }],
  ['/api/academic/intent', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/gaps', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/pdf-chat', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/chat', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/originality', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/search', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/timeline', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/literature-review', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/survey', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/analyzer', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/readiness', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/title-engine', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/decision', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/defense', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/matrix', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/proposal', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/idea-engine', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/methodology', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/abstract', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/seminar', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/intelligence', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/evidence', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/academic/brain', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/suggest-related-papers', { maxRequests: 10, windowSeconds: 60 }],
  ['/api/suggest-titles', { maxRequests: 10, windowSeconds: 60 }],
]);

function rateLimitFor(pathname: string, method: string) {
  if (/^\/api\/projects\/[a-f0-9-]+\/writing\/analysis$/i.test(pathname)) {
    return { maxRequests: method === 'POST' ? 10 : 60, windowSeconds: 60 };
  }
  // Saving a literature-review batch must not consume the budget for reading
  // that library. These are request budgets, not limits on stored references.
  if (pathname === '/api/research/library') {
    const maxRequests = method === 'POST' ? 120 : method === 'GET' ? 60 : 30;
    return { maxRequests, windowSeconds: 60 };
  }
  if (/^\/api\/projects\/[^/]+\/pdfs(?:\/[^/]+)?$/.test(pathname)) return { maxRequests: method === 'POST' ? 10 : 60, windowSeconds: 60 };
  return [...RATE_LIMITED_API_PREFIXES.entries()].find(([prefix]) => pathname === prefix)?.[1];
}

export async function requestFingerprint(request: NextRequest) {
  // Vercel supplies this header at the edge. The fallback makes local development
  // deterministic without trusting a client-provided user identifier.
  const ip = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const methodScope = request.nextUrl.pathname === '/api/research/library' ? `:${request.method}` : '';
  const input = new TextEncoder().encode(`waha-api-rate-limit:${ip}:${request.nextUrl.pathname}${methodScope}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function rateLimitStatus(request: NextRequest, policy: { maxRequests: number; windowSeconds: number }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return process.env.NODE_ENV === 'production' ? 'unavailable' : 'allowed';

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
    if (!response.ok) return 'unavailable';
    return (await response.json()) === false ? 'limited' : 'allowed';
  } catch {
    return 'unavailable';
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Signed webhooks come from the payment provider's servers, not from a page. */
const CROSS_SITE_ALLOWED = new Set(['/api/stripe/webhook']);

/**
 * A request that changes data must come from this site's own pages. Browsers
 * send Origin (or Sec-Fetch-Site) on such requests; a page on another site
 * that tries to act with the visitor's session is refused here (CSRF).
 */
export function isCrossSiteWrite(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  if (SAFE_METHODS.has(request.method) || !pathname.startsWith('/api/') || CROSS_SITE_ALLOWED.has(pathname)) return false;
  const sender = request.headers.get('origin');
  if (sender) return sender !== origin;
  return request.headers.get('sec-fetch-site') === 'cross-site';
}

export async function proxy(request: NextRequest) {
  if (isCrossSiteWrite(request)) {
    return NextResponse.json({ error: 'Cross-site request refused.' }, { status: 403 });
  }

  const rateLimitPolicy = rateLimitFor(request.nextUrl.pathname, request.method);
  if (rateLimitPolicy) {
    const status = await rateLimitStatus(request, rateLimitPolicy);
    if (status === 'limited') {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimitPolicy.windowSeconds) } }
      );
    }
    if (status === 'unavailable' && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Request protection is temporarily unavailable.' },
        { status: 503, headers: { 'Retry-After': '30' } }
      );
    }
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
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const PROTECTED_PAGE_PREFIXES = ['/academic', '/analyze', '/dashboard', '/projects', '/research', '/settings'];
  if (!user && PROTECTED_PAGE_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa = assurance?.currentLevel === 'aal1' && assurance.nextLevel === 'aal2';
    if (needsMfa) {
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'MFA verification required.' }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/auth/mfa';
      url.search = '';
      url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/academic/:path*', '/analyze', '/dashboard/:path*', '/projects/:path*', '/research/:path*', '/settings/:path*', '/api/:path*'],
};
