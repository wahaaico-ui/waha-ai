import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.toUpperCase().replace(/=|\s/g, '')) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid TOTP secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return number.toString().padStart(6, '0');
}

async function waitForFreshTotp(page: Page, secret: string, previous: string) {
  let current = totp(secret);
  if (current !== previous) return current;
  const waitMs = 30_000 - (Date.now() % 30_000) + 750;
  await page.waitForTimeout(waitMs);
  current = totp(secret);
  return current;
}

async function logout(page: Page) {
  const logoutButton = page.getByRole('button', { name: 'خروج' });
  if (!(await logoutButton.isVisible())) {
    await page.getByRole('button', { name: 'Open menu' }).click();
  }
  await logoutButton.click();
  await expect(page).toHaveURL(/\/(?:$|login(?:\?redirect=%2Fdashboard|\?redirect=\/dashboard)?$)/);
}

test('@critical enrolls, requires, verifies, and removes TOTP MFA', async ({ page }) => {
  test.setTimeout(90_000);
  const email = process.env.E2E_MFA_EMAIL;
  const password = process.env.E2E_MFA_PASSWORD;
  test.skip(!email || !password, 'Set temporary E2E MFA credentials.');
  if (!email || !password) throw new Error('Temporary MFA credentials are required.');

  await page.goto('/login', { waitUntil: 'load' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });

  await page.goto('/settings/security', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'تفعيل التحقق الثنائي' }).click();
  const secret = (await page.locator('code[dir="ltr"]').textContent())?.trim();
  if (!secret) throw new Error('TOTP enrollment secret was not rendered.');
  const enrollmentCode = totp(secret);
  await page.locator('#setup-code').fill(enrollmentCode);
  await page.getByRole('button', { name: 'تأكيد التفعيل' }).click();
  await expect(page.getByText('التحقق الثنائي مفعّل', { exact: true })).toBeVisible();

  await page.goto('/dashboard', { waitUntil: 'load' });
  await logout(page);
  await page.goto('/login', { waitUntil: 'load' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/auth\/mfa\?next=/, { timeout: 20_000 });

  const challengeCode = await waitForFreshTotp(page, secret, enrollmentCode);
  await page.locator('#mfa-code').fill(challengeCode);
  await page.getByRole('button', { name: 'تحقق وتابع' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'مشاريعي البحثية' })).toBeVisible();

  await page.goto('/settings/security', { waitUntil: 'load' });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'إيقاف التحقق الثنائي' }).click();
  await expect(page.getByRole('status')).toContainText('تم إيقاف التحقق الثنائي.');
  await expect(page.getByRole('button', { name: 'تفعيل التحقق الثنائي' })).toBeVisible();

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await logout(page);
});
