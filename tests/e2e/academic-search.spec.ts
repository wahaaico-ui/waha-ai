import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD;
const projectId = process.env.E2E_TEST_PROJECT_ID?.trim();

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('authenticated academic search returns traceable production sources', async ({ request }) => {
  if (!email || !password || !projectId) throw new Error('Academic search gate requires E2E_TEST_EMAIL, E2E_TEST_PASSWORD and E2E_TEST_PROJECT_ID.');
  const login = await request.post('/api/auth/login', { data: { email, password } });
  expect(login.status()).toBe(200);

  const response = await request.post('/api/academic/search', {
    // Results are stored in the owner's project, so a project is required.
    data: { query: 'generative artificial intelligence in higher education', specialty: 'education', projectId },
    timeout: 45_000,
  });
  expect(response.status()).toBe(200);
  const payload = await response.json() as {
    success?: boolean;
    data?: Array<{ title?: string; doi?: string | null; url?: string | null; pdfUrl?: string | null; sources?: string[] }>;
    coverage?: { availableSources?: number; attemptedSources?: number };
  };

  expect(payload.success).toBe(true);
  expect(payload.coverage?.attemptedSources).toBeGreaterThanOrEqual(3);
  expect(payload.coverage?.availableSources).toBeGreaterThanOrEqual(2);
  expect(payload.data?.length).toBeGreaterThan(0);
  for (const paper of payload.data || []) {
    expect(paper.title?.trim().length).toBeGreaterThan(0);
    expect(paper.sources?.length).toBeGreaterThan(0);
    expect(Boolean(paper.doi || paper.url || paper.pdfUrl)).toBe(true);
  }
});

// DOC-31-04: articles from listed open-access journals reach the search under DOAJ's own name.
test('an Arabic humanities search includes DOAJ articles named as DOAJ', async ({ request }) => {
  if (!email || !password || !projectId) throw new Error('Academic search gate requires E2E_TEST_EMAIL, E2E_TEST_PASSWORD and E2E_TEST_PROJECT_ID.');
  expect((await request.post('/api/auth/login', { data: { email, password } })).status()).toBe(200);
  const response = await request.post('/api/academic/search', {
    data: { query: 'التعليم الإلكتروني في الجامعات', specialty: 'education', projectId },
    timeout: 60_000,
  });
  expect(response.status()).toBe(200);
  const payload = await response.json() as { data?: Array<{ title?: string; url?: string | null; sources?: string[] }> };
  const fromDoaj = (payload.data || []).filter((paper) => paper.sources?.includes('doaj'));
  expect(fromDoaj.length).toBeGreaterThan(0);
  for (const paper of fromDoaj) {
    expect(paper.title?.trim().length).toBeGreaterThan(0);
    expect(paper.url).toMatch(/^https?:\/\//);
  }
});
