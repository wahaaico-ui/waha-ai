/**
 * Session cookies: sent only over HTTPS in production and never on cross-site
 * requests that change data. The sign-in library merges these with its own
 * defaults (path, lifetime). They cannot be HttpOnly: the browser client reads
 * the session to call Supabase, which the library requires.
 */
export const SESSION_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};
