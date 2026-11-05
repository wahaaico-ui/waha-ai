jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ ...mockDb.service, storage: mockStorage }) }));
jest.mock('pdf-parse', () => ({ PDFParse: class { async getInfo() { return { total: mockTotal }; } async getText() { return { pages: [{ num: 1, text: 'Declared first page.' }, { num: 2, text: 'Unique evidence 42.' }] }; } async destroy() { mockDestroy(); } } }));
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/projects/[projectId]/pdfs/route';
import { GET } from '@/app/api/projects/[projectId]/pdfs/[sourceId]/route';
import { POST as saveWriting } from '@/app/api/projects/[projectId]/writing/route';
import { GET as sources } from '@/app/api/projects/[projectId]/writing/sources/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { deleteAccountPdfFiles, pdfDigest } from '@/lib/pdf-evidence-server';
import { readWritingSource } from '@/lib/evidence-writing-server';

const mockDb = createTableFake({ strictQuery: true }); const ownerId = randomUUID(), projectId = randomUUID();
const files = new Map<string, Buffer>(); let mockTotal = 2;
const mockDestroy = jest.fn();
const mockStorage = { getBucket: jest.fn(async () => ({ data: {}, error: null })), from: jest.fn(() => ({
  upload: jest.fn(async (path: string, bytes: Buffer) => { if (files.has(path)) return { error: { statusCode: '409', message: 'already exists' } }; files.set(path, Buffer.from(bytes)); return { data: { path }, error: null }; }),
  download: jest.fn(async (path: string) => ({ data: files.has(path) ? new Blob([new Uint8Array(files.get(path)!)]) : null, error: null })),
  list: jest.fn(async (prefix: string) => ({ data: [...new Set([...files.keys()].filter(p => p.startsWith(prefix + '/')).map(p => p.slice(prefix.length + 1).split('/')[0]))].slice(0, 100).map(name => ({ name, id: files.has(`${prefix}/${name}`) ? 'file' : null })), error: null })),
  remove: jest.fn(async (paths: string[]) => { paths.forEach(p => files.delete(p)); return { error: null }; }),
})) };
const context = { params: Promise.resolve({ projectId }) };
const request = (bytes = '%PDF-1.7\nDeclared mocked parser fixture', type = 'application/pdf') => { const form = new FormData(); form.set('file', new File([bytes], 'دراسة fixture.pdf', { type })); return new Request('http://localhost', { method: 'POST', body: form }); };
const downloadContext = (sourceId: string) => ({ params: Promise.resolve({ projectId, sourceId }) });
beforeEach(() => {
  mockDb.reset(); files.clear(); jest.clearAllMocks(); mockTotal = 2;
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: ownerId }, supabase: mockDb.session }); (ownsProject as jest.Mock).mockResolvedValue(true);
  for (const table of ['sources', 'documents']) mockDb.constraints.set(table, row => mockDb.rows(table).some(r => r.id === row.id) ? '23505' : null);
});
test('upload, retry, download and evidence save retain one immutable file and authoritative page coordinates', async () => {
  const response = await POST(request(), context); expect(response.status).toBe(200); const saved = await response.json();
  expect((await POST(request(), context)).status).toBe(200); expect(files.size).toBe(1); expect(mockDb.rows('sources')).toHaveLength(1); expect(mockDb.rows('documents')).toHaveLength(1);
  expect(mockDb.writes.every(w => w.client === 'service')).toBe(true);
  const list = await (await sources(new Request('http://localhost?kind=pdf'), context)).json(); expect(list.items[0].title).toBe('دراسة fixture.pdf');
  const source = (await readWritingSource(mockDb.session as unknown as SupabaseClient, projectId, 'pdf', saved.sourceId))!;
  expect(source.pdf?.totalPages).toBe(2); expect(source.pdf).not.toHaveProperty('ownerId');
  const start = source.text.indexOf('Unique'); const quote = 'Unique evidence 42.';
  const writing = await saveWriting(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ text: 'Claim', citations: [{ id: randomUUID(), claimStart: 0, claimEnd: 5, claimText: 'Claim', sourceId: saved.sourceId, sourceKind: 'pdf', sourceHash: source.hash, quoteStart: start, quoteEnd: start + quote.length, quoteText: quote, relation: 'contextual', note: '', pdfPages: { first: 40, last: 45, fileHash: 'f'.repeat(64) } }] }) }), context);
  expect(writing.status).toBe(200); expect((await writing.json()).draft.citations[0].pdfPages).toEqual({ first: 2, last: 2, fileHash: source.pdf?.fileHash });
  const downloaded = await GET(new Request('http://localhost'), downloadContext(saved.sourceId)); expect(downloaded.status).toBe(200);
  expect(pdfDigest(new Uint8Array(await downloaded.arrayBuffer()))).toBe(source.pdf?.fileHash);
  expect(downloaded.headers.get('cache-control')).toContain('no-store'); expect(downloaded.headers.get('content-type')).toBe('application/pdf');
  expect(downloaded.headers.get('content-security-policy')).toContain('sandbox'); expect(downloaded.headers.get('content-disposition')).toContain('UTF-8');
});
test('denies unauthenticated, foreign project and foreign source requests before any storage access', async () => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValueOnce(null); expect((await POST(request(), context)).status).toBe(401);
  (ownsProject as jest.Mock).mockResolvedValue(false); expect((await POST(request(), context)).status).toBe(404); expect((await GET(new Request('http://localhost'), downloadContext(randomUUID()))).status).toBe(404);
  (ownsProject as jest.Mock).mockResolvedValue(true); expect((await GET(new Request('http://localhost'), downloadContext(randomUUID()))).status).toBe(404);
  expect(mockStorage.from).not.toHaveBeenCalled(); expect(mockDb.writes).toHaveLength(0);
});
test('rejects MIME spoofing, invalid signature, excessive pages and forged body length before saving', async () => {
  expect((await POST(request('hello', 'text/plain'), context)).status).toBe(422); expect((await POST(request('hello'), context)).status).toBe(422);
  mockTotal = 51; expect((await POST(request(), context)).status).toBe(422);
  const huge = new Request('http://localhost', { method: 'POST', headers: { 'content-length': '1' }, body: 'x'.repeat(4 * 1024 * 1024 + 65537) });
  expect((await POST(huge, context)).status).toBe(413); expect(mockStorage.from).not.toHaveBeenCalled(); expect(mockDb.writes).toHaveLength(0);
});
test('failed manifest save is reported and retry repairs the interrupted upload without duplicate source or file', async () => {
  mockDb.constraints.set('documents', () => 'unavailable'); expect((await POST(request(), context)).status).toBe(503);
  expect(files.size).toBe(1); expect(mockDb.rows('sources')).toHaveLength(1);
  mockDb.constraints.set('documents', row => mockDb.rows('documents').some(r => r.id === row.id) ? '23505' : null);
  expect((await POST(request(), context)).status).toBe(200); expect(files.size).toBe(1); expect(mockDb.rows('sources')).toHaveLength(1); expect(mockDb.rows('documents')).toHaveLength(1);
});
test('rejects changed original bytes, wrong manifest owner and changed extracted text', async () => {
  const saved = await (await POST(request(), context)).json(); const path = [...files.keys()][0]; files.set(path, Buffer.from('changed'));
  expect((await GET(new Request('http://localhost'), downloadContext(saved.sourceId))).status).toBe(503);
  expect((await POST(request(), context)).status).toBe(503);
  mockDb.rows('sources')[0].raw_text = 'Changed text'; await expect(readWritingSource(mockDb.session as unknown as SupabaseClient, projectId, 'pdf', saved.sourceId)).rejects.toThrow('pdf_source_changed');
  const manifest = mockDb.rows('documents')[0]; manifest.content = JSON.stringify({ ...JSON.parse(manifest.content as string), ownerId: randomUUID() });
  mockStorage.from.mockClear(); expect((await GET(new Request('http://localhost'), downloadContext(saved.sourceId))).status).toBe(404); expect(mockStorage.from).not.toHaveBeenCalled();
});
test('account cleanup handles more than 100 files, interrupted uploads and nested folders without touching another owner', async () => {
  for (let i = 0; i < 205; i++) files.set(`${ownerId}/${projectId}/${randomUUID()}/${i}.pdf`, Buffer.from('fixture'));
  files.set(`${ownerId}/interrupted.pdf`, Buffer.from('fixture')); const foreign = `${randomUUID()}/${projectId}/other.pdf`; files.set(foreign, Buffer.from('foreign'));
  await deleteAccountPdfFiles({ storage: mockStorage } as unknown as SupabaseClient, ownerId); expect([...files.keys()]).toEqual([foreign]);
  await expect(deleteAccountPdfFiles({ storage: mockStorage } as unknown as SupabaseClient, '../other')).rejects.toThrow('invalid_pdf_owner');
});
