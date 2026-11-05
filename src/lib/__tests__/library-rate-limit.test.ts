jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

import { NextRequest } from 'next/server';
import { proxy, requestFingerprint } from '@/proxy';

const environment = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
});
afterEach(() => { jest.restoreAllMocks(); process.env = { ...environment }; });

function request(method: string, ip = '192.0.2.1') {
  return new NextRequest('http://localhost/api/research/library?projectId=test-project', {
    method, headers: { 'x-vercel-forwarded-for': ip },
  });
}

test('50 consecutive saves remain readable and excessive requests are still blocked', async () => {
  const counts = new Map<string, number>();
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    const policy = JSON.parse(String(init?.body)) as { p_ip: string; p_max_requests: number };
    const count = (counts.get(policy.p_ip) || 0) + 1;
    counts.set(policy.p_ip, count);
    return Response.json(count <= policy.p_max_requests);
  });
  for (let index = 0; index < 50; index++) expect((await proxy(request('POST'))).status).toBe(200);
  expect((await proxy(request('GET'))).status).toBe(200);
  expect(JSON.parse(String(fetchMock.mock.calls[50][1]?.body)).p_max_requests).toBe(60);
  for (let index = 50; index < 120; index++) expect((await proxy(request('POST'))).status).toBe(200);
  const blocked = await proxy(request('POST'));
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get('Retry-After')).toBe('60');
  expect((await proxy(request('GET'))).status).toBe(200);
  expect((await proxy(request('DELETE'))).status).toBe(200);
});

test('library fingerprints isolate HTTP methods and addresses without storing raw IPs', async () => {
  const read = await requestFingerprint(request('GET'));
  expect(read).toMatch(/^[a-f0-9]{64}$/);
  expect(read).toBe(await requestFingerprint(request('GET')));
  expect(read).not.toBe(await requestFingerprint(request('POST')));
  expect(read).not.toBe(await requestFingerprint(request('GET', '192.0.2.2')));
});
