import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('WAHA signup confirmation path', () => {
  test('@critical creates an unconfirmed account through the public form', async ({ page }) => {
    const email = process.env.E2E_SIGNUP_EMAIL;
    const password = process.env.E2E_SIGNUP_PASSWORD;
    test.skip(!email || !password, 'Set temporary E2E signup credentials.');
    if (!email || !password) throw new Error('Temporary signup credentials are required.');

    await page.goto('/signup', { waitUntil: 'load' });
    await page.getByLabel('الاسم الكامل').fill('باحث اختبار آلي');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'متابعة ←' }).click();
    await page.getByLabel('التخصص الأكاديمي').selectOption({ label: 'علوم الحاسوب والذكاء الاصطناعي' });
    await page.getByLabel('الدولة أو البيئة البحثية الأساسية').selectOption({ index: 1 });
    await page.getByLabel('الجامعة أو المؤسسة').fill('مؤسسة اختبار WAHA');
    await page.getByLabel('المستوى الأكاديمي').selectOption('researcher');
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click();

    await expect(page.getByRole('heading', { name: 'تحقق من بريدك' })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test('@critical confirms the account through the WAHA token route', async ({ page }) => {
    const confirmationUrl = process.env.E2E_CONFIRMATION_URL;
    test.skip(!confirmationUrl, 'Set a temporary Supabase confirmation URL.');
    if (!confirmationUrl) throw new Error('A temporary confirmation URL is required.');

    await page.goto(confirmationUrl, { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/email-confirmed\?next=/);
    await expect(page.getByRole('heading', { name: 'تم تأكيد بريدك بنجاح' })).toBeVisible();
    await page.getByRole('link', { name: 'متابعة رحلتي ←' }).click();
    await expect(page).toHaveURL(/\/verify-idea/);
  });
});
