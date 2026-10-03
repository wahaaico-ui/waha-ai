import { expect, test, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';

// Isolated UI checks against the real production build. Never use production
// credentials: build with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4319 and
// NEXT_PUBLIC_SUPABASE_ANON_KEY=rc-test-anon, then start it locally.
const projectId = 'rc-owned-project';
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'rc@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
let authServer: Server;
test.beforeAll(async () => {
  authServer = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    if (request.method === 'OPTIONS') { response.end(); return; }
    response.end(JSON.stringify(user));
  });
  await new Promise<void>((resolve) => authServer.listen(4319, '127.0.0.1', resolve));
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => authServer.close((error) => error ? reject(error) : resolve())); });

async function prepare(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp, aal: 'aal1', amr: [] })).toString('base64url'), 'test-signature'].join('.');
  await page.context().addCookies([{ name: 'sb-127-auth-token', value: `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: 'rc-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user })).toString('base64url')}`, url: 'http://127.0.0.1:4320' }]);
  await page.route('**/api/projects/*/journey', (route) => route.fulfill({ json: {
    outputs: { title: { title: 'Academic research in bilingual learning contexts' }, problem: { problemStatement: 'ينبغي فحص أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية بصورة منهجية واضحة.', researchGap: 'توجد حاجة إلى أدلة ميدانية حول تحصيل طلبة التمريض في الجامعات المحلية.', researcherNote: 'اخترت المشكلة لأهميتها في تحسين تعليم طلبة التمريض محلياً.' }, objectives: { objectives: ['قياس أثر التعلم في مجتمع الدراسة المحدد.', 'فحص علاقة السياق بنتائج التعلم لدى الطلبة.'] } },
    drafts: {}, nextStage: 'objectives', gate: null, lastActivity: null, researcher: { displayName: 'باحث', specialty: null },
  } }));
  await page.route('**/api/projects/*/consistency/*', (route) => route.fulfill({ json: { report: { checkType: 'problem_objective_consistency', status: 'failed', overallScore: 0, coverageScore: 0, summary: 'استنتاج غير مبرر', objectiveIds: ['o1'], uncoveredProblemConcepts: ['تتسارع', 'مختلف', 'إلا', 'الأدلة', 'المتوفرة'], issues: ['مفاهيم غير مغطاة'], results: [] }, warnings: [] } }));
  await page.route('**/api/research/library**', (route) => route.fulfill({ json: { success: true, items: [], item: { canonicalLinked: true } } }));
}
async function layout(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  expect(await page.locator('main').evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName !== 'BODY')).toBe(true);
  await page.screenshot({ path: test.info().outputPath('rc-layout.png'), fullPage: true });
}

for (const width of [360, 1280]) {
  test(`sources early search/save, bilingual results and keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 }); await prepare(page);
    await page.route('**/api/academic/search', (route) => {
      expect(route.request().postDataJSON().projectId).toBe(projectId);
      return route.fulfill({ json: { success: true, data: [{ resultId: 'server-held-result', id: 'work-1', title: 'Bilingual learning — التعليم ثنائي اللغة', authorsLabel: 'A. Author', year: 2025, citationCount: 3, relevanceScore: 98 }] } });
    });
    await page.goto(`/research/sources?projectId=${projectId}`);
    const query = page.getByRole('textbox', { name: 'استعلام البحث عن المصادر' });
    await query.fill('bilingual learning');
    await page.getByRole('button', { name: 'البحث عن مصادر', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Bilingual learning — التعليم ثنائي اللغة', { exact: true })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('98%');
    await expect(page.getByText('اكتب موضوعاً أو جملة تريد البحث عنها. ترتيب آلي أولي؛ راجع الدراسة لتحديد ملاءمتها لبحثك.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'مكتبة المشروع', exact: true })).toHaveAttribute('href', `/research/library?projectId=${projectId}`);
    const saving = page.waitForRequest((request) => request.url().includes('/api/research/library') && request.method() === 'POST');
    await page.getByRole('button', { name: 'حفظ في المكتبة' }).focus(); await page.keyboard.press('Enter');
    expect((await saving).postDataJSON()).toEqual({ projectId, resultId: 'server-held-result' });
    await expect(page.getByText('حُفظ المصدر في مكتبة هذا المشروع.')).toBeVisible();
    await layout(page);
  });
  test(`empty library directs to owned sources at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 }); await prepare(page);
    await page.goto(`/research/library?projectId=${projectId}`);
    const link = page.getByRole('main').getByRole('link', { name: 'البحث والمصادر', exact: true });
    await expect(link).toHaveAttribute('href', `/research/sources?projectId=${projectId}`);
    await expect(page.locator('main')).not.toContainText('داخل المساعدة الكتابية');
    await layout(page);
  });
  test(`locked formal literature offers early discovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 }); await prepare(page);
    await page.goto(`/research/literature?projectId=${projectId}`);
    await expect(page.getByText('اعتماد الأدبيات يأتي لاحقاً في الرحلة')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'البحث والمصادر', exact: true })).toHaveAttribute('href', `/research/sources?projectId=${projectId}`);
    await expect(page.getByRole('link', { name: 'إكمال الأداة' })).toBeVisible();
    await layout(page);
  });
  test(`failed lexical report is advisory at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 }); await prepare(page);
    await page.goto(`/research/objectives?projectId=${projectId}`);
    await expect(page.getByRole('heading', { name: 'مراجعة أولية للعلاقات البحثية' })).toBeVisible();
    const review = page.getByRole('heading', { name: 'مراجعة أولية للعلاقات البحثية' }).locator('..');
    await expect(review).not.toContainText('/100');
    await expect(review).not.toContainText('مفاهيم غير مغطاة');
    await expect(review).not.toContainText('استنتاج غير مبرر');
    await expect(review.getByRole('progressbar')).toHaveCount(0);
    await expect(review).toContainText('وليست قياساً لجودة البحث');
    await layout(page);
  });
  test(`formal literature keeps ranking private at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 }); await prepare(page);
    await page.route('**/api/projects/*/journey', (route) => route.fulfill({ json: {
      outputs: {
        title: { title: 'Academic research in bilingual learning contexts' },
        instrument: { instrumentType: 'questionnaire', consentStatement: 'أوافق طوعاً على المشاركة في الدراسة مع حفظ سرية بياناتي وحق الانسحاب.', instructions: 'يرجى قراءة كل عبارة والإجابة بحسب تجربتك الفعلية في التعلم.', sections: [{ variableName: 'التعلم', title: 'خبرة التعلم', items: [1, 2, 3].map((index) => ({ text: `أستفيد من تجربة التعلم في سياق دراستي الجامعية ${index}` })) }] },
        literature: { papers: [{ id: 'saved-1', title: 'Saved bilingual learning study', authors: 'A. Author', year: 2025, citationCount: 3, abstract: 'A study for the researcher to review.', relevanceScore: 88, item: { verificationStatus: 'unverified' } }] },
      }, drafts: {}, nextStage: 'literature', researcher: { displayName: 'باحث' },
    } }));
    await page.goto(`/research/literature?projectId=${projectId}`);
    await expect(page.getByText('Saved bilingual learning study', { exact: true })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('88%');
    await expect(page.getByText('ترتيب آلي أولي؛ راجع الدراسة لتحديد ملاءمتها لبحثك.', { exact: true })).toBeVisible();
    await layout(page);
  });
}
