jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: jest.fn(),
  ownsProject: jest.fn(),
  ownedSource: jest.fn(),
  ownedDocument: jest.fn(),
}));
const citeAs = jest.fn();
jest.mock('@/lib/language/CiteAsService', () => ({ CiteAsService: { citations: (...args: unknown[]) => citeAs(...args) } }));
const generateStructured = jest.fn();
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: (...args: unknown[]) => generateStructured(...args) }));

import { POST as researchCitations } from '@/app/api/research/citations/route';
import { POST as academicCitations } from '@/app/api/academic/citations/route';
import { POST as paraphrase } from '@/app/api/academic/paraphrase/route';
import { ownedDocument, ownedSource, ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;
const ownsSource = ownedSource as jest.Mock;
const ownsDocument = ownedDocument as jest.Mock;

function json(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
}

afterEach(() => jest.clearAllMocks());

describe('research/citations does not accept client verification state', () => {
  test.each([
    ['item', { item: { title: 'Invented study', authors: ['A. Author'], year: 2020, verificationStatus: 'verified', confidenceScore: 99, provenance: ['crossref'] } }],
    ['paper', { paper: { id: 'x', title: 'Invented study', authors: ['A. Author'], year: 2020, abstract: '', citationCount: 0, doi: '10.1000/fake', pdfUrl: null, url: null, source: 'crossref', sources: ['crossref', 'openalex', 'pubmed'], subjects: [], publicationType: 'article', openAccess: false, verificationStatus: 'verified', confidenceScore: 99 } }],
  ])('a %s marked verified produces an unverified citation with a warning', async (_kind, source) => {
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: {} }); owns.mockResolvedValue(true);

    const response = await researchCitations(json('http://localhost/api/research/citations', { projectId: 'project-a', style: 'apa-7', ...source }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.citation.verificationStatus).toBe('unverified');
    expect(body.item).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0, provenance: [] }));
    expect(body.warning).toEqual(expect.any(String));
  });

  test('another user project is refused', async () => {
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: {} }); owns.mockResolvedValue(false);
    const response = await researchCitations(json('http://localhost/api/research/citations', { projectId: 'user-b-project', style: 'apa-7', item: { title: 'x', authors: [] } }));
    expect(response.status).toBe(404);
  });
});

describe('academic/citations never asks a language model for a citation', () => {
  function sourcesTable(rawText: string) {
    const update = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
    const insert = jest.fn(() => ({ select: () => ({ single: jest.fn().mockResolvedValue({ data: { id: 'new-source' }, error: null }) }) }));
    const select = jest.fn(() => ({ eq: () => ({ maybeSingle: jest.fn().mockResolvedValue({ data: { raw_text: rawText } }) }) }));
    return { from: jest.fn(() => ({ update, insert, select })), update, insert };
  }

  test('text without a DOI (the workspace upload case) stores no citation and calls no model', async () => {
    const table = sourcesTable('Full text of an uploaded paper without any identifier.');
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: table.from } }); ownsSource.mockResolvedValue({ id: 'source-1', project_id: 'project-a' });

    const response = await academicCitations(json('http://localhost/api/academic/citations', { sourceId: 'source-1' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ citation: null, status: 'no_identifier' }));
    expect(generateStructured).not.toHaveBeenCalled();
    expect(citeAs).not.toHaveBeenCalled();
    expect(table.update).not.toHaveBeenCalled();
    expect(table.insert).not.toHaveBeenCalled();
  });

  test('a nonexistent reference typed as text cannot be turned into a stored citation', async () => {
    const table = sourcesTable('');
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: table.from } }); owns.mockResolvedValue(true);

    const response = await academicCitations(json('http://localhost/api/academic/citations', { projectId: 'project-a', rawText: 'Smith, J. (2031). An invented landmark study. Journal of Imaginary Results, 1(1).' }));
    const body = await response.json();

    expect(body.citation).toBeNull();
    expect(generateStructured).not.toHaveBeenCalled();
    expect(table.insert).not.toHaveBeenCalled();
  });

  test('when the formatter cannot resolve a DOI nothing is stored and no fallback is generated', async () => {
    const table = sourcesTable('');
    citeAs.mockRejectedValue(new Error('not found'));
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: table.from } }); owns.mockResolvedValue(true);

    const response = await academicCitations(json('http://localhost/api/academic/citations', { projectId: 'project-a', rawText: 'See doi 10.9999/does-not-exist-123' }));
    const body = await response.json();

    expect(body).toEqual(expect.objectContaining({ citation: null, status: 'formatter_unavailable' }));
    expect(generateStructured).not.toHaveBeenCalled();
    expect(table.insert).not.toHaveBeenCalled();
  });

  test('a DOI resolved by the formatter is stored but labelled unverified', async () => {
    const table = sourcesTable('');
    citeAs.mockResolvedValue([{ style: 'apa', styleName: 'APA', citation: 'Author, A. (2020). Real study. Journal.' }]);
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: table.from } }); owns.mockResolvedValue(true);

    const response = await academicCitations(json('http://localhost/api/academic/citations', { projectId: 'project-a', rawText: 'doi:10.1000/real.1' }));
    const body = await response.json();

    expect(body).toEqual(expect.objectContaining({ verificationStatus: 'unverified', status: 'formatted_from_doi' }));
    expect(table.insert).toHaveBeenCalledWith(expect.objectContaining({ confidence: 'unverified_external_formatter', parsed_citation_apa: 'Author, A. (2020). Real study. Journal.' }));
    expect(generateStructured).not.toHaveBeenCalled();
  });

  test('only the opening of an uploaded PDF is searched for its DOI', async () => {
    const citedDoiLater = `${'Body text. '.repeat(400)} References: 10.5555/cited.work`;
    const table = sourcesTable(citedDoiLater);
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: table.from } }); ownsSource.mockResolvedValue({ id: 'source-1', project_id: 'project-a' });

    const body = await (await academicCitations(json('http://localhost/api/academic/citations', { sourceId: 'source-1' }))).json();

    expect(body.status).toBe('no_identifier');
    expect(citeAs).not.toHaveBeenCalled();
  });
});

test('paraphrase refuses to rewrite a server-owned journey document before calling the model', async () => {
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: {} });
  ownsDocument.mockResolvedValue({ id: 'doc-1', project_id: 'project-a', type: 'journey:problem', content: '{"problemStatement":"x"}', version: 1 });

  const response = await paraphrase(json('http://localhost/api/academic/paraphrase', { documentId: 'doc-1' }));

  expect(response.status).toBe(409);
  expect(generateStructured).not.toHaveBeenCalled();
});
