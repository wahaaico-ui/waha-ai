jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
import { randomUUID } from 'node:crypto';
import { POST } from '@/app/api/academic/export/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';

const db = createTableFake({ strictQuery: true, serverRowLimit: 1000 });
const projectId = randomUUID();
const request = () => new Request('http://localhost', { method: 'POST', body: JSON.stringify({ projectId, format: 'markdown', language: 'en' }) });
beforeEach(() => {
  jest.clearAllMocks(); db.reset();
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: db.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  db.seed('projects', { id: projectId, user_id: 'owner', title: 'Synthetic pagination fixture', university_policy: null });
});
test('exports every reference, file and latest writing after more than one backend page', async () => {
  for (let i = 0; i < 1075; i++) {
    const created_at = new Date(Date.UTC(2026, 9, 15, 0, 0, 0, i)).toISOString();
    db.seed('project_references', { project_id: projectId, user_id: 'owner', title: `REFERENCE-${i}`, authors: [], publication_year: 2024, publication_title: null, doi: null, url: null, created_at });
    db.seed('sources', { project_id: projectId, raw_text: `SOURCE-${i}`, parsed_citation_apa: null, parsed_citation_ieee: null, created_at });
    db.seed('documents', { project_id: projectId, type: WRITING_DOCUMENT_TYPE, content: JSON.stringify({ text: i === 1074 ? 'LATEST WRITING BEYOND THE FIRST PAGE' : `OLD WRITING ${i}`, citations: [] }), version: 1, created_at });
  }
  db.seed('project_references', { project_id: projectId, user_id: 'other-owner', title: 'PRIVATE FOREIGN REFERENCE' });
  db.seed('sources', { project_id: randomUUID(), raw_text: 'PRIVATE FOREIGN SOURCE' });
  const response = await POST(request()); expect(response.status).toBe(200);
  const content = (await response.text()).replace(/\\/g, '');
  expect(new Set(content.match(/REFERENCE-\d+/g))).toHaveProperty('size', 1075);
  expect(new Set(content.match(/SOURCE-\d+/g))).toHaveProperty('size', 1075);
  expect(content).toContain('LATEST WRITING BEYOND THE FIRST PAGE'); expect(content).not.toContain('OLD WRITING');
  expect(content).not.toContain('PRIVATE FOREIGN'); expect(response.headers.get('cache-control')).toContain('private, no-store');
  expect(db.writes).toHaveLength(0);
});
