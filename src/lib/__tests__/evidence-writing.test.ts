import { writingExportModel } from '@/lib/evidence-writing-export';
import { createHash, randomUUID } from 'node:crypto';
import { attachWritingSource, claimIsAnchored, parseWritingDraft, quoteMatchesSource, readSavedWriting, rebaseWritingCitations, safeWritingUrl, writingSegments, type WritingCitation, type WritingSource } from '@/lib/evidence-writing';

const text = '🙂 تشير نتائج الدراسة إلى تحسن محدود. ولا يمكن تعميم النتيجة.';
const claimText = 'تشير نتائج الدراسة إلى تحسن محدود.';
const sourceText = 'Study title\nA limited improvement was observed.\nOther contexts were not evaluated.';
const quoteText = 'A limited improvement was observed.';
const source: WritingSource = { id: randomUUID(), kind: 'pdf', title: 'Local fixture study', text: sourceText, hash: createHash('sha256').update(sourceText).digest('hex'), origin: 'uploaded_text', url: null, year: null };
const citation: WritingCitation = { id: randomUUID(), claimStart: text.indexOf(claimText), claimEnd: text.indexOf(claimText) + claimText.length, claimText, sourceKind: 'pdf', sourceId: source.id, sourceHash: source.hash, quoteStart: sourceText.indexOf(quoteText), quoteEnd: sourceText.indexOf(quoteText) + quoteText.length, quoteText, relation: 'supports', note: 'This is a manual interpretation of fixture text.' };

test('matches actual owned-source characters and computes lines without inventing PDF pages', () => {
  expect(parseWritingDraft({ text, citations: [citation], verified: true })).toEqual({ text, citations: [citation] });
  expect(claimIsAnchored(text, citation)).toBe(true);
  expect(quoteMatchesSource(citation, source)).toBe(true);
  expect(quoteMatchesSource({ ...citation, quoteText: 'Invented evidence of the same size.' }, source)).toBe(false);
  expect(quoteMatchesSource({ ...citation, quoteStart: citation.quoteStart + 1 }, source)).toBe(false);
  expect(quoteMatchesSource(citation, { ...source, hash: '0'.repeat(64) })).toBe(false);
  expect(attachWritingSource(citation, source)).toMatchObject({ firstLine: 2, lastLine: 2 });
  expect(attachWritingSource(citation, source)).not.toHaveProperty('page');
});

test('moves an anchored passage after edits before it and preserves edits after it', () => {
  const prefix = 'مقدمة جديدة. ';
  const moved = rebaseWritingCitations(text, prefix + text, [citation])[0];
  expect(moved.claimStart).toBe(citation.claimStart + prefix.length);
  expect(claimIsAnchored(prefix + text, moved)).toBe(true);
  const suffix = ' وتحتاج إلى دراسة إضافية.';
  expect(rebaseWritingCitations(text, text + suffix, [citation])[0]).toEqual(citation);
});

test('a changed claim keeps its evidence but is excluded from anchored inline rendering', () => {
  const revised = text.replace('تحسن محدود', 'تحسن كبير');
  const updated = rebaseWritingCitations(text, revised, [citation]);
  expect(updated[0].quoteText).toBe(quoteText);
  expect(claimIsAnchored(revised, updated[0])).toBe(false);
  expect(writingSegments({ text: revised, citations: updated }).flatMap(s => s.citations)).toEqual([]);
});

test('allows several sources for one claim but rejects partial overlapping anchors', () => {
  const second = { ...citation, id: randomUUID(), sourceId: randomUUID() };
  expect(parseWritingDraft({ text, citations: [citation, second] })).not.toBeNull();
  expect(writingSegments({ text, citations: [citation, second] }).find(s => s.citations.length)?.citations).toHaveLength(2);
  const overlapping = { ...second, claimStart: citation.claimStart + 1, claimText: citation.claimText.slice(1) };
  expect(parseWritingDraft({ text, citations: [citation, overlapping] })).toBeNull();
});

test.each([
  { sourceKind: 'external' }, { sourceId: 'foreign text' }, { sourceHash: 'verified' }, { quoteStart: -1 },
  { quoteEnd: 1.5 }, { claimStart: Number.MAX_SAFE_INTEGER + 1 }, { relation: 'scientifically_proven' }, { note: '\u0000' },
])('rejects invalid citation fields %s', patch => {
  expect(parseWritingDraft({ text, citations: [{ ...citation, ...patch }] })).toBeNull();
});

test('does not split surrogate pairs and never accepts browser-provided source metadata', () => {
  const split = { ...citation, claimStart: 1, claimEnd: 2, claimText: text.slice(1, 2) };
  expect(claimIsAnchored(text, split)).toBe(false);
  const parsed = parseWritingDraft({ text, citations: [{ ...citation, source: { title: 'Fake trusted title' }, verified: true }] });
  expect(parsed?.citations[0]).not.toHaveProperty('source');
  expect(parsed?.citations[0]).not.toHaveProperty('verified');
  expect(safeWritingUrl('javascript:alert(1)')).toBeNull();
  expect(safeWritingUrl('https://user:password@example.test')).toBeNull();
});

test('the same quote is not counted twice for the same claim', () => {
  expect(parseWritingDraft({ text, citations: [citation, { ...citation, id: randomUUID(), relation: 'contradicts' }] })).toBeNull();
});

test.each(['ar', 'en'] as const)('restores and exports the actual draft, quote and assigned relation in %s', language => {
  const saved = { text, citations: [attachWritingSource(citation, source)] };
  const restored = readSavedWriting(JSON.stringify(saved)); expect(restored).toEqual(saved);
  const output = writingExportModel(restored!, language);
  const content = output.sections.flatMap(s => s.paragraphs).join('\n');
  expect(content).toContain(claimText);
  expect(content).toContain(quoteText);
  expect(content).toContain('2–2');
  expect(content).not.toContain(source.hash);
  expect(content).not.toContain(citation.id);
});
