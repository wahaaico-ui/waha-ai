const INTERNAL_ORIGIN = 'https://waha.internal';
const ALLOWED_EXACT_PATHS = new Set([
  '/dashboard',
  '/email-confirmed',
  '/pricing',
  '/reset-password',
  '/settings/security',
  '/verify-idea',
]);
const ALLOWED_PREFIXES = ['/projects/workspace', '/research'];

export function safeAuthRedirect(value: string | null | undefined, fallback = '/dashboard') {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    const pathAllowed = ALLOWED_EXACT_PATHS.has(parsed.pathname)
      || ALLOWED_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`));
    if (parsed.origin !== INTERNAL_ORIGIN || !pathAllowed) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
