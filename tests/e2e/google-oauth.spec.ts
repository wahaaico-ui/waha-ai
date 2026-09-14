import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('@critical starts Google OAuth with the production callback', async ({ page }) => {
  await page.goto('/login?redirect=%2Fdashboard', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'الدخول بحساب Google' }).click();
  await page.waitForURL((url) => url.hostname === 'accounts.google.com', { timeout: 30_000 });

  const authorizationUrl = new URL(page.url());
  expect(authorizationUrl.protocol).toBe('https:');
  expect(authorizationUrl.hostname).toBe('accounts.google.com');
  expect(authorizationUrl.searchParams.get('client_id')).toMatch(/\.apps\.googleusercontent\.com$/);
  expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
    'https://zwbtgwgthbyddvurmefk.supabase.co/auth/v1/callback',
  );
  expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
  expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
});
