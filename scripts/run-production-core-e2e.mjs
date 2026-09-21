import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const baseUrl = process.env.E2E_BASE_URL?.trim() || 'https://waha.systems';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://zwbtgwgthbyddvurmefk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for isolated production E2E fixtures.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const createdUserIds = new Set();

function credentials(label) {
  const suffix = randomUUID();
  return {
    email: `e2e-${label}+${suffix}@waha.systems`,
    password: `Waha-${randomBytes(24).toString('base64url')}!9a`,
  };
}

async function createFixture(label, projectTitle) {
  const account = credentials(label);
  const created = await admin.auth.admin.createUser({
    ...account,
    email_confirm: true,
    user_metadata: { full_name: `اختبار إنتاج ${label}` },
  });
  if (created.error || !created.data.user) throw created.error || new Error(`Unable to create ${label} user.`);
  const userId = created.data.user.id;
  createdUserIds.add(userId);
  let projectId;
  if (projectTitle) {
    const inserted = await admin.from('projects')
      .insert({ user_id: userId, title: projectTitle, status: 'draft' })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) throw inserted.error || new Error(`Unable to create ${label} project.`);
    projectId = inserted.data.id;
  }
  return { ...account, userId, projectId };
}

function runPlaywright(args, environment) {
  const run = spawnSync('npx', ['playwright', 'test', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...environment, E2E_BASE_URL: baseUrl, E2E_REQUIRE_AUTH: 'true' },
  });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`Playwright gate failed with exit code ${run.status ?? 1}.`);
}

async function removeUser(userId) {
  const existing = await admin.auth.admin.getUserById(userId);
  if (existing.error || !existing.data.user) return;
  const removed = await admin.auth.admin.deleteUser(userId);
  if (removed.error) throw removed.error;
}

async function main() {
  const primary = await createFixture('core', 'مشروع اختبار الإنتاج الكامل');
  const privacy = await createFixture('privacy', 'مشروع اختبار خصوصية الحساب');
  const mfa = await createFixture('mfa');
  const recovery = await createFixture('recovery');

  const environment = {
    E2E_TEST_EMAIL: primary.email,
    E2E_TEST_PASSWORD: primary.password,
    E2E_TEST_PROJECT_ID: primary.projectId,
    E2E_JOURNEY_EMAIL: primary.email,
    E2E_JOURNEY_PASSWORD: primary.password,
    E2E_JOURNEY_PROJECT_ID: primary.projectId,
    E2E_PRIVACY_EMAIL: privacy.email,
    E2E_PRIVACY_PASSWORD: privacy.password,
    E2E_MFA_EMAIL: mfa.email,
    E2E_MFA_PASSWORD: mfa.password,
    E2E_RECOVERY_EMAIL: recovery.email,
  };

  runPlaywright([
    'tests/e2e/public-smoke.spec.ts',
    'tests/e2e/authenticated-critical.spec.ts',
    'tests/e2e/research-journey.spec.ts',
    'tests/e2e/google-oauth.spec.ts',
    'tests/e2e/mfa.spec.ts',
    'tests/e2e/account-privacy.spec.ts',
    '--project=chromium-desktop',
  ], environment);

  runPlaywright(['tests/e2e/public-smoke.spec.ts', '--project=android-mobile'], environment);

  const recoveryLink = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: recovery.email,
    options: { redirectTo: `${baseUrl}/reset-password` },
  });
  const actionLink = recoveryLink.data?.properties?.action_link;
  if (recoveryLink.error || !actionLink) throw recoveryLink.error || new Error('Unable to generate recovery link.');

  runPlaywright([
    'tests/e2e/password-recovery.spec.ts',
    '--project=chromium-desktop',
    '--grep',
    'changes the password through a recovery token',
  ], { ...environment, E2E_RECOVERY_URL: actionLink, E2E_RECOVERY_NEW_PASSWORD: credentials('changed').password });

  runPlaywright([
    'tests/e2e/password-recovery.spec.ts',
    '--project=chromium-desktop',
    '--grep',
    'accepts a recovery request',
  ], environment);

  console.log('Production E2E gate passed with isolated temporary accounts and projects.');
}

try {
  await main();
} finally {
  const cleanup = await Promise.allSettled([...createdUserIds].map(removeUser));
  const failures = cleanup.filter((item) => item.status === 'rejected');
  if (failures.length > 0) {
    console.error(`Fixture cleanup failed for ${failures.length} temporary account(s).`);
    process.exitCode = 1;
  }
}
