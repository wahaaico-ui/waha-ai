import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD;

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('WAHA authenticated critical path', () => {
  test.skip((!email || !password) && process.env.E2E_REQUIRE_AUTH !== 'true', 'Set a dedicated confirmed E2E_TEST_EMAIL and E2E_TEST_PASSWORD account.');

  test('@critical login, resume dashboard, and logout', async ({ page }) => {
    if (!email || !password) throw new Error('Authenticated gate requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD for a dedicated confirmed account.');
    await page.goto('/login?redirect=/dashboard');
    await page.getByLabel('البريد الإلكتروني').fill(email!);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);
    expect(page.url().includes('/auth/mfa'), 'MFA challenge reached; login/logout verification remains incomplete.').toBe(false);

    await expect(page.getByText(/مرحباً/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'مشاريعي البحثية' })).toBeVisible();

    const logout = page.getByRole('button', { name: 'خروج' });
    if (!(await logout.isVisible())) {
      await page.getByRole('button', { name: 'Open menu' }).click();
    }
    await page.getByRole('button', { name: 'خروج' }).click();
    await expect(page).toHaveURL('/');
  });
});
