import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { deleteAccountPdfFiles } from '@/lib/pdf-evidence-server';
import { readAccountArchiveRows, readAccountProjectRows, type ArchiveCollection } from '@/lib/account-archive-reader';

const RECENT_AUTH_WINDOW_SECONDS = 10 * 60;

function credentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('SUPABASE_PUBLIC_CREDENTIALS_MISSING');
  return { url, anonKey };
}

const OWNED_COLLECTIONS = {
  profile: { table: 'profiles', columns: 'id, full_name, email, role, free_credits, created_at', userColumn: 'id' },
  usage: { table: 'users_usage', columns: 'id, created_at, idea_text, report_score', userColumn: 'user_id' },
  verifications: { table: 'idea_verifications', columns: 'id, topic, translated_query, acceptance_score, decision, total_papers, gaps_count, created_at', userColumn: 'user_id' },
  subscription: { table: 'subscriptions', columns: 'plan, status, current_period_end, created_at, updated_at', keys: ['user_id'], userColumn: 'user_id' },
  integrations: { table: 'user_integrations', columns: 'provider, external_user_id, permissions, status, connected_at, revoked_at', keys: ['provider'], userColumn: 'user_id' },
  researchProjects: { table: 'research_projects', columns: 'id, project_title, discipline, current_step, brain_status, clarity_score, created_at', userColumn: 'user_id' },
  savedPapers: { table: 'saved_papers', columns: 'id, title, abstract, year, citation_count, pdf_url, source, created_at', userColumn: 'user_id' },
} satisfies Record<string, ArchiveCollection>;

const PROJECT_COLLECTIONS = {
  references: { table: 'project_references', columns: 'id, project_id, work_id, provider, external_item_key, doi, isbn, title, authors, publication_year, publication_title, url, citation_data, source_version, synced_at, created_at', userColumn: 'user_id' },
  documents: { table: 'documents', columns: 'id, project_id, type, content, version, created_at' },
  sources: { table: 'sources', columns: 'id, project_id, raw_text, parsed_citation_apa, parsed_citation_ieee, confidence, created_at' },
  generations: { table: 'ai_generations_log', columns: 'id, project_id, feature, prompt_hash, model, output, confidence_label, created_at' },
  drafts: { table: 'research_stage_drafts', columns: 'project_id, stage, content, client_updated_at, updated_at', keys: ['project_id', 'stage'] },
  researchProfiles: { table: 'research_profiles', columns: 'id, project_id, summary, ai_recommendations, health_score, current_stage, next_action, active_tasks_count, recent_activity, references_count, chapters_progress, updated_at' },
  evidence: { table: 'evidence_items', columns: 'id, project_id, project_reference_id, work_id, source_kind, evidence_type, content, locator, origin, state, state_set_by, state_set_at, provenance, created_at, updated_at' },
  claims: { table: 'claims', columns: 'id, project_id, statement, claim_type, origin, status, confirmed_at, created_at, updated_at' },
  claimSupports: { table: 'claim_supports', columns: 'id, project_id, claim_id, evidence_item_id, relation, origin, confirmation, rationale, decided_at, provenance, created_at, updated_at' },
  gaps: { table: 'gap_assessments', columns: 'id, project_id, claim_id, classification, rationale, limitations, basis, search_run_ids, scope, origin, method_version, researcher_confirmation, confirmed_at, generated_at' },
  searchRuns: { table: 'research_search_runs', columns: 'id, project_id, context, query, domain, providers, providers_attempted, providers_available, candidate_count, result_count, limitations, executed_at, created_at', userColumn: 'user_id' },
  integrityEvents: { table: 'research_integrity_events', columns: 'id, project_id, actor, entity_type, entity_id, action, details, created_at' },
} satisfies Record<string, ArchiveCollection>;

export async function buildAccountArchive(user: User) {
  const service = createServiceClient();
  const projectCollection = { table: 'projects', columns: 'id, title, status, university_policy, created_at', userColumn: 'user_id' };
  const projects = await readAccountArchiveRows(service, projectCollection, user.id);
  const projectIds = projects.map(project => String(project.id));
  const owned = Object.fromEntries(await Promise.all(Object.entries(OWNED_COLLECTIONS).map(async ([key, collection]) => [key, await readAccountArchiveRows(service, collection, user.id)]))) as Record<keyof typeof OWNED_COLLECTIONS, Record<string, unknown>[]>;
  const research = Object.fromEntries(await Promise.all(Object.entries(PROJECT_COLLECTIONS).map(async ([key, collection]) => [key, await readAccountProjectRows(service, collection, user.id, projectIds)]))) as Record<keyof typeof PROJECT_COLLECTIONS, Record<string, unknown>[]>;
  // Do not release a file based on a project list that lost/gained ownership
  // during the read. This is not a transactional snapshot of concurrent edits.
  const current = await readAccountArchiveRows(service, { ...projectCollection, columns: 'id' }, user.id);
  if (current.length !== projectIds.length || current.some((project, index) => project.id !== projectIds[index])) {
    throw new Error('ACCOUNT_EXPORT_PROJECTS_CHANGED');
  }
  return {
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id, email: user.email ?? null, phone: user.phone ?? null,
      createdAt: user.created_at, updatedAt: user.updated_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      providers: user.app_metadata.providers ?? (user.app_metadata.provider ? [user.app_metadata.provider] : []),
      profile: owned.profile,
    },
    research: { projects, researchProjects: owned.researchProjects, savedPapers: owned.savedPapers, verifications: owned.verifications, usage: owned.usage, ...research },
    subscription: owned.subscription,
    integrations: owned.integrations,
    exclusions: [
      'Integration access tokens and encrypted credentials are excluded for security.',
      'Authentication secrets, password hashes, and active session tokens are never exportable.',
      'Original PDF binaries can be downloaded from their private project readers; this JSON archive contains their saved metadata and extracted text.',
      'Shared scholarly catalogs and temporary search caches are excluded; saved project references and recorded search runs are included.',
      'Support and email correspondence are separate records; contact support about those records.',
    ],
  };
}

function latestMethodTimestamp(methods: Array<string | { method: string; timestamp: number }>) {
  return methods.reduce((latest, entry) => {
    if (typeof entry === 'string') return latest;
    return Math.max(latest, entry.timestamp || 0);
  }, 0);
}

export async function verifyAccountDeletion(user: User, password: string | undefined, supabase: {
  auth: {
    mfa: { getAuthenticatorAssuranceLevel(): Promise<{ data: { currentLevel: string | null; currentAuthenticationMethods: Array<string | { method: string; timestamp: number }> } | null; error: unknown }> };
  };
}) {
  const providers = user.app_metadata.providers ?? (user.app_metadata.provider ? [user.app_metadata.provider] : []);
  const hasEmailProvider = providers.includes('email');

  if (hasEmailProvider) {
    if (!user.email || !password || password.length > 1_024) return false;
    const { url, anonKey } = credentials();
    const verifier = createSupabaseClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await verifier.auth.signInWithPassword({ email: user.email, password });
    if (data.session?.access_token) await verifier.auth.signOut({ scope: 'local' });
    return !error && data.user?.id === user.id;
  }

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  const latest = latestMethodTimestamp(data.currentAuthenticationMethods);
  const lastSignIn = user.last_sign_in_at ? Math.floor(Date.parse(user.last_sign_in_at) / 1_000) : 0;
  const verifiedAt = Math.max(latest, lastSignIn);
  return verifiedAt > 0 && Math.floor(Date.now() / 1_000) - verifiedAt <= RECENT_AUTH_WINDOW_SECONDS;
}

export async function permanentlyDeleteAccount(userId: string, accessToken: string) {
  const service = createServiceClient();

  const { data: subscription, error: subscriptionError } = await service
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  if (subscriptionError) throw new Error('ACCOUNT_DELETE_SUBSCRIPTION_CHECK_FAILED');
  if (subscription && ['active', 'trialing', 'past_due'].includes(subscription.status)) {
    throw new Error('ACCOUNT_DELETE_ACTIVE_SUBSCRIPTION');
  }

  await deleteAccountPdfFiles(service, userId);
  const { error: signOutError } = await service.auth.admin.signOut(accessToken, 'global');
  if (signOutError) throw new Error('ACCOUNT_DELETE_SESSION_REVOCATION_FAILED');
  const { error: deleteError } = await service.auth.admin.deleteUser(userId, false);
  if (deleteError) throw new Error('ACCOUNT_DELETE_AUTH_USER_FAILED');
}
