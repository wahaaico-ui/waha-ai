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

const user = {
  id: 'user-1', email: 'owner@example.test', phone: undefined,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, aud: 'authenticated',
} as User;

function serviceWith(source: Record<string, Array<Record<string, unknown>>>) {
  return {
    from: jest.fn((table: string) => {
      let columns = '*';
      const query = {} as {
        select: jest.Mock; eq: jest.Mock; in: jest.Mock; order: jest.Mock;
        then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
      };
      query.select = jest.fn((value: string) => { columns = value; return query; });
      query.eq = jest.fn(() => query);
      query.in = jest.fn(() => query);
      query.order = jest.fn(() => query);
      query.then = (resolve: (value: unknown) => unknown) => {
          const allowed = columns.split(',').map((column) => column.trim());
          const data = (source[table] || []).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => allowed.includes(key))));
          return Promise.resolve(resolve({ data, error: null }));
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
      research_projects: [{ id: 'research-project-1', project_title: 'بحث مساند' }],
      research_profiles: [{ id: 'profile-1', project_id: 'project-1', current_stage: 'problem' }],
      saved_papers: [{ id: 'paper-1', title: 'مرجع محفوظ' }],
      user_integrations: [{ provider: 'zotero', external_user_id: '42', access_token_encrypted: 'must-not-leak' }],
      documents: [{ id: 'document-1', project_id: 'project-1', content: 'ملخص' }],
    }));
    const archive = await buildAccountArchive(user);
    expect(archive.account.id).toBe('user-1');
    expect(archive.schemaVersion).toBe(3);
    expect(archive.research.projects).toEqual([{ id: 'project-1', title: 'بحثي' }]);
    expect(archive.research.drafts).toEqual([{ project_id: 'project-1', stage: 'problem', content: { problem: 'مشكلة البحث' } }]);
    expect(archive.research.researchProjects).toEqual([{ id: 'research-project-1', project_title: 'بحث مساند' }]);
    expect(archive.research.researchProfiles).toEqual([{ id: 'profile-1', project_id: 'project-1', current_stage: 'problem' }]);
    expect(archive.research.savedPapers).toEqual([{ id: 'paper-1', title: 'مرجع محفوظ' }]);
    expect(JSON.stringify(archive)).not.toContain('must-not-leak');
    expect(JSON.stringify(archive)).not.toContain('access_token_encrypted');
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
