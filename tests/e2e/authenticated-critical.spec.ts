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
});
