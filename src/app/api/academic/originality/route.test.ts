const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
const loadProjectSources = jest.fn();
const loadOpenSources = jest.fn();
const readLatestWritingDraft = jest.fn();
const insert = jest.fn();

jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert: (...args: unknown[]) => insert(...args) }) }) }));
jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));
jest.mock('@/lib/originality/sources-server', () => ({
  loadProjectSources: (...args: unknown[]) => loadProjectSources(...args),
  loadOpenSources: (...args: unknown[]) => loadOpenSources(...args),
  readLatestWritingDraft: (...args: unknown[]) => readLatestWritingDraft(...args),
}));

import { POST } from './route';

const projectId = '33333333-3333-4333-8333-333333333333';
const sourceId = '11111111-1111-4111-8111-111111111111';
const copied = 'تشير النتائج إلى أن استخدام الذكاء الاصطناعي التوليدي يحسن فهم الطلبة للمفاهيم المعقدة';
const draftText = `هذه فقرة كتبها الباحث بنفسه في مقدمة الفصل. ${copied}.`;
const pdf = { id: sourceId, origin: 'project-pdf', title: 'Study A', url: null, year: 2023, text: `مقدمة ${copied} خاتمة` };

const call = (body: unknown) => POST(new Request('https://waha.systems/api/academic/originality', { method: 'POST', body: JSON.stringify(body) }));

describe('academic originality route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-1' }, supabase: {} });
    ownsProject.mockResolvedValue(true);
    loadProjectSources.mockResolvedValue([pdf]);
    loadOpenSources.mockResolvedValue({ sources: [], providers: [] });
    readLatestWritingDraft.mockResolvedValue(null);
    insert.mockResolvedValue({ error: null });
  });

  test('requires authentication', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    expect((await call({ projectId, input: 'text', text: draftText })).status).toBe(401);
  });

  test('refuses a project the user does not own', async () => {
    ownsProject.mockResolvedValue(false);
    expect((await call({ projectId, input: 'text', text: draftText })).status).toBe(404);
    expect(loadProjectSources).not.toHaveBeenCalled();
  });

  test('rejects an invalid input choice or too short text', async () => {
    expect((await call({ projectId, input: 'file' })).status).toBe(400);
    expect((await call({ projectId, input: 'text', text: 'قصير' })).status).toBe(400);
  });

  test('reports an uncited copied passage from a project source without a guessed score', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const response = await call({ projectId, input: 'text', text: draftText });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body.report.passages).toHaveLength(1);
    expect(body.report.passages[0].matches[0]).toMatchObject({ title: 'Study A', origin: 'project-pdf', cited: false });
    expect(body.report.licensedService).toBe('not_configured');
    expect(body).not.toHaveProperty('originalityScore');
    expect(body.report).not.toHaveProperty('originalityScore');
    // Project-only checks never send the text outside.
    expect(loadOpenSources).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    // The report on screen is the report saved for download.
    expect(insert).toHaveBeenCalledTimes(1);
    const [row] = insert.mock.calls[0] as [{ id: string; project_id: string; type: string; content: string }];
    expect(row).toMatchObject({ id: body.documentId, project_id: projectId, type: 'journey:originality_report', version: 1 });
    expect(JSON.parse(row.content)).toEqual({ version: 1, input: 'text', draftSavedAt: null, report: body.report });
  });

  test('uses the saved draft and its citations when asked to check the draft', async () => {
    const claimStart = draftText.indexOf(copied);
    readLatestWritingDraft.mockResolvedValue({ text: draftText, citations: [{ sourceKind: 'pdf', sourceId, claimStart, claimEnd: claimStart + copied.length }] });
    const body = await (await call({ projectId, input: 'draft' })).json();
    expect(body.report.passages[0].matches[0].cited).toBe(true);
    expect(body.report.uncitedPassages).toBe(0);
  });

  test('reports a missing saved draft plainly', async () => {
    expect((await call({ projectId, input: 'draft' })).status).toBe(404);
  });

  test('checks open sources only when the researcher opts in', async () => {
    loadOpenSources.mockResolvedValue({ sources: [{ id: 'W1', origin: 'open-source', title: 'Open study', url: 'https://doi.org/10.1/x', year: 2022, text: copied }], providers: ['openalex'] });
    const body = await (await call({ projectId, input: 'text', text: draftText, includeOpenSources: true })).json();
    expect(loadOpenSources).toHaveBeenCalledWith(draftText);
    expect(body.report.checked).toEqual({ projectSources: 1, openSources: 1, openSourceProviders: ['openalex'] });
    expect(body.report.passages[0].matches.map((m: { origin: string }) => m.origin).sort()).toEqual(['open-source', 'project-pdf']);
  });

  test('fails closed with no report when a source cannot be read', async () => {
    loadProjectSources.mockRejectedValue(new Error('db down'));
    const response = await call({ projectId, input: 'text', text: draftText });
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('report');
  });
});
