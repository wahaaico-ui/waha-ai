import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD;

test.describe('WAHA authenticated critical path', () => {
  test.skip(!email || !password, 'Set a dedicated confirmed E2E_TEST_EMAIL and E2E_TEST_PASSWORD account.');

  test('@critical login, resume dashboard, and logout', async ({ page }) => {
    await page.goto('/login?redirect=/dashboard');
    await page.getByLabel('البريد الإلكتروني').fill(email!);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(page).toHaveURL(/\/dashboard|\/auth\/mfa/);
    test.skip(page.url().includes('/auth/mfa'), 'Dedicated E2E account requires an interactive MFA token.');

    await expect(page.getByText(/مرحباً/).first()).toBeVisible();
    await expect(page.getByText(/مشاريعي البحثية/)).toBeVisible();

    const logout = page.getByRole('button', { name: 'خروج' });
    if (!(await logout.isVisible())) {
      await page.getByRole('button', { name: 'Open menu' }).click();
    }
    await page.getByRole('button', { name: 'خروج' }).click();
    await expect(page).toHaveURL('/');
  });
});
