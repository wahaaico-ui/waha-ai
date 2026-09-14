import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('@critical accepts a recovery request without exposing account state', async ({ page }) => {
  const email = process.env.E2E_RECOVERY_EMAIL;
  test.skip(!email, 'Set a temporary E2E recovery email.');
  if (!email) throw new Error('A temporary recovery email is required.');

  await page.goto('/forgot-password', { waitUntil: 'load' });
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByRole('button', { name: 'إرسال رابط الاستعادة' }).click();
  await expect(page.getByRole('heading', { name: 'تحقق من بريدك' })).toBeVisible();
});

test('@critical changes the password through a recovery token and signs in', async ({ page }) => {
  const email = process.env.E2E_RECOVERY_EMAIL;
  const recoveryUrl = process.env.E2E_RECOVERY_URL;
  const newPassword = process.env.E2E_RECOVERY_NEW_PASSWORD;
  test.skip(!email || !recoveryUrl || !newPassword, 'Set temporary E2E recovery credentials.');
  if (!email || !recoveryUrl || !newPassword) throw new Error('Temporary recovery credentials are required.');

  await page.goto(recoveryUrl, { waitUntil: 'load' });
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole('heading', { name: 'أنشئ كلمة مرور جديدة' })).toBeVisible();
  await page.locator('#password').fill(newPassword);
  await page.locator('#confirmation').fill(newPassword);
  await page.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }).click();
  await expect(page.getByRole('heading', { name: 'تم تحديث كلمة المرور' })).toBeVisible();

  await page.getByRole('link', { name: 'تسجيل الدخول' }).click();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(newPassword);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'مشاريعي البحثية' })).toBeVisible();
});
