/** Cached public metadata; authentication/database are explicit substitutes.
 * Exercises real route handlers, not the hosted UI, AI, or source validity. */
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: jest.fn() }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GET, POST as save } from '@/app/api/research/library/route';
import { POST as exportProject } from '@/app/api/academic/export/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { createTableFake } from '@/lib/test-support/table-fake';

type Paper = { id: string; title: string; authors: string; year: number; doi: string; journal: string | null; publicationType: string; url: string };
const { selected }: { selected: Paper[] } = JSON.parse(readFileSync(join(process.cwd(), 'output/qa/real-source-inputs.json'), 'utf8'));
const projectId = 'ce0c5872-122d-4f72-a9d1-43b120b95f45';
const userId = 'owner';

test.each([20, 50])('saves %i public-metadata entries sequentially and retains each one after reload and export', async count => {
  jest.clearAllMocks();
  const db = createTableFake({ strictQuery: true, serverRowLimit: 7 });
  db.seed('projects', { id: projectId, user_id: userId, title: 'Public-metadata route QA', university_policy: null });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: userId }, supabase: db.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  (createServiceClient as jest.Mock).mockReturnValue(db.service);
  const papers = selected.slice(0, count);
  const savedIds: string[] = [];
  const savePaper = (paper: Paper) => save(new Request('http://localhost/api/research/library', { method: 'POST', body: JSON.stringify({
    projectId, item: { ...paper, authors: paper.authors.split(', '), type: paper.publicationType,
      verificationStatus: 'verified', confidenceScore: 100, provenance: ['untrusted browser claim'] },
  }) }));
  for (const paper of papers) {
    const response = await savePaper(paper);
    expect(response.status).toBe(200);
    const body = await response.json();
    savedIds.push(body.item.id);
    expect(body.item.verificationStatus).toBe('unverified');
    expect(body.item.confidenceScore).toBe(0);
    expect(body.item.provenance).toEqual(['user_asserted']);
  }
  const repeated = await (await savePaper(papers[0])).json();
  expect(repeated.existing).toBe(true);
  expect(repeated.item.id).toBe(savedIds[0]);
  const reloaded = await (await GET(new Request(`http://localhost/api/research/library?projectId=${projectId}`))).json();
  expect(reloaded.total).toBe(count);
  expect(new Set(reloaded.items.map((item: { id: string }) => item.id))).toEqual(new Set(savedIds));
  expect(reloaded.bibliographies['apa-7']).toHaveLength(count);
  const exported = await exportProject(new Request('http://localhost/api/academic/export', { method: 'POST', body: JSON.stringify({
    projectId, format: 'markdown', language: 'en', citationStyle: 'apa-7',
  }) }));
  expect(exported.status).toBe(200);
  const content = (await exported.text()).replace(/\\/g, '');
  for (const paper of papers) { expect(content).toContain(paper.title); expect(content).toContain(paper.doi); }
  expect(db.writes).toHaveLength(count);
  expect(db.writes.every(write => write.client === 'service' && write.table === 'project_references' && write.row.project_id === projectId && write.row.user_id === userId)).toBe(true);
}, 30_000);
