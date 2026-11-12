import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD;
const projectId = process.env.E2E_TEST_PROJECT_ID?.trim();

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('WAHA authenticated critical path', () => {
  test.skip((!email || !password) && process.env.E2E_REQUIRE_AUTH !== 'true', 'Set a dedicated confirmed E2E_TEST_EMAIL and E2E_TEST_PASSWORD account.');

  async function login(page: import('@playwright/test').Page, redirect = '/dashboard') {
    if (!email || !password) throw new Error('Authenticated gate requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD for a dedicated confirmed account.');
    await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
    await page.getByLabel('البريد الإلكتروني').fill(email!);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  }

  test('@critical login, resume dashboard, and logout', async ({ page }) => {
    await login(page);

    await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);
    expect(page.url().includes('/auth/mfa'), 'MFA challenge reached; login/logout verification remains incomplete.').toBe(false);

    await expect(page.getByText(/مرحباً/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'مشاريعي البحثية' })).toBeVisible();

    const logout = page.getByRole('button', { name: 'خروج' });
    if (!(await logout.isVisible())) {
      await page.getByRole('button', { name: /^(?:فتح القائمة|Open menu)$/ }).click();
    }
    await page.getByRole('button', { name: 'خروج' }).click();
    await expect(page).toHaveURL(/\/(?:login(?:\?|$)|$)/);
    if (page.url().includes('/login')) {
      await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();
    }
  });

  test('@critical authenticated Word and PDF export', async ({ page }) => {
    if (!projectId) throw new Error('Export gate requires E2E_TEST_PROJECT_ID owned by the temporary user.');
    await login(page);
    await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);

    for (const [format, contentType, signature] of [
      ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK'],
      ['pdf', 'application/pdf', '%PDF'],
    ] as const) {
      const response = await page.request.post('/api/academic/export', { data: { projectId, format } });
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain(contentType);
      const body = await response.body();
      expect(body.subarray(0, signature.length).toString()).toBe(signature);
      expect(body.length).toBeGreaterThan(1_000);
    }
  });

  // DOC-21-01: the precise specialty is kept in the account, read back after a
  // new sign-in, and reaches the server-side readers that steer research.
  test('@critical precise specialty is saved in the profile and survives a new sign-in', async ({ page }) => {
    const detail = `أصول الفقه ${Date.now()}`;
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/profile');

    await page.getByLabel('الاسم الكامل').fill('اختبار إنتاج الملف');
    await page.getByLabel('التخصص العام').selectOption('العلوم الشرعية والإسلامية');
    await page.getByLabel('التخصص الدقيق').fill(detail);
    await page.getByLabel('الجامعة / المؤسسة الأكاديمية').fill('جامعة اختبار الإنتاج');
    await page.getByLabel('المستوى الأكاديمي').selectOption('masters');
    await page.getByLabel('الدولة أو البيئة البحثية الأساسية').selectOption('PS');
    await page.getByRole('button', { name: 'حفظ التعديلات' }).click();
    await expect(page.getByText(/حُفظ ملفك الأكاديمي/)).toBeVisible();

    const stats = await page.request.get('/api/dashboard-stats');
    expect(stats.status()).toBe(200);
    expect((await stats.json()).researcher.specialty).toBe(`العلوم الشرعية والإسلامية — ${detail}`);

    await page.context().clearCookies();
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/profile');
    await expect(page.getByLabel('التخصص الدقيق')).toHaveValue(detail);
    await expect(page.getByLabel('التخصص العام')).toHaveValue('العلوم الشرعية والإسلامية');
    await expect(page.getByLabel('المستوى الأكاديمي')).toHaveValue('masters');
    await expect(page.getByLabel('الدولة أو البيئة البحثية الأساسية')).toHaveValue('PS');
  });

  // DOC-39-02: the check page saves its report, and the researcher downloads it as a file.
  test('@critical similarity report downloads as a PDF from the check page', async ({ page }) => {
    if (!projectId) throw new Error('Similarity gate requires E2E_TEST_PROJECT_ID owned by the temporary user.');
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto(`/research/originality?projectId=${projectId}`);

    await page.getByRole('radio', { name: /نص ألصقه هنا/ }).check();
    await page.locator('#originality-text').fill(`هذه فقرة كتبها الباحث بنفسه لاختبار تنزيل تقرير التطابق من صفحة الفحص (${Date.now()}).`);
    await page.getByRole('button', { name: 'ابدأ الفحص' }).click();

    const exports = page.getByRole('region', { name: 'تصدير النتيجة المحفوظة' });
    await expect(exports).toBeVisible({ timeout: 60_000 });
    const download = page.waitForEvent('download');
    await exports.getByRole('button', { name: 'PDF' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('waha-originality.pdf');
    expect(readFileSync((await file.path())!).subarray(0, 4).toString()).toBe('%PDF');
  });

  // DOC-30-01..03: the career page reads works by the saved ORCID iD and exports them as a file.
  test('@critical research career from a saved ORCID iD shows citations and downloads as a PDF', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/profile');
    await page.getByRole('link', { name: /مسيرتي البحثية/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/career/);
    await expect(page.getByRole('heading', { name: 'مسيرتي البحثية' })).toBeVisible();

    await page.getByLabel('معرّف ORCID').fill('0000-0003-1613-5981');
    await page.getByRole('button', { name: 'احفظ المعرّف' }).click();
    await expect(page.getByRole('heading', { name: 'تتبع الاستشهادات' })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText('غير متاحة؛ لا تنشرها OpenAlex').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'الأعمال المنشورة' })).toBeVisible();

    const exports = page.getByRole('region', { name: 'تصدير المسيرة' });
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await exports.getByRole('button', { name: 'PDF' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('waha-career.pdf');
    expect(readFileSync((await file.path())!).subarray(0, 4).toString()).toBe('%PDF');
  });

  // DOC-30-03: a share link shows only the chosen sections to a visitor, and a revoked link shows nothing.
  test('@critical research career share link shows chosen sections and stops when revoked', async ({ page, browser }) => {
    test.setTimeout(180_000);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    const status = await page.request.get('/api/career/share');
    test.skip(status.status() === 503, 'The career_share_links migration is not applied in production yet.');
    await page.goto('/dashboard/career');
    await page.getByLabel('معرّف ORCID').fill('0000-0003-1613-5981');
    await page.getByRole('button', { name: 'احفظ المعرّف' }).click();
    const share = page.getByRole('region', { name: 'مشاركة المسيرة' });
    await expect(share).toBeVisible({ timeout: 120_000 });
    await share.getByRole('checkbox', { name: 'اتجاهات تالية مقترحة' }).uncheck();
    await share.getByRole('button', { name: /أنشئ رابط/ }).click();
    const url = await share.getByLabel('الرابط الحالي').inputValue();
    expect(url).toMatch(/\/career\/[A-Za-z0-9_-]{32}$/);

    const visitor = await browser.newContext();
    const view = await visitor.newPage();
    await view.goto(url);
    await expect(view.getByRole('heading', { name: 'تتبع الاستشهادات' })).toBeVisible({ timeout: 120_000 });
    await expect(view.getByRole('heading', { name: 'اتجاهات تالية مقترحة' })).toHaveCount(0);

    page.once('dialog', dialog => void dialog.accept());
    await share.getByRole('button', { name: 'ألغِ الرابط' }).click();
    await expect(share.getByLabel('الرابط الحالي')).toHaveCount(0);
    const revoked = await view.goto(url);
    expect(revoked?.status()).toBe(404);
    await visitor.close();
  });

  // DOC-38-03: a saved defense date gives a two-week plan, ticks are kept, and the dashboard reminds.
  test('@critical defense date gives a preparation plan and a dashboard reminder', async ({ page }) => {
    if (!projectId) throw new Error('Defense gate requires E2E_TEST_PROJECT_ID owned by the temporary user.');
    test.setTimeout(120_000);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    const defenseDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.goto(`/research/defense?projectId=${projectId}`);
    await page.getByLabel('موعد المناقشة').fill(defenseDate);
    await page.getByRole('button', { name: /احفظ الموعد|حدّث الموعد/ }).click();
    await expect(page.getByText('بقي على المناقشة 10 يومًا.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('بدأت الخطة متأخرة')).toBeVisible();

    const tick = page.getByRole('button', { name: 'علّم منجزة: جهّز عرض المناقشة' });
    await tick.click();
    await expect(page.getByRole('button', { name: 'ألغِ إنجاز: جهّز عرض المناقشة' })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'ألغِ إنجاز: جهّز عرض المناقشة' })).toBeVisible({ timeout: 30_000 });

    await page.goto('/dashboard');
    const reminder = page.getByRole('region', { name: 'تذكير بالمناقشة' });
    await expect(reminder.getByText(/يومًا\.$/).first()).toBeVisible({ timeout: 30_000 });
    await expect(reminder.getByRole('link', { name: 'افتح خطة الاستعداد' }).first()).toHaveAttribute('href', `/research/defense?projectId=${projectId}`);
  });
});
