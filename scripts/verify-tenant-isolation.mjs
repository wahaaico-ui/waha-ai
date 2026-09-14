import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('Supabase test environment is not configured');
}

const service = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const clientFor = () => createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const password = `Waha!E2e-${crypto.randomUUID()}-9Aa`;
const createdUserIds = [];
let projectId = null;
let verificationId = null;
const rateLimitIdentifier = `authorization-test:${runId}`;

async function createTestUser(suffix) {
  const { data, error } = await service.auth.admin.createUser({
    email: `waha-e2e-${runId}-${suffix}@example.com`,
    password,
    email_confirm: true,
    user_metadata: { test_run: runId },
  });
  if (error || !data.user) throw error || new Error('Unable to create isolated test user');
  createdUserIds.push(data.user.id);
  return data.user;
}

async function signIn(user) {
  const client = clientFor();
  const { error } = await client.auth.signInWithPassword({ email: user.email, password });
  if (error) throw error;
  return client;
}

async function run() {
  const userA = await createTestUser('a');
  const userB = await createTestUser('b');
  const clientA = await signIn(userA);
  const clientB = await signIn(userB);
  const anonymousClient = clientFor();

  const { data: project, error: projectError } = await clientA
    .from('projects')
    .insert({ user_id: userA.id, title: `RLS test ${runId}`, status: 'draft' })
    .select('id, user_id')
    .single();
  if (projectError || !project) throw projectError || new Error('User A could not create an owned project');
  projectId = project.id;
  assert.equal(project.user_id, userA.id);

  const { data: visibleToA, error: readAError } = await clientA.from('projects').select('id').eq('id', projectId);
  if (readAError) throw readAError;
  assert.equal(visibleToA.length, 1, 'User A must read the owned project');

  const { data: visibleToB, error: readBError } = await clientB.from('projects').select('id').eq('id', projectId);
  if (readBError) throw readBError;
  assert.equal(visibleToB.length, 0, 'User B must not read user A project');

  const { data: changedByB, error: updateBError } = await clientB
    .from('projects')
    .update({ title: 'unauthorized change' })
    .eq('id', projectId)
    .select('id');
  if (updateBError) throw updateBError;
  assert.equal(changedByB.length, 0, 'User B must not update user A project');

  const { data: document, error: documentAError } = await clientA
    .from('documents')
    .insert({ project_id: projectId, type: 'journey:verify', content: '{}', version: 1 })
    .select('id')
    .single();
  if (documentAError || !document) throw documentAError || new Error('User A could not create an owned document');

  const { data: documentVisibleToB, error: documentReadBError } = await clientB
    .from('documents')
    .select('id')
    .eq('id', document.id);
  if (documentReadBError) throw documentReadBError;
  assert.equal(documentVisibleToB.length, 0, 'User B must not read user A document');

  const { error: documentWriteBError } = await clientB
    .from('documents')
    .insert({ project_id: projectId, type: 'journey:title', content: '{}', version: 1 });
  assert.ok(documentWriteBError, 'User B document insert must be rejected by RLS');

  const { error: directVerificationWriteError } = await clientA
    .from('idea_verifications')
    .insert({
      user_id: userA.id,
      user_ip: `authorization-test:${runId}`,
      topic: 'Disposable authorization test',
      translated_query: 'Disposable authorization test',
      acceptance_score: 0,
      decision: 'test',
      total_papers: 0,
      gaps_count: 0,
    });
  assert.ok(directVerificationWriteError, 'Browser clients must not write verification audit records directly');

  const { data: verification, error: verificationAError } = await service
    .from('idea_verifications')
    .insert({
      user_id: userA.id,
      user_ip: `authorization-test:${runId}:server`,
      topic: 'Disposable server-mediated authorization test',
      translated_query: 'Disposable server-mediated authorization test',
      acceptance_score: 0,
      decision: 'test',
      total_papers: 0,
      gaps_count: 0,
    })
    .select('id')
    .single();
  if (verificationAError || !verification) {
    throw verificationAError || new Error('User A could not create an owned verification');
  }
  verificationId = verification.id;

  const { data: verificationVisibleToA, error: verificationReadAError } = await clientA
    .from('idea_verifications')
    .select('id')
    .eq('id', verificationId);
  if (verificationReadAError) throw verificationReadAError;
  assert.equal(verificationVisibleToA.length, 1, 'User A must read the owned server-created verification');

  const { data: verificationVisibleToB, error: verificationReadBError } = await clientB
    .from('idea_verifications')
    .select('id')
    .eq('id', verificationId);
  if (verificationReadBError) throw verificationReadBError;
  assert.equal(verificationVisibleToB.length, 0, 'User B must not read user A verification');

  const { data: verificationVisibleToAnonymous, error: verificationReadAnonymousError } = await anonymousClient
    .from('idea_verifications')
    .select('id')
    .eq('id', verificationId);
  if (verificationReadAnonymousError) {
    assert.equal(verificationReadAnonymousError.code, '42501', 'Anonymous verification reads must be denied by grants or RLS');
  } else {
    assert.equal(verificationVisibleToAnonymous.length, 0, 'Anonymous users must not read verification history');
  }

  const { error: verificationImpersonationError } = await clientB
    .from('idea_verifications')
    .insert({
      user_id: userA.id,
      user_ip: `authorization-test:${runId}:impersonation`,
      topic: 'Rejected impersonation test',
      translated_query: null,
      acceptance_score: 0,
      decision: 'test',
      total_papers: 0,
      gaps_count: 0,
    });
  assert.ok(verificationImpersonationError, 'User B must not insert a verification as user A');

  const { data: firstRateLimit, error: firstRateLimitError } = await service.rpc('check_rate_limit', {
    p_ip: rateLimitIdentifier,
    p_max_requests: 1,
    p_window_seconds: 60,
  });
  if (firstRateLimitError) throw firstRateLimitError;
  assert.equal(firstRateLimit, true, 'The first rate-limited request must be accepted');

  const { data: secondRateLimit, error: secondRateLimitError } = await service.rpc('check_rate_limit', {
    p_ip: rateLimitIdentifier,
    p_max_requests: 1,
    p_window_seconds: 60,
  });
  if (secondRateLimitError) throw secondRateLimitError;
  assert.equal(secondRateLimit, false, 'A request above the configured limit must be rejected');

  console.log('PASS user A can read and write owned project data');
  console.log('PASS user B cannot read or update user A project');
  console.log('PASS user B cannot read or insert documents in user A project');
  console.log('PASS verification audit writes are server-only and history is owner-private');
  console.log('PASS anonymous users cannot read verification history');
  console.log('PASS the production rate limiter accepts then blocks atomically');
}

try {
  await run();
} finally {
  await service.from('api_rate_limits').delete().eq('identifier', rateLimitIdentifier);
  if (verificationId) await service.from('idea_verifications').delete().eq('id', verificationId);
  if (projectId) await service.from('projects').delete().eq('id', projectId);
  for (const userId of createdUserIds) await service.auth.admin.deleteUser(userId);
}
