const createServiceClient = jest.fn();
const createSupabaseClient = jest.fn();

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: (...args: unknown[]) => createServiceClient(...args),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createSupabaseClient(...args),
}));

import { buildAccountArchive, verifyAccountDeletion } from '@/lib/account-privacy';
import type { User } from '@supabase/supabase-js';
import { readAccountArchiveRows } from '@/lib/account-archive-reader';

const user = {
  id: 'user-1', email: 'owner@example.test', phone: undefined,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, aud: 'authenticated',
} as User;

type Row = Record<string, unknown>;
type Page = { data: Row[] | null; error: unknown; count: number | null };
function serviceWith(source: Record<string, Row[]>, options: { ceiling?: number; alter?: (table: string, offset: number, page: Page) => Page } = {}) {
  const reads: Array<{ table: string; offset: number; size: number; keys: string[]; filters: Array<[string, unknown]>; batches: unknown[][] }> = [];
  return {
    reads,
    from: jest.fn((table: string) => {
      let columns: string[] = []; let offset = 0; let end = Infinity;
      const filters: Array<[string, unknown]> = [], batches: unknown[][] = [], orders: string[] = [];
      const query = {
        select(value: string, settings: { count: string }) { expect(settings.count).toBe('exact'); columns = value.split(',').map(s => s.trim()); return query; },
        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
        in(column: string, values: unknown[]) { filters.push([column, values]); batches.push(values); return query; },
        order(column: string) { orders.push(column); return query; },
        range(from: number, to: number) { offset = from; end = to; return query; },
        then(resolve: (value: Page) => unknown, reject?: (error: unknown) => unknown) {
          const matched = (source[table] || []).filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
          matched.sort((a, b) => { for (const key of orders) { const result = String(a[key]).localeCompare(String(b[key])); if (result) return result; } return 0; });
          const data = matched.slice(offset, Math.min(end + 1, offset + (options.ceiling ?? 1000))).map(row => Object.fromEntries(columns.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]])));
          reads.push({ table, offset, size: end - offset + 1, keys: [...orders], filters: [...filters], batches });
          const page = { data, error: null, count: matched.length };
          return Promise.resolve(options.alter ? options.alter(table, offset, page) : page).then(resolve, reject);
        },
      };
      return query;
    }),
  };
}

describe('account privacy services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
  });

  test('exports owned research data without integration credentials', async () => {
    createServiceClient.mockReturnValue(serviceWith({
      projects: [{ id: 'project-1', title: 'بحثي', user_id: 'user-1' }],
      research_stage_drafts: [{ project_id: 'project-1', stage: 'problem', content: { problem: 'مشكلة البحث' } }],
      research_projects: [{ id: 'research-project-1', project_title: 'بحث مساند', user_id: 'user-1' }],
      research_profiles: [{ id: 'profile-1', project_id: 'project-1', current_stage: 'problem' }],
      saved_papers: [{ id: 'paper-1', title: 'مرجع محفوظ', user_id: 'user-1' }],
      user_integrations: [{ provider: 'zotero', user_id: 'user-1', external_user_id: '42', access_token_encrypted: 'must-not-leak' }],
      documents: [{ id: 'document-1', project_id: 'project-1', content: 'ملخص' }],
    }));
    const archive = await buildAccountArchive(user);
    expect(archive.account.id).toBe('user-1');
    expect(archive.schemaVersion).toBe(4);
    expect(archive.research.projects).toEqual([{ id: 'project-1', title: 'بحثي' }]);
    expect(archive.research.drafts).toEqual([{ project_id: 'project-1', stage: 'problem', content: { problem: 'مشكلة البحث' } }]);
    expect(archive.research.researchProjects).toEqual([{ id: 'research-project-1', project_title: 'بحث مساند' }]);
    expect(archive.research.researchProfiles).toEqual([{ id: 'profile-1', project_id: 'project-1', current_stage: 'problem' }]);
    expect(archive.research.savedPapers).toEqual([{ id: 'paper-1', title: 'مرجع محفوظ' }]);
    expect(JSON.stringify(archive)).not.toContain('must-not-leak');
    expect(JSON.stringify(archive)).not.toContain('access_token_encrypted');
  });

  test.each([1000, 7])('exports every owned row past the provider ceiling (%i), preserving project isolation', async ceiling => {
    const projects = [{ id: 'p1', user_id: 'user-1' }, { id: 'foreign', user_id: 'other' }];
    const references = Array.from({ length: 2051 }, (_, i) => ({ id: `r-${String(i).padStart(5, '0')}`, user_id: 'user-1', project_id: 'p1', title: `Study ${i}`, created_at: '2026-01-01' }));
    const foreign = [
      { id: 'private-other', user_id: 'other', project_id: 'foreign', title: 'DO NOT EXPORT' },
      { id: 'mismatched-owner', user_id: 'user-1', project_id: 'foreign', title: 'DO NOT EXPORT' },
      { id: 'mismatched-project', user_id: 'other', project_id: 'p1', title: 'DO NOT EXPORT' },
    ];
    const service = serviceWith({ projects, project_references: [...references, ...foreign], documents: [{ id: 'd1', project_id: 'foreign', content: 'DO NOT EXPORT' }] }, { ceiling });
    createServiceClient.mockReturnValue(service);
    const archive = await buildAccountArchive(user);
    expect(archive.research.references).toHaveLength(2051);
    expect(new Set(archive.research.references.map(row => row.id)).size).toBe(2051);
    expect(archive.research.references[2050].id).toBe('r-02050');
    expect(JSON.stringify(archive)).not.toContain('DO NOT EXPORT');
    const requests = service.reads.filter(read => read.table === 'project_references');
    expect(requests.length).toBeGreaterThan(1);
    expect(requests.every(read => read.size === 200 && read.filters.some(([key, value]) => key === 'user_id' && value === user.id))).toBe(true);
    expect(requests.every(read => read.keys.includes('id'))).toBe(true);
  });

  test('batches over one thousand owned projects without an unbounded IN-list or skipped child records', async () => {
    const projects = Array.from({ length: 1051 }, (_, i) => ({ id: `p-${String(i).padStart(5, '0')}`, user_id: user.id }));
    const evidence = projects.map((project, i) => ({ id: `e-${i}`, project_id: project.id, content: 'Recorded evidence' }));
    const service = serviceWith({ projects, evidence_items: evidence });
    createServiceClient.mockReturnValue(service);
    const archive = await buildAccountArchive(user);
    expect(archive.research.projects).toHaveLength(1051);
    expect(archive.research.evidence).toHaveLength(1051);
    expect(new Set(archive.research.evidence.map(row => row.id)).size).toBe(1051);
    expect(service.reads.flatMap(read => read.batches).every(batch => batch.length <= 100)).toBe(true);
  });

  test('includes evidence, claims, support decisions, gaps and search history with composite draft keys', async () => {
    const service = serviceWith({
      projects: [{ id: 'p1', user_id: user.id }],
      research_stage_drafts: ['problem', 'methodology', 'results'].map(stage => ({ project_id: 'p1', stage, content: { stage }, updated_at: '2026-01-01' })),
      evidence_items: [{ id: 'e1', project_id: 'p1', state: 'needs_review' }],
      claims: [{ id: 'c1', project_id: 'p1', statement: 'An assertion to review' }],
      claim_supports: [{ id: 'cs1', project_id: 'p1', claim_id: 'c1', evidence_item_id: 'e1', relation: 'contradicts', confirmation: 'confirmed' }],
      gap_assessments: [{ id: 'g1', project_id: 'p1', classification: 'NEEDS_MORE_EVIDENCE', limitations: ['Limited scope'] }],
      research_search_runs: [{ id: 's1', project_id: 'p1', user_id: user.id, query: 'Research topic' }],
      research_integrity_events: [{ id: 'i1', project_id: 'p1', action: 'created' }],
      subscriptions: [{ user_id: user.id, plan: 'free', stripe_customer_id: 'must-not-leak' }],
      user_integrations: [{ id: 'hidden-id', user_id: user.id, provider: 'zotero', access_token_encrypted: 'must-not-leak' }],
    }, { ceiling: 1 });
    createServiceClient.mockReturnValue(service);
    const archive = await buildAccountArchive(user);
    expect(archive.research.drafts).toHaveLength(3);
    expect(archive.research.drafts.every(row => !Object.hasOwn(row, 'id'))).toBe(true);
    for (const key of ['evidence', 'claims', 'claimSupports', 'gaps', 'searchRuns', 'integrityEvents'] as const) expect(archive.research[key]).toHaveLength(1);
    expect(archive.research.claimSupports[0].relation).toBe('contradicts');
    expect(archive.integrations).toEqual([{ provider: 'zotero' }]);
    expect(archive.subscription).toEqual([{ plan: 'free' }]);
    expect(JSON.stringify(archive)).not.toContain('must-not-leak');
    expect(JSON.stringify(archive)).not.toContain('hidden-id');
    expect(service.reads.filter(read => read.table === 'research_stage_drafts').every(read => read.keys.join(',') === 'project_id,stage')).toBe(true);
  });

  test.each(['failure', 'changed-count', 'duplicate', 'empty-page', 'missing-count'] as const)('refuses an incomplete archive after a later-page %s', async failure => {
    const service = serviceWith({
      projects: [{ id: 'p1', user_id: user.id }],
      documents: Array.from({ length: 201 }, (_, i) => ({ id: `d-${String(i).padStart(4, '0')}`, project_id: 'p1' })),
    }, { alter: (table, offset, page) => {
      if (table !== 'documents' || offset < 200) return page;
      if (failure === 'failure') return { data: null, error: new Error('Private storage failure'), count: null };
      if (failure === 'changed-count') return { ...page, count: 202 };
      if (failure === 'duplicate') return { ...page, data: [{ id: 'd-0000', project_id: 'p1' }] };
      if (failure === 'empty-page') return { ...page, data: [] };
      return { ...page, count: null };
    } });
    createServiceClient.mockReturnValue(service);
    await expect(buildAccountArchive(user)).rejects.toThrow();
  });

  test('does not read project tables without an owned project and rejects ownership changes before release', async () => {
    const empty = serviceWith({ projects: [{ id: 'foreign', user_id: 'other' }], documents: [{ id: 'private', project_id: 'foreign' }] });
    createServiceClient.mockReturnValue(empty);
    expect((await buildAccountArchive(user)).research.documents).toEqual([]);
    expect(empty.reads.some(read => read.table === 'documents')).toBe(false);
    const source = { projects: [{ id: 'p1', user_id: user.id }], documents: [{ id: 'd1', project_id: 'p1' }] };
    const changing = serviceWith(source, { alter: (table, _offset, page) => { if (table === 'documents') source.projects = []; return page; } });
    createServiceClient.mockReturnValue(changing);
    await expect(buildAccountArchive(user)).rejects.toThrow('ACCOUNT_EXPORT_PROJECTS_CHANGED');
  });

  test('refuses any unscoped privileged read before it touches a table', async () => {
    const service = serviceWith({ documents: [{ id: 'private', project_id: 'other' }] });
    createServiceClient.mockReturnValue(service);
    await expect(readAccountArchiveRows(createServiceClient(), { table: 'documents', columns: 'id' }, user.id)).rejects.toThrow('ACCOUNT_EXPORT_SCOPE_REQUIRED');
    expect(service.from).not.toHaveBeenCalled();
  });

  test('uses the actual Supabase SDK count, ordering, projection and range contracts against a declared HTTP substitute', async () => {
    const actual = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
    const source: Record<string, Row[]> = {
      projects: [{ id: 'p1', user_id: user.id }, { id: 'foreign', user_id: 'other' }],
      project_references: [
        ...Array.from({ length: 23 }, (_, i) => ({ id: `ref-${String(i).padStart(3, '0')}`, user_id: user.id, project_id: 'p1', work_id: `work-${i}`, title: `Study ${i}` })),
        { id: 'private', user_id: 'other', project_id: 'foreign', title: 'DO NOT EXPORT' },
      ],
    };
    const requests: Array<{ table: string; offset: number; limit: number }> = [];
    const fetchSubstitute: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe('https://account-export.test');
      expect(new Headers(init?.headers).get('prefer')).toContain('count=exact');
      const table = url.pathname.split('/').at(-1)!;
      let rows = [...(source[table] || [])];
      for (const [key, predicate] of url.searchParams) {
        if (predicate.startsWith('eq.')) rows = rows.filter(row => row[key] === predicate.slice(3));
        if (predicate.startsWith('in.(')) {
          const allowed = predicate.slice(4, -1).split(',').map(value => value.replace(/^"|"$/g, ''));
          rows = rows.filter(row => allowed.includes(String(row[key])));
        }
      }
      const order = url.searchParams.get('order')!.split(',').map(value => value.split('.')[0]);
      rows.sort((a, b) => { for (const key of order) { const n = String(a[key]).localeCompare(String(b[key])); if (n) return n; } return 0; });
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit'));
      expect(limit).toBe(200);
      const columns = url.searchParams.get('select')!.split(',');
      const data = rows.slice(offset, offset + Math.min(7, limit)).map(row => Object.fromEntries(columns.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]])));
      requests.push({ table, offset, limit });
      return Response.json(data, { headers: { 'Content-Range': `${data.length ? `${offset}-${offset + data.length - 1}` : '*'}/${rows.length}` } });
    };
    const client = actual.createClient('https://account-export.test', 'declared-fixture-key', { global: { fetch: fetchSubstitute }, auth: { persistSession: false, autoRefreshToken: false } });
    createServiceClient.mockReturnValue(client);
    const archive = await buildAccountArchive(user);
    expect(archive.research.references).toHaveLength(23);
    expect(archive.research.references.at(-1)).toMatchObject({ id: 'ref-022', work_id: 'work-22' });
    expect(JSON.stringify(archive)).not.toContain('DO NOT EXPORT');
    expect(requests.filter(request => request.table === 'project_references').map(request => request.offset)).toEqual([0, 7, 14, 21]);
  });

  test('requires the correct password for an email account', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    const signInWithPassword = jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' }, session: { access_token: 'temporary' } }, error: null });
    createSupabaseClient.mockReturnValue({ auth: { signInWithPassword, signOut } });
    const verified = await verifyAccountDeletion(user, 'correct password', { auth: { mfa: { getAuthenticatorAssuranceLevel: jest.fn() } } });
    expect(verified).toBe(true);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.test', password: 'correct password' });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('rejects an old OAuth login and accepts a recent one', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const oauthUser = { ...user, email: 'oauth@example.test', app_metadata: { provider: 'google', providers: ['google'] }, last_sign_in_at: new Date(now - 11 * 60_000).toISOString() } as User;
    const oldSession = { auth: { mfa: { getAuthenticatorAssuranceLevel: jest.fn().mockResolvedValue({ data: { currentLevel: 'aal1', currentAuthenticationMethods: [{ method: 'oauth', timestamp: Math.floor(now / 1_000) - 661 }] }, error: null }) } } };
    expect(await verifyAccountDeletion(oauthUser, undefined, oldSession)).toBe(false);
    const recentSession = { auth: { mfa: { getAuthenticatorAssuranceLevel: jest.fn().mockResolvedValue({ data: { currentLevel: 'aal1', currentAuthenticationMethods: [{ method: 'oauth', timestamp: Math.floor(now / 1_000) - 60 }] }, error: null }) } } };
    expect(await verifyAccountDeletion(oauthUser, undefined, recentSession)).toBe(true);
    jest.restoreAllMocks();
  });
});
