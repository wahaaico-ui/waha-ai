// The recorded search scope is readable only by the project owner, through the
// caller's session, and never across projects or users.
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));

import { GET } from '@/app/api/projects/[projectId]/search-runs/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';

const db = createTableFake();
const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;
const PROJECT_A = '10000000-0000-4000-8000-00000000000a';
const PROJECT_B = '10000000-0000-4000-8000-00000000000b';
const context = (projectId: string) => ({ params: Promise.resolve({ projectId }) });

beforeEach(() => {
  jest.clearAllMocks();
  db.reset();
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: db.session });
  owns.mockImplementation(async (projectId: string) => projectId === PROJECT_A);
  db.seed('research_search_runs', { project_id: PROJECT_A, user_id: 'user-a', query: 'own search', executed_at: '2026-10-06T00:00:00.000Z' });
  db.seed('research_search_runs', { project_id: PROJECT_A, user_id: 'user-b', query: 'other user search', executed_at: '2026-10-06T00:00:00.000Z' });
  db.seed('research_search_runs', { project_id: PROJECT_B, user_id: 'user-a', query: 'other project search', executed_at: '2026-10-06T00:00:00.000Z' });
});

test('the owner reads the searches recorded for this project only', async () => {
  const body = await (await GET(new Request('http://localhost/x'), context(PROJECT_A))).json();
  expect(body.runs.map((run: { query: string }) => run.query)).toEqual(['own search']);
});

test('another project or an anonymous caller is refused before any read', async () => {
  expect((await GET(new Request('http://localhost/x'), context(PROJECT_B))).status).toBe(404);
  auth.mockResolvedValue(null);
  expect((await GET(new Request('http://localhost/x'), context(PROJECT_A))).status).toBe(401);
});
