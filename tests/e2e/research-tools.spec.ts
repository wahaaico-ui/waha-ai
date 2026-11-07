import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

// Release gate for the research tools added after the 2 Oct 2026 gate:
// reference library, PDF workspace, study comparison, evidence writing,
// supervisor review and language tools. Runs against the temporary account
// and project created by scripts/run-production-core-e2e.mjs.
const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD;
const projectId = process.env.E2E_TEST_PROJECT_ID?.trim();

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.describe.configure({ mode: 'serial' });

/** A one-page PDF whose text layer reads `text`, with a correct xref table.
 * Text is wrapped inside the page: PDF readers drop text drawn past its edge. */
function minimalPdf(text: string): Buffer {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= 70) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const stream = `BT /F1 11 Tf 14 TL 72 720 Td ${lines.map(line => `(${line}) Tj T*`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

test.describe('research tools on the live site', () => {
  // Language tools call a model; uploads and saves hit the live database.
  test.setTimeout(120_000);
  let request: APIRequestContext;
  const marker = `gate-${Date.now()}`;
  // Copied verbatim into the originality check below, which must trace it to this PDF.
  const pdfSentence = 'Students who revised drafts with generative tools reported clearer argument structure in their final theses';

  test.beforeAll(async ({ playwright, baseURL }) => {
    if (!email || !password || !projectId) throw new Error('Research tools gate requires E2E_TEST_EMAIL, E2E_TEST_PASSWORD and E2E_TEST_PROJECT_ID.');
    request = await playwright.request.newContext({ baseURL });
    const login = await request.post('/api/auth/login', { data: { email, password } });
    expect(login.status()).toBe(200);
  });

  test.afterAll(async () => { await request?.dispose(); });

  test('reference library saves a reference and lists it back', async () => {
    const title = `Generative AI and assessment in higher education ${marker}`;
    const saved = await request.post('/api/research/library', {
      data: { projectId, item: { title, authors: ['Gate Author'], year: 2024, journal: 'Gate Journal' } },
    });
    expect(saved.status(), await saved.text()).toBeLessThan(300);

    const listed = await request.get(`/api/research/library?projectId=${projectId}&view=items`);
    expect(listed.status()).toBe(200);
    expect(await listed.text()).toContain(title);
  });

  test('study comparison reads the saved references', async () => {
    const response = await request.get(`/api/projects/${projectId}/writing/comparison?kind=reference&language=ar&offset=0`);
    expect(response.status(), await response.text()).toBe(200);
    expect(await response.text()).toContain(marker);
  });

  test('PDF workspace extracts text from an uploaded file', async () => {
    const response = await request.post(`/api/projects/${projectId}/pdfs`, {
      multipart: { file: { name: `${marker}.pdf`, mimeType: 'application/pdf', buffer: minimalPdf(`WAHA release gate ${marker}. ${pdfSentence}`) } },
      timeout: 60_000,
    });
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json() as { saved?: boolean; sourceId?: string; totalPages?: number; hasText?: boolean };
    expect(body).toMatchObject({ saved: true, totalPages: 1, hasText: true });

    const comparison = await request.get(`/api/projects/${projectId}/writing/comparison?kind=pdf&language=en&offset=0`);
    expect(comparison.status(), await comparison.text()).toBe(200);
    expect(await comparison.text()).toContain(String(body.sourceId));
  });

  test('similarity check traces an uncited copied sentence to the project PDF', async () => {
    const text = `This paragraph is the researcher's own framing of the study (${marker}). ${pdfSentence}.`;
    const response = await request.post('/api/academic/originality', { data: { projectId, input: 'text', text, includeOpenSources: false }, timeout: 60_000 });
    expect(response.status(), await response.text()).toBe(200);
    const { report } = await response.json() as { report: { passages: Array<{ text: string; matches: Array<{ origin: string; cited: boolean }> }>; licensedService: string } };
    const passage = report.passages.find(item => item.text.includes('generative tools'));
    expect(passage, 'the copied sentence is reported').toBeTruthy();
    expect(passage!.matches).toContainEqual(expect.objectContaining({ origin: 'project-pdf', cited: false }));
    expect(report.licensedService).toBe('not_configured');
  });

  test('idea timing uses five complete years of real OpenAlex counts', async () => {
    // OpenAlex throttles anonymous traffic under load; the service then answers
    // 503 instead of a guessed indicator. Wait out a short throttle, but still
    // fail if OpenAlex stays unavailable.
    let response = await request.post('/api/idea-insights', { data: { query: 'generative artificial intelligence in higher education' }, timeout: 60_000 });
    for (let attempt = 1; attempt < 3 && response.status() === 503; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 20_000));
      response = await request.post('/api/idea-insights', { data: { query: 'generative artificial intelligence in higher education' }, timeout: 60_000 });
    }
    expect(response.status(), await response.text()).toBe(200);
    const { insights } = await response.json() as { insights: { timing: { stage: string; years: Array<{ year: number; count: number }> }; directions: unknown[] } };
    const currentYear = new Date().getUTCFullYear();
    expect(insights.timing.years.map(y => y.year)).toEqual([1, 2, 3, 4, 5].map(i => currentYear - 6 + i));
    expect(['insufficient', 'emerging', 'peak', 'saturated', 'limited']).toContain(insights.timing.stage);
    expect(insights.directions.length).toBeLessThanOrEqual(20);
  });

  test('evidence writing saves a draft and returns it', async () => {
    const text = `Generative AI changes how universities assess students (${marker}).`;
    const saved = await request.post(`/api/projects/${projectId}/writing`, { data: { text, citations: [] } });
    expect(saved.status(), await saved.text()).toBe(200);

    const loaded = await request.get(`/api/projects/${projectId}/writing`);
    expect(loaded.status()).toBe(200);
    expect(await loaded.text()).toContain(marker);
  });

  test('supervisor review records a note and lists it back', async () => {
    const comment = `Clarify the sampling frame (${marker}).`;
    const saved = await request.post(`/api/projects/${projectId}/supervisor-review`, {
      data: {
        originalText: 'The study surveys university students about generative AI use.',
        revisedText: 'The study surveys undergraduate students at two public universities about generative AI use.',
        notes: [{ id: randomUUID(), comment, location: 'Methodology', response: 'Population specified.', status: 'addressed' }],
      },
    });
    expect(saved.status(), await saved.text()).toBe(200);

    const listed = await request.get(`/api/projects/${projectId}/supervisor-review`);
    expect(listed.status()).toBe(200);
    expect(await listed.text()).toContain(comment);
  });

  test('language tools proofread academic text and save the task', async () => {
    const text = 'This studys examine how students uses generative artificial intelligence in there assignments.';
    const response = await request.post('/api/academic/language-tools', {
      data: { operation: 'proofread', text, targetLanguage: 'en', projectId },
      timeout: 90_000,
    });
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json() as { output?: string; saved?: boolean };
    expect(body.saved).toBe(true);
    expect(body.output?.trim().length).toBeGreaterThan(20);
    expect(body.output).not.toBe(text);
  });
});
