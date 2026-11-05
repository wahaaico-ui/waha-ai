import { randomUUID } from 'node:crypto';
import { canonicalPdfPages, pdfQuotePages, readPdfFileRecord, uniquePdfTextMatch } from '@/lib/pdf-evidence';
import { attachWritingSource, parseWritingDraft, readSavedWriting, type WritingCitation, type WritingSource } from '@/lib/evidence-writing';
import { pdfDigest } from '@/lib/pdf-evidence-server';
import { buildProjectExportModel } from '@/lib/project-export';

const canonical = canonicalPdfPages([{ num: 1, text: 'Heading\r\nArabic عربي 🧪' }, { num: 2, text: 'Evidence of 42 only.\u0000' }], 2);
const info = { fileName: 'Declared fixture.pdf', fileHash: 'a'.repeat(64), textHash: pdfDigest(canonical.text), bytes: 200, totalPages: 2, pages: canonical.pages };
const record = { ...info, ownerId: randomUUID(), sourceId: randomUUID(), projectId: randomUUID() };
const source: WritingSource = { id: record.sourceId, kind: 'pdf', title: info.fileName, text: canonical.text, hash: info.textHash, origin: 'uploaded_text', url: null, year: null, pdf: info };
const start = canonical.text.indexOf('Evidence');
const citation: WritingCitation = { id: randomUUID(), claimStart: 0, claimEnd: 5, claimText: 'Claim', sourceId: source.id, sourceKind: 'pdf', sourceHash: source.hash, quoteStart: start, quoteEnd: start + 8, quoteText: 'Evidence', relation: 'contextual', note: '' };

test('canonical pages preserve exact UTF-16 offsets and physical page boundaries', () => {
  expect(canonical.text).toBe('Heading\nArabic عربي 🧪\n\nEvidence of 42 only.');
  expect(canonical.pages.map(p => canonical.text.slice(p.start, p.end))).toEqual(['Heading\nArabic عربي 🧪', 'Evidence of 42 only.']);
  expect(pdfQuotePages(info, start, start + 8)).toEqual({ first: 2, last: 2, fileHash: info.fileHash });
  expect(pdfQuotePages(info, 8, start + 8)).toEqual({ first: 1, last: 2, fileHash: info.fileHash });
  expect(pdfQuotePages(info, canonical.pages[0].end, canonical.pages[1].start)).toBeNull();
  expect(readPdfFileRecord(JSON.stringify(record))).toEqual(record);
  expect(readPdfFileRecord({ ...record, pages: [{ number: 1, start: 0, end: 3 }] })).toBeNull();
  expect(readPdfFileRecord({ ...record, ownerId: '../other' })).toBeNull();
});
test('rejects missing, reordered, oversized or invented page maps', () => {
  expect(() => canonicalPdfPages([{ num: 2, text: 'x' }], 1)).toThrow();
  expect(() => canonicalPdfPages([], 2)).toThrow();
  expect(() => canonicalPdfPages([], 51)).toThrow();
  expect(() => canonicalPdfPages([{ num: 1, text: 'x'.repeat(1000001) }], 1)).toThrow();
  const empty = canonicalPdfPages([{ num: 1, text: '' }, { num: 2, text: 'x' }], 2);
  expect(empty.pages).toEqual([{ number: 1, start: 0, end: 0 }, { number: 2, start: 2, end: 3 }]);
});
test('glyph matching handles whitespace, Arabic ligatures and emoji but refuses repeated or changed content', () => {
  const text = 'Start ﬁle\n\u200fﻻ 🧪 42.';
  const match = uniquePdfTextMatch(text, 'file لا 🧪 42');
  expect(match && text.slice(match.start, match.end)).toBe('ﬁle\n\u200fﻻ 🧪 42');
  expect(uniquePdfTextMatch('Repeated 42. Repeated 42.', 'Repeated 42')).toBeNull();
  expect(uniquePdfTextMatch(text, 'file لا 🧪 24')).toBeNull();
  expect(uniquePdfTextMatch(text, '   ')).toBeNull();
  expect(uniquePdfTextMatch('الدلي\u0006ل 42', 'الدليل 42')).toEqual({ start: 0, end: 10 });
});
test('server adds physical pages and clients cannot supply them', () => {
  const draft = parseWritingDraft({ text: 'Claim', citations: [{ ...citation, pdfPages: { first: 49, last: 50, fileHash: 'b'.repeat(64) } }] })!;
  expect(draft.citations[0]).not.toHaveProperty('pdfPages');
  const saved = attachWritingSource(draft.citations[0], source);
  expect(saved.pdfPages).toEqual({ first: 2, last: 2, fileHash: info.fileHash });
  expect(saved.source).not.toHaveProperty('pdf');
  expect(readSavedWriting({ ...draft, citations: [saved] })?.citations[0].pdfPages).toEqual(saved.pdfPages);
  expect(attachWritingSource(citation, { ...source, pdf: undefined })).not.toHaveProperty('pdfPages');
});
test('project export excludes private file manifests from research sections', () => {
  const model = buildProjectExportModel({ title: 'Fixture', university_policy: null }, [{ type: 'pdf-original:v1', content: JSON.stringify(record), version: 1 }], [], []);
  expect(JSON.stringify(model)).not.toContain(record.ownerId);
  expect(JSON.stringify(model)).not.toContain(record.fileHash);
});
