import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { writingTableExtensions } from '@/lib/writing-table-extensions';
import { groupWritingRenderBlocks, readWritingRichDocument, writingRichBlocks, writingRichText, writingSelectionOffsets, type WritingRichDocument, type WritingRichNode } from '@/lib/writing-rich-text';
import { claimIsAnchored, parseWritingDraft, rebaseWritingCitations } from '@/lib/evidence-writing';
import { richWritingCitationBlocks } from '@/lib/writing-rich-citations';
import { writingBlocksMarkdown } from '@/lib/writing-markdown';
import { buildProjectMarkdown } from '@/lib/project-export';
import { WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';

const paragraph = (text = ''): WritingRichNode => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) });
const cell = (text = '', header = false): WritingRichNode => ({ type: header ? 'tableHeader' : 'tableCell', content: [paragraph(text)] });
const table = (): WritingRichNode => ({ type: 'table', content: [
  { type: 'tableRow', content: [cell('المصدر', true), cell('Result', true)] },
  { type: 'tableRow', content: [cell(), { type: 'tableCell', content: [paragraph('العينة ٤٢ 😀.'), paragraph('A bounded finding.')] }] },
] });
const fixture = (): WritingRichDocument => ({ type: 'doc', content: [paragraph('Before.'), table(), paragraph('After.')] });

test('persists rectangular tables and empty cells without flattening their structure', () => {
  const richText = readWritingRichDocument(fixture())!;
  const text = writingRichText(richText);
  expect(text).toBe('Before.\n\nالمصدر\n\nResult\n\n\n\nالعينة ٤٢ 😀.\n\nA bounded finding.\n\nAfter.');
  expect(parseWritingDraft({ richText, text, citations: [] })?.richText).toEqual(richText);
  expect(parseWritingDraft({ richText, text: text.replace('٤٢', '٤٣'), citations: [] })).toBeNull();
  const items = groupWritingRenderBlocks(writingRichBlocks(richText));
  expect(items).toHaveLength(3);
  expect(items[1]).toMatchObject({ kind: 'table', rows: [{ cells: [{ header: true }, { header: true }] }, { cells: [{ blocks: [{ runs: [] }] }, { blocks: [{ runs: [{ text: 'العينة ٤٢ 😀.' }] }, { runs: [{ text: 'A bounded finding.' }] }] }] }] });
});

test('maps actual ProseMirror selections inside multiple paragraphs and blank cells to canonical UTF-16 positions', () => {
  const schema = getSchema([StarterKit, ...writingTableExtensions]);
  const richText = readWritingRichDocument(fixture())!;
  const doc = schema.nodeFromJSON(richText), text = writingRichText(richText);
  // Tiptap emits defaults (including align:null) even when they were not stored.
  expect(readWritingRichDocument(doc.toJSON())).toEqual(richText);
  doc.descendants((node, position) => {
    if (node.isText && node.text) {
      const range = writingSelectionOffsets(doc, position, position + node.text.length)!;
      expect(range).not.toBeNull(); expect(text.slice(range.start, range.end)).toBe(node.text);
    }
  });
});

test('retains a cell citation when table-only formatting changes and inserts its display inside that cell', () => {
  const doc = readWritingRichDocument(fixture())!, text = writingRichText(doc);
  const claimText = 'العينة ٤٢ 😀.', start = text.indexOf(claimText);
  const citation = { id: 'c1', claimStart: start, claimEnd: start + claimText.length, claimText } as Parameters<typeof claimIsAnchored>[1];
  const updated = structuredClone(doc);
  updated.content[1].content![1].content![1].content![0].content![0].marks = [{ type: 'bold' }];
  expect(writingRichText(updated)).toBe(text);
  expect(claimIsAnchored(text, rebaseWritingCitations(text, writingRichText(updated), [citation])[0])).toBe(true);
  const plan = { style: 'apa-7' as const, segments: [{ text: text.slice(0, start), inText: '', citationIds: [] }, { text: claimText, inText: '(Smith, 2024)', citationIds: ['c1'] }, { text: text.slice(start + claimText.length), inText: '', citationIds: [] }], bibliography: [], issues: [] };
  const block = richWritingCitationBlocks(updated, plan).find(b => b.table?.row === 1 && b.table.column === 1)!;
  expect(block.runs.map(r => r.text).join('')).toBe('العينة ٤٢ 😀 (Smith, 2024).');
  expect(block.table).toMatchObject({ row: 1, column: 1 });
});

test.each(['colspan', 'rowspan', 'colwidth', 'style', 'onclick'])('rejects unsupported cell attributes instead of silently changing a table: %s', key => {
  const doc = fixture();
  doc.content[1].content![0].content![0].attrs = { [key]: key === 'colspan' || key === 'rowspan' ? 2 : key === 'colwidth' ? [200] : 'alert(1)' } as never;
  expect(readWritingRichDocument(doc)).toBeNull();
});

test('rejects ragged or nested tables and cells with missing paragraphs', () => {
  const ragged = fixture(); ragged.content[1].content![1].content!.pop();
  expect(readWritingRichDocument(ragged)).toBeNull();
  const nested = fixture(); nested.content[1].content![1].content![0].content = [table()];
  expect(readWritingRichDocument(nested)).toBeNull();
  const empty = fixture(); empty.content[1].content![1].content![0].content = [];
  expect(readWritingRichDocument(empty)).toBeNull();
});

test('separates adjacent tables and enforces bounded layout without limiting project references', () => {
  const doc: WritingRichDocument = { type: 'doc', content: [table(), table()] };
  const groups = groupWritingRenderBlocks(writingRichBlocks(readWritingRichDocument(doc)!));
  expect(groups).toHaveLength(2);
  const tooWide: WritingRichDocument = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: Array.from({ length: 9 }, () => cell()) }] }] };
  expect(readWritingRichDocument(tooWide)).toBeNull();
  const tooTall: WritingRichDocument = { type: 'doc', content: [{ type: 'table', content: Array.from({ length: 201 }, () => ({ type: 'tableRow', content: [cell()] })) }] };
  expect(readWritingRichDocument(tooTall)).toBeNull();
});

test.each(['ar', 'en'] as const)('project Markdown preserves table rows and safely escapes cell content (%s)', language => {
  const doc = fixture(); doc.content[1].content![1].content![0].content = [paragraph('<script>x</script> | [unsafe](javascript:x)'), paragraph('second\nline')];
  const richText = readWritingRichDocument(doc)!;
  const blocks = writingBlocksMarkdown(writingRichBlocks(richText));
  expect(blocks[1]).toContain('| --- | --- |');
  expect(blocks[1]).toContain('&lt;script&gt;'); expect(blocks[1]).not.toContain('<script>');
  expect(blocks[1]).toContain('\\|'); expect(blocks[1]).toContain('<br><br>second<br>line');
  const draft = { text: writingRichText(richText), richText, citations: [] };
  const exported = buildProjectMarkdown({ title: 'Table fixture', university_policy: null }, [{ type: WRITING_DOCUMENT_TYPE, content: draft, version: 1 }], [], [], undefined, language);
  expect(exported).toContain('| --- | --- |'); expect(exported).toContain('العينة');
  expect(exported).not.toContain('<script>');
});
