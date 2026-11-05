import { writingExportModel } from '@/lib/evidence-writing-export';
import { randomUUID } from 'node:crypto';
import { buildWritingCitationPlan, writingCitationDisplay } from '@/lib/citations/writing-citations';
import { bibliographyFromReference } from '@/lib/citations/writing-bibliography';
import { CITATION_STYLES } from '@/lib/citations/types';
import { attachWritingSource, parseWritingDraft, readSavedWriting, type SavedWritingDraft, type WritingSource } from '@/lib/evidence-writing';
import { buildProjectExportModel, buildProjectMarkdown } from '@/lib/project-export';

function source(title: string, family = 'Smith', year: number | null = 2024, doi: string | null = null): WritingSource {
  return { id: randomUUID(), kind: 'reference', title, text: 'Fixture source passage.', hash: 'a'.repeat(64), year, url: null, origin: 'user_asserted', bibliography: bibliographyFromReference({ authors: [{ family, given: 'Jane' }], publication_title: 'Fixture Journal', doi, citation_data: { volume: '12', issue: '2', pages: '10–18' } }) };
}
function draftOf(sources: WritingSource[]): SavedWritingDraft {
  let text = '';
  const citations = sources.map((s, index) => {
    const claimText = `Fixture claim ${index + 1}.`, claimStart = text.length;
    text += claimText + '\n';
    return attachWritingSource({ id: randomUUID(), claimStart, claimEnd: claimStart + claimText.length, claimText, sourceKind: s.kind, sourceId: s.id, sourceHash: s.hash, quoteStart: 0, quoteEnd: s.text.length, quoteText: s.text, relation: 'contextual', note: 'Synthetic formatting fixture; not a scientific assessment.' }, s);
  });
  return { text, citations };
}

test('APA updates earlier citations when the same author and year need a/b suffixes', () => {
  const draft = draftOf([source('Zeta study'), source('Alpha study')]);
  const plan = buildWritingCitationPlan(draft);
  expect(plan.segments.filter(s => s.inText).map(s => s.inText)).toEqual(['(Smith, 2024b)', '(Smith, 2024a)']);
  expect(plan.bibliography.map(b => b.text)).toEqual([
    'Smith, J. (2024a). Alpha study. Fixture Journal, 12(2), 10–18.',
    'Smith, J. (2024b). Zeta study. Fixture Journal, 12(2), 10–18.',
  ]);
  expect(plan.issues).toEqual([]);
});

test('a stored range whose first and last page are equal is formatted as one article number', () => {
  const stored: WritingSource = { ...source('Article number study'), bibliography: bibliographyFromReference({ authors: [{ family: 'Boggs', given: 'Jill A.' }], publication_title: 'Journal of Second Language Writing', doi: null, citation_data: { volume: '46', pages: '100671-100671' } }) };
  const plan = buildWritingCitationPlan(draftOf([stored]));
  expect(plan.bibliography[0].text).toBe('Boggs, J. A. (2024). Article number study. Journal of Second Language Writing, 46, 100671.');
});

test('IEEE follows first appearance and reuses the same number for repeated sources', () => {
  const first = source('First', 'Zed'), second = source('Second', 'Alpha');
  const draft = draftOf([first, second, first]);
  const plan = buildWritingCitationPlan(draft, {}, 'ieee');
  expect(plan.segments.filter(s => s.inText).map(s => s.inText)).toEqual(['[1]', '[2]', '[1]']);
  expect(plan.bibliography).toHaveLength(2);
  expect(plan.issues.some(issue => issue.reasons.includes('conflict'))).toBe(false);
  expect(plan.bibliography[0].text).toMatch(/^\[1\].*First/);
  expect(plan.bibliography[1].text).toMatch(/^\[2\].*Second/);
  const reversed = draftOf([second, first, second]);
  expect(buildWritingCitationPlan(reversed, {}, 'ieee').bibliography[0].text).toContain('Second');
});

test('groups multiple sources for one claim, deduplicates DOI aliases, and removes stale links from the cited list', () => {
  const first = source('Study one', 'Smith', 2024, '10.1234/fixture'), second = source('Study two', 'Jones');
  const draft = draftOf([first, second]);
  const original = draft.citations[0];
  draft.citations.push({ ...draft.citations[1], id: randomUUID(), claimStart: original.claimStart, claimEnd: original.claimEnd, claimText: original.claimText });
  const alias = { ...first, id: randomUUID(), bibliography: { ...first.bibliography!, doi: 'https://doi.org/10.1234/FIXTURE' } };
  draft.citations.push(attachWritingSource({ ...original, id: randomUUID(), sourceId: alias.id }, alias));
  let plan = buildWritingCitationPlan(draft, {}, 'ieee');
  expect(plan.bibliography).toHaveLength(2);
  expect(plan.segments[0].inText).toContain('1'); expect(plan.segments[0].inText).toContain('2');
  draft.citations = draft.citations.filter(c => c.sourceId !== first.id && c.sourceId !== alias.id);
  draft.text = draft.text.replace(draft.citations[0].claimText, 'Changed claim; needs review.');
  plan = buildWritingCitationPlan(draft, {}, 'ieee');
  expect(plan.bibliography).toHaveLength(1); // the other anchored claim still cites Jones
  draft.citations = [draft.citations[0]];
  expect(buildWritingCitationPlan(draft, {}, 'ieee').bibliography).toEqual([]);
  expect(writingExportModel(draft, 'en').sections.flatMap(s => s.paragraphs).join('\n')).toContain('this link needs review');
});

test.each(CITATION_STYLES)('uses an actual CSL processor for %s with 50 sources and repeat citations', style => {
  const sources = Array.from({ length: 50 }, (_, i) => source(`Formatting fixture study ${i + 1}`, `Family${i + 1}`, 2000 + i % 25));
  const draft = draftOf([...sources, sources[0], sources[49]]);
  const plan = buildWritingCitationPlan(draft, {}, style);
  expect(plan.bibliography).toHaveLength(50);
  expect(plan.segments.filter(s => s.inText)).toHaveLength(52);
  expect(plan.segments.filter(s => s.inText)[0].inText).toBe(plan.segments.filter(s => s.inText)[50].inText);
  expect(plan.bibliography.some(b => b.text.toLowerCase().includes('formatting fixture study 50'))).toBe(true);
  expect(plan.issues).toEqual([]);
});

test('preserves structured Arabic/compound/institutional names and reports unstructured names without guessing', () => {
  const data = bibliographyFromReference({ authors: [], publication_title: null, doi: null, citation_data: { creators: [{ creatorType: 'editor', firstName: 'Do not', lastName: 'Cite editor' }, { creatorType: 'author', firstName: 'محمد', lastName: 'أبو علوش' }, { creatorType: 'author', name: 'World Health Organization' }] } });
  expect(data.authors).toEqual([{ family: 'أبو علوش', given: 'محمد' }, { literal: 'World Health Organization' }]);
  expect(data.unstructuredNames).toBe(false);
  const s = source('دراسة تجريبية');
  s.bibliography = bibliographyFromReference({ authors: ['محمد أبو علوش'], publication_title: 'مجلة تجريبية', doi: null, citation_data: {} });
  const plan = buildWritingCitationPlan(draftOf([s]));
  expect(plan.segments[0].inText).toContain('محمد أبو علوش'); expect(plan.issues[0].reasons).toContain('names');
});

test('does not invent missing author/year/pages and keeps pre-upgrade snapshots readable', () => {
  const s = source('Known title', 'Smith', null); delete s.bibliography;
  const draft = draftOf([s]); const restored = readSavedWriting(draft)!;
  expect(restored).toEqual(draft);
  const plan = buildWritingCitationPlan(restored);
  expect(plan.issues[0].reasons).toEqual(expect.arrayContaining(['metadata', 'authors', 'year']));
  expect(JSON.stringify(plan)).not.toContain('Smith');
  expect(JSON.stringify(plan)).not.toMatch(/p\. |pp\. |2024/);
  expect(parseWritingDraft({ ...draft, citationStyle: 'invalid' })).toBeNull();
  expect(readSavedWriting({ ...draft, citations: [{ ...draft.citations[0], source: { ...s, bibliography: { authors: 'bad' } } }] })).toBeNull();
});

test('reports genuinely different publication data for the same DOI instead of silently treating it as verified', () => {
  const a = source('First supplied title', 'Smith', 2024, '10.1234/fixture');
  const b = source('Conflicting supplied title', 'Smith', 2024, '10.1234/fixture');
  const plan = buildWritingCitationPlan(draftOf([a, b]));
  expect(plan.bibliography).toHaveLength(1);
  expect(plan.issues[0].reasons).toContain('conflict');
  expect(plan.bibliography[0].text).toContain('First supplied title');
});

test.each(['ar', 'en'] as const)('editor/export share the cited-only bibliography and saved style in %s', language => {
  const draft = { ...draftOf([source('Cited source'), source('Second source', 'Jones')]), citationStyle: 'ieee' as const };
  const plan = buildWritingCitationPlan(draft);
  const docs = [{ type: 'evidence-writing:v1', content: JSON.stringify(draft), version: 1, created_at: '2026-10-15' }];
  const unused = { title: 'Uncited library study', authors: [], publication_year: null, publication_title: null, doi: null, url: null };
  const model = buildProjectExportModel({ title: 'Synthetic fixture', university_policy: null }, docs, [], [unused], undefined, language);
  const cited = model.sections.find(s => s.title.includes('IEEE'))!;
  expect(cited.paragraphs).toEqual(plan.bibliography.map(b => b.text));
  expect(cited.paragraphs.join('\n')).not.toContain(unused.title);
  expect(model.sections.flatMap(s => s.paragraphs).join('\n')).toContain(unused.title);
  const md = buildProjectMarkdown({ title: 'Synthetic fixture', university_policy: null }, docs, [], [unused], undefined, language);
  for (const b of plan.bibliography) expect(md.replace(/\\(.)/g, '$1')).toContain(b.text);
  const display = writingCitationDisplay(plan.segments[0]);
  expect(display.text + ' ' + display.inText + display.suffix).toBe('Fixture claim 1 [1].');
  expect(draft.text).toContain('Fixture claim 1.'); // original selection offsets never change
});
