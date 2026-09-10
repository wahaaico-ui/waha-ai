import { expect, test, type Page } from '@playwright/test';

test.describe('WAHA public launch path', () => {
  const open = (page: Page, path: string) => page.goto(path, { waitUntil: 'load' });

  test('@critical home exposes the product path without horizontal overflow', async ({ page }) => {
    await open(page, '/');

    await expect(page.locator('#features')).toBeVisible();
    await expect(page.locator('#how-it-works')).toBeVisible();
    await expect(page.getByRole('link', { name: /ابدأ|Get started/i }).first()).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('@critical protected dashboard sends anonymous users to login safely', async ({ page }) => {
    await open(page, '/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard|\/login\?redirect=\/dashboard/);
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  });

  test('@critical signup collects identity then academic context', async ({ page }) => {
    await open(page, '/signup');
    await page.getByLabel('الاسم الكامل').fill('باحث اختبار');
    await page.getByLabel('البريد الإلكتروني').fill('e2e@example.com');
    await page.locator('#password').fill('Strong-E2E-Pass-2026!');
    await expect(page.getByLabel('الاسم الكامل')).toHaveValue('باحث اختبار');
    await expect(page.getByLabel('البريد الإلكتروني')).toHaveValue('e2e@example.com');
    await page.getByRole('button', { name: 'متابعة ←' }).click();

    await expect(page.getByLabel('التخصص الأكاديمي')).toBeVisible();
    await expect(page.getByLabel('الدولة أو البيئة البحثية الأساسية')).toBeVisible();
    await expect(page.getByLabel('الجامعة أو المؤسسة')).toBeVisible();
    await expect(page.getByLabel('المستوى الأكاديمي')).toBeVisible();
  });

  test('@critical recovery and invalid reset states are explicit', async ({ page }) => {
    await open(page, '/forgot-password');
    await expect(page.getByRole('heading', { name: 'استعادة كلمة المرور' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إرسال رابط الاستعادة' })).toBeVisible();

    await open(page, '/reset-password?error=invalid-or-expired');
    await expect(page.getByRole('heading', { name: 'رابط الاستعادة غير صالح' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'طلب رابط جديد' })).toBeVisible();
  });

  test('@critical exploration validates scenarios before external AI calls', async ({ page }) => {
    await open(page, '/verify-idea');
    await page.getByRole('button', { name: /أقارن بين عناوين/ }).click();
    await page.locator('textarea').first().fill('التعليم الجامعي');
    await page.getByPlaceholder('العنوان 1').fill('أثر الذكاء الاصطناعي في التعليم الجامعي');
    await page.getByRole('button', { name: 'حلّل المسار البحثي' }).click();
    await expect(page.getByText('اكتب عنوانين واضحين على الأقل، لا يقل كل عنوان عن 10 أحرف.', { exact: true })).toBeVisible();
  });
});
