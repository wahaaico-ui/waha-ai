import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD;

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('@critical account archive is complete and account deletion is permanent', async ({ page }) => {
  if (!email || !password) throw new Error('Account privacy gate requires a dedicated temporary account.');

  await page.goto('/login?redirect=/settings/privacy');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/settings\/privacy$/);
  await page.reload();
  await expect(page).toHaveURL(/\/settings\/privacy$/);
  await expect(page.getByRole('heading', { name: 'الخصوصية وبيانات الحساب' })).toBeVisible();

  const archiveResponse = await page.evaluate(async () => {
    const response = await fetch('/api/account/export', { credentials: 'same-origin', cache: 'no-store' });
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      disposition: response.headers.get('content-disposition'),
      body: await response.json(),
    };
  });
  expect(archiveResponse.status).toBe(200);
  expect(archiveResponse.contentType).toContain('application/json');
  expect(archiveResponse.disposition).toContain('waha-account-data-');
  const archive = archiveResponse.body as {
    schemaVersion?: number;
    account?: { email?: string };
    research?: { projects?: Array<{ title?: string }>; drafts?: unknown[] };
  };
  expect(archive.schemaVersion).toBe(2);
  expect(archive.account?.email).toBe(email);
  expect(archive.research?.projects?.some((project) => project.title === 'مشروع اختبار خصوصية الحساب')).toBe(true);
  expect(Array.isArray(archive.research?.drafts)).toBe(true);

  const deleteResponse = await page.evaluate(async (currentPassword) => {
    const response = await fetch('/api/account/delete', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'حذف حسابي نهائياً', password: currentPassword }),
    });
    return { status: response.status, body: await response.json() };
  }, password);
  expect(deleteResponse.status).toBe(200);
  expect(deleteResponse.body).toEqual({ deleted: true });

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)dashboard$/);
});
