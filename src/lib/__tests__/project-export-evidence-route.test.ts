jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/academic/export/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { readWritingSource } from '@/lib/evidence-writing-server';
import { attachWritingSource, WRITING_DOCUMENT_TYPE, type SavedWritingDraft } from '@/lib/evidence-writing';
import { EXTRACTION_FIELDS, WRITING_ANALYSIS_TYPE, extractionIntoDraft, parseAssessmentOutput, parseExtractionOutput } from '@/lib/writing-analysis';
import { DISCOVERY_PROVIDER, SERVER_DISCOVERED_METADATA } from '@/lib/research-search-results';
import { PDF_FILE_TYPE } from '@/lib/pdf-evidence';
import { pdfDigest, pdfRecordId } from '@/lib/pdf-evidence-server';

// All studies and accounts here are synthetic. No model or external API runs.
const db = createTableFake({ strictQuery: true });
const projectId = randomUUID(), referenceId = randomUUID();
const sourceText = 'This synthetic study included 20 students. No causal conclusion was established.';
const request = (format = 'markdown', language = 'en') => new Request('http://localhost', { method: 'POST', body: JSON.stringify({ projectId, format, language }) });
const savedDraft = () => db.rows('documents').find(row => row.type === WRITING_DOCUMENT_TYPE)!;
const savedAnalysis = () => db.rows('documents').find(row => row.type === WRITING_ANALYSIS_TYPE)!;

beforeEach(async () => {
  jest.clearAllMocks(); db.reset();
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: db.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  db.seed('projects', { id: projectId, user_id: 'owner', title: 'Synthetic export integrity fixture', university_policy: null });
  db.seed('project_references', { id: referenceId, project_id: projectId, user_id: 'owner', provider: DISCOVERY_PROVIDER, external_item_key: 'synthetic-export', title: 'Synthetic study', authors: ['Example, Researcher'], publication_year: 2024, publication_title: null, doi: null, url: null, citation_data: { metadataOrigin: SERVER_DISCOVERED_METADATA, discovery: { resultId: 'fixture' }, discoveredPaper: { abstract: sourceText } } });
  const source = await readWritingSource(db.session as unknown as SupabaseClient, projectId, 'reference', referenceId);
  if (!source) throw new Error('Missing synthetic source');
  const output = JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value: '20 students participated.', quote: 'This synthetic study included 20 students.' } : null])) });
  const extraction = parseExtractionOutput(output, source, 'en')!;
  const draft = extractionIntoDraft({ text: '', citations: [] }, extraction, 'sample')!;
  const saved: SavedWritingDraft = { ...draft, citations: draft.citations.map(c => attachWritingSource(c, source)) };
  db.seed('documents', { project_id: projectId, type: WRITING_DOCUMENT_TYPE, content: JSON.stringify(saved), version: 1, created_at: '2026-10-18T10:00:00Z' });
  db.seed('documents', { project_id: projectId, type: WRITING_ANALYSIS_TYPE, content: JSON.stringify(extraction), version: 1, created_at: '2026-10-18T10:00:00Z' });
});

test.each(['ar', 'en'])('exports a matching source, saved draft and extraction in %s without writes', async language => {
  const response = await POST(request('markdown', language));
  expect(response.status).toBe(200);
  const content = (await response.text()).replace(/\\/g, '');
  expect(content).toContain('20 students participated.');
  expect(content).toContain('This synthetic study included 20 students.');
  expect(response.headers.get('cache-control')).toContain('private, no-store');
  expect(db.writes).toHaveLength(0);
});

test.each(['markdown', 'docx', 'pdf'])('does not issue a %s attachment when the source changed', async format => {
  const row = db.rows('project_references')[0];
  (row.citation_data as Record<string, unknown>).discoveredPaper = { abstract: 'A different source text with no matching passage.' };
  const response = await POST(request(format));
  expect(response.status).toBe(409);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(response.headers.get('cache-control')).toContain('private, no-store');
});

test('rejects an invented passage in a saved extraction even when the record shape is valid', async () => {
  const row = savedAnalysis(); const record = JSON.parse(String(row.content));
  record.fields.sample.quoteText = 'An invented study passage.';
  record.fields.sample.quoteEnd = record.fields.sample.quoteText.length;
  row.content = JSON.stringify(record);
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(response.headers.get('content-disposition')).toBeNull();
});

test.each(['markdown', 'docx', 'pdf'])('does not issue a %s file containing a distorted numerical unit in a saved analysis', async format => {
  const row = savedAnalysis(); const record = JSON.parse(String(row.content));
  record.fields.sample.value = '20% participated.';
  row.content = JSON.stringify(record);
  const response = await POST(request(format));
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe('export_analysis_invalid');
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(db.writes).toHaveLength(0);
});

test.each(['removed', 'foreign'])('rejects a %s source without leaking its content', async state => {
  if (state === 'removed') db.rows('project_references').splice(0);
  else db.rows('project_references')[0].project_id = randomUUID();
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(await response.text()).not.toContain(sourceText);
});

test('requires review after a cited sentence changes', async () => {
  const row = savedDraft(); const draft = JSON.parse(String(row.content));
  draft.text = 'The researcher changed this sentence.';
  row.content = JSON.stringify(draft);
  expect((await POST(request())).status).toBe(409);
});

test('rejects outdated bibliographic snapshots instead of combining an old citation with new metadata', async () => {
  db.rows('project_references')[0].authors = ['Different, Author'];
  expect((await POST(request())).status).toBe(409);
});

test.each(['ar', 'en'])('provides a localized, actionable export error in %s', async language => {
  db.rows('project_references').splice(0);
  const response = await POST(request('markdown', language));
  const error = await response.json();
  expect(error.code).toBe('export_source_missing');
  expect(error.error).toContain(language === 'ar' ? 'أعد إضافته' : 'Restore it');
  if (language === 'en') expect(error.error).not.toMatch(/[\u0600-\u06ff]/);
});

test('prefers the current source version over an older extraction in the requested export language', async () => {
  const olderRow = savedAnalysis(); const olderRecord = JSON.parse(String(olderRow.content));
  olderRow.content = JSON.stringify({ ...olderRecord, language: 'ar' });
  const row = db.rows('project_references')[0];
  const updatedText = 'The new synthetic study included 30 students.';
  (row.citation_data as Record<string, unknown>).discoveredPaper = { abstract: updatedText };
  savedDraft().content = JSON.stringify({ text: 'Current draft without a source-linked sentence.', citations: [] });
  const source = (await readWritingSource(db.session as unknown as SupabaseClient, projectId, 'reference', referenceId))!;
  const record = parseExtractionOutput(JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value: '30 students participated.', quote: updatedText } : null])) }), source, 'en')!;
  db.seed('documents', { project_id: projectId, type: WRITING_ANALYSIS_TYPE, content: JSON.stringify(record), version: 1, created_at: '2026-10-18T11:00:00Z' });
  const response = await POST(request('markdown', 'ar')); expect(response.status).toBe(200);
  const text = (await response.text()).replace(/\\/g, '');
  expect(text).toContain('30 students participated.'); expect(text).not.toContain('20 students participated.');
});

test('does not export or validate an assessment that no longer applies to the latest draft', async () => {
  const source = (await readWritingSource(db.session as unknown as SupabaseClient, projectId, 'reference', referenceId))!;
  const draft = JSON.parse(String(savedDraft().content)) as SavedWritingDraft;
  const oldCitation = { ...draft.citations[0], claimText: 'An earlier claim.' };
  const assessment = parseAssessmentOutput(JSON.stringify({ relation: 'unclear', rationale: 'STALE ASSESSMENT NOT FOR THE CURRENT DRAFT', limitation: 'Only the selected passage was considered.', quote: oldCitation.quoteText }), source, oldCitation, randomUUID(), 'en')!;
  db.seed('documents', { project_id: projectId, type: WRITING_ANALYSIS_TYPE, content: JSON.stringify(assessment), version: 1, created_at: '2026-10-18T11:00:00Z' });
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(await response.text()).not.toContain('STALE ASSESSMENT');
});

test('checks original PDF page metadata and line locations in the captured export snapshot', async () => {
  db.rows('documents').splice(0);
  const id = randomUUID();
  const manifest = { sourceId: id, projectId, ownerId: randomUUID(), fileName: 'Synthetic.pdf', fileHash: 'a'.repeat(64), textHash: pdfDigest(sourceText), bytes: 200, totalPages: 1, pages: [{ number: 1, start: 0, end: sourceText.length }] };
  db.seed('sources', { id, project_id: projectId, raw_text: sourceText, parsed_citation_apa: null, parsed_citation_ieee: null });
  const manifestId = pdfRecordId(projectId, id);
  db.seed('documents', { id: manifestId, project_id: projectId, type: PDF_FILE_TYPE, version: 1, content: JSON.stringify(manifest) });
  const manifestRow = db.rows('documents').find(row => row.id === manifestId)!;
  const source = (await readWritingSource(db.session as unknown as SupabaseClient, projectId, 'pdf', id))!;
  const extraction = parseExtractionOutput(JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value: '20 students participated.', quote: 'This synthetic study included 20 students.' } : null])) }), source, 'en')!;
  const draft = extractionIntoDraft({ text: '', citations: [] }, extraction, 'sample')!;
  db.seed('documents', { project_id: projectId, type: WRITING_DOCUMENT_TYPE, version: 1, content: JSON.stringify({ ...draft, citations: draft.citations.map(c => attachWritingSource(c, source)) }) });
  expect((await POST(request())).status).toBe(200);
  manifestRow.content = JSON.stringify({ ...manifest, fileHash: 'b'.repeat(64) });
  expect((await POST(request())).status).toBe(409);
  manifestRow.content = JSON.stringify(manifest);
  const saved = JSON.parse(String(savedDraft().content));
  saved.citations[0].firstLine = 42; saved.citations[0].lastLine = 42;
  savedDraft().content = JSON.stringify(saved);
  expect((await POST(request())).status).toBe(409);
});

test('validates and exports 50 source-linked study extractions without silently losing references', async () => {
  db.rows('documents').splice(0);
  let draft: SavedWritingDraft = { text: '', citations: [] };
  const template = { ...db.rows('project_references')[0] };
  const output = JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value: '20 students participated.', quote: 'This synthetic study included 20 students.' } : null])) });
  for (let i = 0; i < 50; i++) {
    const id = randomUUID();
    db.seed('project_references', { ...template, id, external_item_key: `synthetic-${i}`, title: `Synthetic study ${i}` });
    const source = (await readWritingSource(db.session as unknown as SupabaseClient, projectId, 'reference', id))!;
    const extraction = parseExtractionOutput(output, source, 'en')!;
    const next = extractionIntoDraft(draft, extraction, 'sample')!;
    draft = { ...next, citations: [...draft.citations, attachWritingSource(next.citations.at(-1)!, source)] };
    db.seed('documents', { project_id: projectId, type: WRITING_ANALYSIS_TYPE, content: JSON.stringify(extraction), version: 1 });
  }
  db.seed('documents', { project_id: projectId, type: WRITING_DOCUMENT_TYPE, content: JSON.stringify(draft), version: 1 });
  const response = await POST(request()); expect(response.status).toBe(200);
  const content = (await response.text()).replace(/\\/g, '');
  expect(content.match(/Study information — Synthetic study \d+/g)).toHaveLength(50);
  expect(content).toContain('Synthetic study 49');
  expect(db.writes).toHaveLength(0);
});
