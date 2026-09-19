import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

const RECENT_AUTH_WINDOW_SECONDS = 10 * 60;

type QueryResult = { data: unknown; error: { code?: string } | null };

function credentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('SUPABASE_PUBLIC_CREDENTIALS_MISSING');
  return { url, anonKey };
}

async function rows<T = Record<string, unknown>>(result: PromiseLike<QueryResult>, label: string): Promise<T[]> {
  const { data, error } = await result;
  if (error) throw new Error(`ACCOUNT_EXPORT_${label}_FAILED`);
  if (data === null || data === undefined) return [];
  return (Array.isArray(data) ? data : [data]) as T[];
}

export async function buildAccountArchive(user: User) {
  const service = createServiceClient();
  const projects = await rows<{ id: string }>(
    service.from('projects').select('id, title, status, university_policy, created_at').eq('user_id', user.id).order('created_at'),
    'PROJECTS',
  );
  const projectIds = projects.map((project) => project.id);

  const [profile, usage, verifications, subscription, integrations, references] = await Promise.all([
    rows(service.from('profiles').select('id, university, degree').eq('id', user.id), 'PROFILE'),
    rows(service.from('users_usage').select('id, created_at, idea_text, report_score').eq('user_id', user.id).order('created_at'), 'USAGE'),
    rows(service.from('idea_verifications').select('id, topic, translated_query, acceptance_score, decision, total_papers, gaps_count, created_at').eq('user_id', user.id).order('created_at'), 'VERIFICATIONS'),
    rows(service.from('subscriptions').select('plan, status, current_period_end, created_at, updated_at').eq('user_id', user.id), 'SUBSCRIPTION'),
    rows(service.from('user_integrations').select('provider, external_user_id, permissions, status, connected_at, revoked_at').eq('user_id', user.id), 'INTEGRATIONS'),
    rows(service.from('project_references').select('id, project_id, provider, external_item_key, doi, isbn, title, authors, publication_year, publication_title, url, citation_data, source_version, synced_at, created_at').eq('user_id', user.id).order('created_at'), 'REFERENCES'),
  ]);

  let documents: unknown[] = [];
  let sources: unknown[] = [];
  let generations: unknown[] = [];
  let journeys: Array<{ id: string }> = [];
  if (projectIds.length > 0) {
    [documents, sources, generations, journeys] = await Promise.all([
      rows(service.from('documents').select('id, project_id, type, content, version, created_at').in('project_id', projectIds).order('created_at'), 'DOCUMENTS'),
      rows(service.from('sources').select('id, project_id, raw_text, parsed_citation_apa, parsed_citation_ieee, confidence, created_at').in('project_id', projectIds).order('created_at'), 'SOURCES'),
      rows(service.from('ai_generations_log').select('id, project_id, feature, prompt_hash, model, output, confidence_label, created_at').in('project_id', projectIds).order('created_at'), 'GENERATIONS'),
      rows<{ id: string }>(service.from('research_journeys').select('id, project_id, current_stage, status, created_at, updated_at').in('project_id', projectIds).order('created_at'), 'JOURNEYS'),
    ]);
  }

  const journeyIds = journeys.map((journey) => journey.id);
  let stageOutputs: unknown[] = [];
  let decisions: unknown[] = [];
  if (journeyIds.length > 0) {
    [stageOutputs, decisions] = await Promise.all([
      rows(service.from('research_stage_outputs').select('id, journey_id, stage, content, version, created_at').in('journey_id', journeyIds).order('created_at'), 'STAGE_OUTPUTS'),
      rows(service.from('research_decisions').select('id, journey_id, stage, decision, note, created_at').in('journey_id', journeyIds).order('created_at'), 'DECISIONS'),
    ]);
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      providers: user.app_metadata.providers ?? (user.app_metadata.provider ? [user.app_metadata.provider] : []),
      profile,
    },
    research: { projects, documents, sources, references, journeys, stageOutputs, decisions, generations, verifications, usage },
    subscription,
    integrations,
    exclusions: [
      'Integration access tokens and encrypted credentials are excluded for security.',
      'Authentication secrets, password hashes, and active session tokens are never exportable.',
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

  const { error: signOutError } = await service.auth.admin.signOut(accessToken, 'global');
  if (signOutError) throw new Error('ACCOUNT_DELETE_SESSION_REVOCATION_FAILED');
  const { error: deleteError } = await service.auth.admin.deleteUser(userId, false);
  if (deleteError) throw new Error('ACCOUNT_DELETE_AUTH_USER_FAILED');
}
