import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://zwbtgwgthbyddvurmefk.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!anonKey || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required');
}

const service = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const clientFor = () => createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const password = `Waha!E2e-${crypto.randomUUID()}-9Aa`;
const createdUserIds = [];
const cleanupRows = [];
const rateLimitIdentifier = `authorization-test:${runId}`;

function acceptableDenial(error) {
  return error?.code === '42501' || error?.code === 'PGRST301';
}

function assertHidden(result, label) {
  if (result.error) {
    assert.ok(acceptableDenial(result.error), `${label}: unexpected error ${result.error.code || result.error.message}`);
    return;
  }
  assert.equal(result.data?.length || 0, 0, label);
}

function assertMutationBlocked(result, label) {
  if (result.error) {
    assert.ok(acceptableDenial(result.error), `${label}: unexpected error ${result.error.code || result.error.message}`);
    return;
  }
  assert.equal(result.data?.length || 0, 0, label);
}

async function createTestUser(suffix) {
  const { data, error } = await service.auth.admin.createUser({
    email: `rls-${runId}-${suffix}@waha.systems`,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${suffix}`, test_run: runId },
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

async function insert(client, table, row, columns = '*') {
  const result = await client.from(table).insert(row).select(columns).single();
  if (result.error || !result.data) throw result.error || new Error(`Unable to create ${table} fixture`);
  return result.data;
}

async function assertOwnerCanRead(client, table, key, value, label) {
  const result = await client.from(table).select(key).eq(key, value);
  if (result.error) throw result.error;
  assert.equal(result.data.length, 1, label);
}

async function assertCannotRead(client, table, key, value, label) {
  const result = await client.from(table).select(key).eq(key, value);
  assertHidden(result, label);
}

async function assertCannotUpdate(client, table, key, value, patch, label) {
  const result = await client.from(table).update(patch).eq(key, value).select(key);
  assertMutationBlocked(result, label);
}

async function assertCannotDelete(client, table, key, value, label) {
  const result = await client.from(table).delete().eq(key, value).select(key);
  assertMutationBlocked(result, label);
}

async function assertServiceRowExists(table, key, value, label) {
  const result = await service.from(table).select(key).eq(key, value);
  if (result.error) throw result.error;
  assert.equal(result.data.length, 1, label);
}

async function run() {
  const userA = await createTestUser('a');
  const userB = await createTestUser('b');
  const clientA = await signIn(userA);
  const clientB = await signIn(userB);
  const anonymousClient = clientFor();

  const project = await insert(clientA, 'projects', {
    user_id: userA.id,
    title: `RLS test ${runId}`,
    status: 'draft',
  }, 'id, user_id');
  assert.equal(project.user_id, userA.id);

  // journey:* documents and the AI generation log are server-owned: the
  // application writes them with the server client, so the fixtures do too.
  const document = await insert(service, 'documents', {
    project_id: project.id,
    type: 'journey:verify',
    content: '{"owner":"a"}',
    version: 1,
  }, 'id');
  const source = await insert(clientA, 'sources', {
    project_id: project.id,
    raw_text: `RLS source ${runId}`,
    confidence: 'high',
  }, 'id');
  const generation = await insert(service, 'ai_generations_log', {
    project_id: project.id,
    feature: 'rls-test',
    model: 'fixture',
    output: 'owner-a',
    confidence_label: 'high',
  }, 'id');
  const reference = await insert(clientA, 'project_references', {
    project_id: project.id,
    user_id: userA.id,
    provider: 'manual-test',
    external_item_key: runId,
    title: `RLS reference ${runId}`,
  }, 'id');
  const draft = await insert(clientA, 'research_stage_drafts', {
    project_id: project.id,
    stage: 'verify',
    content: { owner: 'a' },
    client_updated_at: new Date().toISOString(),
  }, 'project_id, stage');

  const profile = await service.from('profiles').select('id').eq('id', userA.id).maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) {
    await insert(service, 'profiles', { id: userA.id, full_name: 'RLS A', email: userA.email }, 'id');
  }

  const usage = await insert(service, 'users_usage', {
    user_id: userA.id,
    idea_text: `RLS usage ${runId}`,
    report_score: 77,
  }, 'id');
  const subscription = await insert(service, 'subscriptions', {
    user_id: userA.id,
    plan: 'pro',
    status: 'canceled',
  }, 'user_id');
  const integration = await insert(service, 'user_integrations', {
    user_id: userA.id,
    provider: 'zotero',
    external_user_id: `rls-${runId}`,
    access_token_encrypted: 'fixture-never-a-real-secret',
  }, 'id');
  const verification = await insert(service, 'idea_verifications', {
    user_id: userA.id,
    user_ip: `authorization-test:${runId}:server`,
    topic: 'Disposable server-mediated authorization test',
    translated_query: 'Disposable server-mediated authorization test',
    acceptance_score: 0,
    decision: 'test',
    total_papers: 0,
    gaps_count: 0,
  }, 'id');
  const supportRequest = await insert(service, 'support_requests', {
    ticket_number: `RLS-${runId}`,
    user_id: userA.id,
    requester_name: 'RLS Test User',
    requester_email: userA.email,
    category: 'technical',
    subject: 'Production RLS verification fixture',
    message: 'Disposable support request used only to verify browser isolation.',
    assigned_queue: 'support',
  }, 'id');
  cleanupRows.push(['support_requests', 'id', supportRequest.id]);

  const researchProject = await insert(service, 'research_projects', {
    user_id: userA.id,
    project_title: `Legacy RLS project ${runId}`,
    discipline: 'security-test',
  }, 'id');
  const savedPaper = await insert(service, 'saved_papers', {
    user_id: userA.id,
    title: `Legacy RLS paper ${runId}`,
    source: 'security-test',
  }, 'id');
  const researchProfile = await insert(service, 'research_profiles', {
    project_id: project.id,
    summary: `RLS profile ${runId}`,
  }, 'id');

  const ownerReadable = [
    ['projects', 'id', project.id],
    ['documents', 'id', document.id],
    ['sources', 'id', source.id],
    ['ai_generations_log', 'id', generation.id],
    ['project_references', 'id', reference.id],
    ['research_stage_drafts', 'project_id', draft.project_id],
    ['profiles', 'id', userA.id],
    ['users_usage', 'id', usage.id],
    ['subscriptions', 'user_id', subscription.user_id],
    ['idea_verifications', 'id', verification.id],
  ];
  for (const [table, key, value] of ownerReadable) {
    await assertOwnerCanRead(clientA, table, key, value, `Owner must read ${table}`);
    await assertCannotRead(clientB, table, key, value, `User B must not read user A ${table}`);
    await assertCannotRead(anonymousClient, table, key, value, `Anonymous client must not read ${table}`);
  }

  const serverOrLegacyRows = [
    ['user_integrations', 'id', integration.id],
    ['support_requests', 'id', supportRequest.id],
    ['research_projects', 'id', researchProject.id],
    ['saved_papers', 'id', savedPaper.id],
    ['research_profiles', 'id', researchProfile.id],
  ];
  for (const [table, key, value] of serverOrLegacyRows) {
    await assertCannotRead(clientB, table, key, value, `User B must not read user A ${table}`);
    await assertCannotRead(anonymousClient, table, key, value, `Anonymous client must not read ${table}`);
  }

  await assertCannotUpdate(clientB, 'projects', 'id', project.id, { title: 'unauthorized' }, 'User B must not update user A project');
  await assertCannotDelete(clientB, 'projects', 'id', project.id, 'User B must not delete user A project');
  await assertCannotUpdate(clientB, 'documents', 'id', document.id, { content: 'unauthorized' }, 'User B must not update user A document');
  await assertCannotDelete(clientB, 'documents', 'id', document.id, 'User B must not delete user A document');
  await assertCannotUpdate(clientB, 'sources', 'id', source.id, { raw_text: 'unauthorized' }, 'User B must not update user A source');
  await assertCannotDelete(clientB, 'sources', 'id', source.id, 'User B must not delete user A source');
  await assertCannotUpdate(clientB, 'project_references', 'id', reference.id, { title: 'unauthorized' }, 'User B must not update user A reference');
  await assertCannotDelete(clientB, 'project_references', 'id', reference.id, 'User B must not delete user A reference');
  await assertCannotUpdate(clientB, 'research_stage_drafts', 'project_id', project.id, { content: { owner: 'b' } }, 'User B must not update user A draft');
  await assertCannotDelete(clientB, 'research_stage_drafts', 'project_id', project.id, 'User B must not delete user A draft');
  await assertCannotUpdate(clientB, 'profiles', 'id', userA.id, { full_name: 'unauthorized' }, 'User B must not update user A profile');
  await assertCannotDelete(clientB, 'profiles', 'id', userA.id, 'User B must not delete user A profile');

  const unauthorizedDocument = await clientB.from('documents').insert({
    project_id: project.id,
    type: 'journey:title',
    content: '{}',
    version: 1,
  }).select('id');
  assertMutationBlocked(unauthorizedDocument, 'User B must not insert into user A project');
  const unauthorizedReference = await clientB.from('project_references').insert({
    project_id: project.id,
    user_id: userB.id,
    provider: 'manual-test',
    external_item_key: `unauthorized-${runId}`,
    title: 'unauthorized',
  }).select('id');
  assertMutationBlocked(unauthorizedReference, 'User B must not add a reference to user A project');
  const unauthorizedDraft = await clientB.rpc('save_research_stage_draft', {
    p_project_id: project.id,
    p_stage: 'problem',
    p_content: { owner: 'b' },
    p_client_updated_at: new Date().toISOString(),
  });
  assert.ok(acceptableDenial(unauthorizedDraft.error), 'Draft RPC must preserve RLS for user B');

  for (const [table, key, value, patchValue] of [
    ['users_usage', 'id', usage.id, { report_score: 1 }],
    ['subscriptions', 'user_id', userA.id, { plan: 'institutional' }],
    ['idea_verifications', 'id', verification.id, { decision: 'unauthorized' }],
    ['user_integrations', 'id', integration.id, { access_token_encrypted: 'stolen' }],
    ['support_requests', 'id', supportRequest.id, { status: 'closed' }],
  ]) {
    await assertCannotUpdate(clientA, table, key, value, patchValue, `Browser owner must not directly update server-managed ${table}`);
    await assertCannotDelete(clientA, table, key, value, `Browser owner must not directly delete server-managed ${table}`);
    await assertServiceRowExists(table, key, value, `Server-managed ${table} must remain intact`);
  }

  // Integrity (not confidentiality): the owner must not forge or rewrite the
  // server-owned research state of their own project.
  for (const type of ['journey:verify', 'idea_verification']) {
    const forged = await clientA.from('documents').insert({
      project_id: project.id,
      type,
      content: '{"decision":"proceed","searchCoverage":{"uniqueStudies":999}}',
      version: 99,
    }).select('id');
    assertMutationBlocked(forged, `Browser owner must not insert a server-owned ${type} document`);
  }
  await assertCannotUpdate(clientA, 'documents', 'id', document.id, { content: '{"decision":"proceed"}' }, 'Browser owner must not rewrite a server-owned journey document');
  await assertCannotDelete(clientA, 'documents', 'id', document.id, 'Browser owner must not delete a server-owned journey document');
  await assertServiceRowExists('documents', 'id', document.id, 'Server-owned journey document must remain intact');
  const forgedGeneration = await clientA.from('ai_generations_log').insert({
    project_id: project.id,
    feature: 'forged',
    model: 'browser',
    output: 'forged',
    confidence_label: 'high',
  }).select('id');
  assertMutationBlocked(forgedGeneration, 'Browser owner must not forge AI generation audit rows');
  await assertCannotUpdate(clientA, 'ai_generations_log', 'id', generation.id, { output: 'forged' }, 'Browser owner must not rewrite AI generation audit rows');

  const directUsageInsert = await clientA.from('users_usage').insert({
    user_id: userA.id,
    idea_text: 'forged browser usage',
    report_score: 100,
  }).select('id');
  assertMutationBlocked(directUsageInsert, 'Browser clients must not forge usage records');
  const directVerificationInsert = await clientA.from('idea_verifications').insert({
    user_id: userA.id,
    user_ip: `authorization-test:${runId}:browser`,
    topic: 'forged browser verification',
    acceptance_score: 100,
    decision: 'forged',
    total_papers: 999,
    gaps_count: 999,
  }).select('id');
  assertMutationBlocked(directVerificationInsert, 'Browser clients must not forge verification records');

  const firstRateLimit = await service.rpc('check_rate_limit', {
    p_ip: rateLimitIdentifier,
    p_max_requests: 1,
    p_window_seconds: 60,
  });
  if (firstRateLimit.error) throw firstRateLimit.error;
  assert.equal(firstRateLimit.data, true, 'The first rate-limited request must be accepted');
  const secondRateLimit = await service.rpc('check_rate_limit', {
    p_ip: rateLimitIdentifier,
    p_max_requests: 1,
    p_window_seconds: 60,
  });
  if (secondRateLimit.error) throw secondRateLimit.error;
  assert.equal(secondRateLimit.data, false, 'A request above the configured limit must be rejected');
  const browserRateLimit = await clientA.rpc('check_rate_limit', {
    p_ip: `${rateLimitIdentifier}:browser`,
    p_max_requests: 1,
    p_window_seconds: 60,
  });
  assert.ok(acceptableDenial(browserRateLimit.error), 'Browser clients must not execute the privileged rate-limit RPC directly');

  console.log('PASS owner access works for 10 browser-facing datasets');
  console.log('PASS cross-account and anonymous reads are blocked across 15 datasets');
  console.log('PASS cross-account project, document, source, reference, profile, and draft writes are blocked');
  console.log('PASS security-invoker draft RPC preserves project ownership');
  console.log('PASS 5 server-managed datasets reject direct browser mutation');
  console.log('PASS verification and usage audit records cannot be forged by browser clients');
  console.log('PASS server-owned journey documents and AI generation logs cannot be forged, rewritten or deleted by their owner');
  console.log('PASS production rate limiter accepts then blocks atomically and rejects direct browser RPC calls');
}

try {
  await run();
} finally {
  await service.from('api_rate_limits').delete().like('identifier', `${rateLimitIdentifier}%`);
  for (const [table, key, value] of cleanupRows) {
    await service.from(table).delete().eq(key, value);
  }
  for (const userId of createdUserIds) {
    await service.auth.admin.deleteUser(userId);
  }
}
