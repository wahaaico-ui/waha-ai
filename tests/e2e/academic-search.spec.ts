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
    data: { query: 'generative artificial intelligence in higher education', specialty: 'education', projectId },
    timeout: 45_000,
  });
  expect(response.status()).toBe(200);
  const payload = await response.json() as {
    success?: boolean;
    data?: Array<{ resultId?: string; item?: { verificationStatus?: string }; title?: string; doi?: string | null; url?: string | null; pdfUrl?: string | null; sources?: string[] }>;
    coverage?: { availableSources?: number; attemptedSources?: number };
  };

  expect(payload.success).toBe(true);
  expect(payload.coverage?.attemptedSources).toBeGreaterThanOrEqual(3);
  expect(payload.coverage?.availableSources).toBeGreaterThanOrEqual(2);
  expect(payload.data?.length).toBeGreaterThan(0);
  for (const paper of payload.data || []) {
    // Each result is selectable only by its server-issued id, and discovery is not verification.
    expect(paper.resultId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(paper.item?.verificationStatus).toBe('unverified');
    expect(paper.title?.trim().length).toBeGreaterThan(0);
    expect(paper.sources?.length).toBeGreaterThan(0);
    expect(Boolean(paper.doi || paper.url || paper.pdfUrl)).toBe(true);
  }
});
