jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: mockFrom }) }));
const mockFrom = jest.fn();
import { buildLiteratureSelection, literaturePaperFromReference, resolveLibrarySelection } from '@/lib/research-search-results';
const row = {
  id: 'reference-a', project_id: 'project-a', provider: 'waha_discovery', external_item_key: '10.1234/a', title: 'Stored real title',
  doi: '10.1234/a', authors: [{ name: 'Author' }], publication_year: 2025, publication_title: 'Journal', url: 'https://doi.org/10.1234/a',
  citation_data: { metadataOrigin: 'server_discovered', discoveredPaper: { abstract: 'Stored provider abstract, not browser text.' }, discovery: { resultId: 'historical-result', searchRunId: 'run-a', providers: ['openalex'] } },
};
function chain(data: unknown) {
  const q: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gt']) q[method] = jest.fn(() => q);
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve); return q;
}
beforeEach(() => jest.clearAllMocks());
test('retains the same source id, abstract and historical discovery without upgrading verification', () => {
  const paper = literaturePaperFromReference(row);
  expect(paper.id).toBe('10.1234/a'); expect(paper.referenceId).toBe('reference-a');
  expect(paper.abstract).toBe('Stored provider abstract, not browser text.');
  expect(paper.item.verificationStatus).toBe('unverified'); expect(paper.discovery?.resultId).toBe('historical-result');
});
test('legacy or researcher-entered sources do not gain a provider abstract or provenance', () => {
  const paper = literaturePaperFromReference({ ...row, provider: 'user_asserted' });
  expect(paper.abstract).toBe(''); expect(paper.metadataOrigin).toBe('client_submitted'); expect(paper.discovery).toBeUndefined();
});
test('durable selection reads both user and project scope and ignores browser metadata', async () => {
  const q = chain([row]); mockFrom.mockImplementation((table: string) => table === 'project_references' ? q : chain([]));
  const result = await buildLiteratureSelection({ userId: 'user-a', projectId: 'project-a', savedLiterature: undefined, content: { referenceIds: ['reference-a'], papers: [{ title: 'Forged', abstract: 'Forged', work_id: 'forged' }] } });
  expect(q.eq).toHaveBeenCalledWith('user_id', 'user-a'); expect(q.eq).toHaveBeenCalledWith('project_id', 'project-a');
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.content.papers).toEqual([expect.objectContaining({ title: row.title, abstract: 'Stored provider abstract, not browser text.' })]);
});
test('missing, deleted or cross-project reference ids are rejected, not silently dropped', async () => {
  mockFrom.mockReturnValue(chain([]));
  expect(await resolveLibrarySelection({ userId: 'user-a', projectId: 'project-a', referenceIds: ['reference-b'] })).toBeNull();
});
test('rejects malformed selection and oversized request data without a reference-count cap', async () => {
  expect(await resolveLibrarySelection({ userId: 'u', projectId: 'p', referenceIds: 'id' })).toBeNull();
  expect(await resolveLibrarySelection({ userId: 'u', projectId: 'p', referenceIds: ['x'.repeat(200_001)] })).toBeNull();
  expect(mockFrom).not.toHaveBeenCalled();
});
test('reads more than 100 selected references in owner-scoped batches while retaining order', async () => {
  const rows = Array.from({ length: 150 }, (_, index) => ({ ...row, id: `reference-${index}`, external_item_key: `study-${index}` }));
  const queries: ReturnType<typeof chain>[] = [];
  mockFrom.mockImplementation(() => {
    const selected = rows.slice(queries.length * 100, (queries.length + 1) * 100).reverse();
    const q = chain(selected); queries.push(q); return q;
  });
  const result = await resolveLibrarySelection({ userId: 'user-a', projectId: 'project-a', referenceIds: rows.map((source) => source.id) });
  expect(result?.map((source) => source.referenceId)).toEqual(rows.map((source) => source.id));
  expect(queries).toHaveLength(2);
  for (const q of queries) {
    expect(q.eq).toHaveBeenCalledWith('user_id', 'user-a'); expect(q.eq).toHaveBeenCalledWith('project_id', 'project-a');
  }
});
