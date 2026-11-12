jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: async () => ({ user: { id: 'user-1' }, supabase: {} }),
}));

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { isCrossSiteWrite, proxy } from '@/proxy';
import nextConfig from '../../../next.config';
import { POST as abstract } from '@/app/api/academic/abstract/route';

const environment = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
});
afterEach(() => { jest.restoreAllMocks(); process.env = { ...environment }; });

const call = (pathname: string, method: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://waha.systems${pathname}`, { method, headers: { 'x-vercel-forwarded-for': '192.0.2.9', ...headers } });

describe('requests that change data from another site (CSRF)', () => {
  test('a page on another site cannot act with the visitor\'s session', async () => {
    const response = await proxy(call('/api/account/delete', 'POST', { origin: 'https://evil.example' }));
    expect(response.status).toBe(403);
  });
  test('browsers that send only Sec-Fetch-Site are refused too', () => {
    expect(isCrossSiteWrite(call('/api/projects', 'DELETE', { 'sec-fetch-site': 'cross-site' }))).toBe(true);
  });
  test('the site\'s own pages, reads, and the signed payment webhook still work', () => {
    expect(isCrossSiteWrite(call('/api/projects', 'POST', { origin: 'https://waha.systems', 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossSiteWrite(call('/api/projects', 'GET', { origin: 'https://evil.example' }))).toBe(false);
    expect(isCrossSiteWrite(call('/api/stripe/webhook', 'POST', { origin: 'https://stripe.example' }))).toBe(false);
    expect(isCrossSiteWrite(call('/api/projects', 'POST'))).toBe(false);
  });
});

test('changing the password is rate limited', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(Response.json(false));
  const response = await proxy(call('/api/auth/password', 'POST', { origin: 'https://waha.systems' }));
  expect(response.status).toBe(429);
});

test('session cookies are HTTPS-only and same-site in production', () => {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = 'production';
  jest.isolateModules(() => {
    const { SESSION_COOKIE_OPTIONS } = jest.requireActual('@/lib/supabase/cookie-options');
    expect(SESSION_COOKIE_OPTIONS).toEqual({ path: '/', sameSite: 'lax', secure: true });
  });
});

test('responses do not name the framework, and the browser may not call AI providers directly', async () => {
  expect(nextConfig.poweredByHeader).toBe(false);
  const rules = await nextConfig.headers!();
  const csp = rules[0].headers.find(header => header.key === 'Content-Security-Policy')!.value;
  expect(csp).not.toMatch(/generativelanguage|groq/);
});

describe('server errors never reach the browser in detail', () => {
  test('a failing AI route answers with a general message and keeps the detail in the server log', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('upstream detail https://internal.example/?key=secret'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await abstract(new Request('https://waha.systems/api/academic/abstract', { method: 'POST', body: JSON.stringify({ rawNotes: 'notes' }) }));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/secret|internal|upstream/);
    expect(log).toHaveBeenCalled();
  });

  test('no API route returns an error\'s own message to the browser', () => {
    const files: string[] = [];
    const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full); else if (entry.name === 'route.ts') files.push(full);
    });
    walk(path.join(__dirname, '../../app/api'));
    const leaking = files.filter(file => /json\(\{[^}\n]*\b(err|error)\.message\s*:/.test(fs.readFileSync(file, 'utf8'))
      || /error: (err|error) instanceof Error[^\n]*\? \1\.message/.test(fs.readFileSync(file, 'utf8')));
    expect(leaking).toEqual([]);
  });
});
