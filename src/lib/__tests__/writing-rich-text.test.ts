import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { appendWritingRichText, plainWritingDocument, readWritingRichDocument, writingRichBlocks, writingRichText, writingSelectionOffsets, type WritingRichDocument } from '@/lib/writing-rich-text';
import { parseWritingDraft, rebaseWritingCitations, claimIsAnchored } from '@/lib/evidence-writing';
import { pdfVisualRuns, pdfVisualStyledRuns } from '@/lib/pdf-text-runs';
import { richWritingCitationBlocks } from '@/lib/writing-rich-citations';

const fixture: WritingRichDocument = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'مراجعة الأدلة' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'نتيجة 😀 ' }, { type: 'text', text: 'محدودة.', marks: [{ type: 'bold' }, { type: 'italic' }] }] },
  { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First result.' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested limit.' }] }] }] }] }] },
  { type: 'paragraph' },
  { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original passage.' }, { type: 'hardBreak' }, { type: 'text', text: 'Second line.' }] }] },
] };

test.each(['', 'one\nline\n\nsecond', '\n\n\n', 'العينة ٤٢ 😀\n\nتفسير محدود.'])('opens legacy writing without changing a character or its offsets: %s', text => {
  const document = plainWritingDocument(text);
  expect(readWritingRichDocument(document)).not.toBeNull(); expect(writingRichText(document)).toBe(text);
  expect(parseWritingDraft({ text, citations: [] })).toEqual({ text, citations: [] });
});

test('validates the structured content against canonical plain text and preserves heading/list structure', () => {
  const doc = readWritingRichDocument(fixture)!;
  expect(writingRichText(doc)).toBe('مراجعة الأدلة\n\nنتيجة 😀 محدودة.\n\nFirst result.\n\nNested limit.\n\n\n\nOriginal passage.\nSecond line.');
  expect(parseWritingDraft({ text: 'A different hidden claim.', citations: [], richText: doc })).toBeNull();
  expect(parseWritingDraft({ text: writingRichText(doc), citations: [], richText: doc })?.richText).toEqual(doc);
  const blocks = writingRichBlocks(doc);
  expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
  expect(blocks[2]).toMatchObject({ prefix: '3. ', indent: 1 }); expect(blocks[3]).toMatchObject({ prefix: '• ', indent: 2 });
  expect(blocks.at(-1)?.quote).toBe(true);
});

test.each([
  { type: 'doc', content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }] },
  { type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' } }] },
  { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] },
  { type: 'doc', content: [{ type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'invalid' }] }] },
  { type: 'doc', content: [{ type: 'orderedList', attrs: { start: -1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] },
  { type: 'doc', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
  { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(120001) }] }] },
])('rejects unsupported or unsafe structure instead of saving executable attributes (%j)', value => expect(readWritingRichDocument(value)).toBeNull());

test('limits nesting and structural overhead before recursively processing a hostile document', () => {
  let node: unknown = { type: 'paragraph' };
  for (let index = 0; index < 30; index++) node = { type: 'blockquote', content: [node] };
  expect(readWritingRichDocument({ type: 'doc', content: [node] })).toBeNull();
  expect(readWritingRichDocument({ type: 'doc', content: Array.from({ length: 12001 }, () => ({ type: 'paragraph' })) })).toBeNull();
});

test('maps real ProseMirror selections through headings, nested lists, blank paragraphs and UTF-16 emoji', () => {
  const schema = getSchema([StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, horizontalRule: false, link: false, trailingNode: false })]);
  const doc = schema.nodeFromJSON(fixture); const plain = writingRichText(fixture);
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const range = writingSelectionOffsets(doc, pos, pos + node.text.length);
      expect(range).not.toBeNull(); expect(plain.slice(range!.start, range!.end)).toBe(node.text);
    }
  });
  expect(writingSelectionOffsets(doc, 1, 1)).toBeNull();
});

test('appending a new entry retains all earlier formatting and blank-line citation coordinates', () => {
  const old = writingRichText(fixture); const appended = appendWritingRichText(fixture, old, 'New paragraph.\nNext line.')!;
  expect(appended.content.slice(0, fixture.content.length)).toEqual(fixture.content);
  expect(writingRichText(appended)).toBe(`${old}\n\nNew paragraph.\nNext line.`);
  expect(appendWritingRichText(undefined, old, 'new')).toBeUndefined();
});

test('inserts the displayed citation before punctuation without changing the saved bold claim', () => {
  const document = { type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A bounded result.', marks: [{ type: 'bold' as const }] }] }] };
  const before = JSON.stringify(document);
  const blocks = richWritingCitationBlocks(document, { style: 'apa-7', segments: [{ text: 'A bounded result.', inText: '(Smith, 2024)', citationIds: ['c1'] }], bibliography: [], issues: [] });
  expect(blocks[0].runs.map(r => r.text).join('')).toBe('A bounded result (Smith, 2024).');
  expect(blocks[0].runs[0].marks).toEqual(['bold']); expect(blocks[0].runs.at(-1)?.marks).toEqual(['bold']);
  expect(JSON.stringify(document)).toBe(before);
});

test('changing only formatting leaves an exact source link anchored', () => {
  const text = 'A bounded claim.';
  const citation = { id: 'old', claimStart: 0, claimEnd: text.length, claimText: text } as Parameters<typeof claimIsAnchored>[1];
  expect(claimIsAnchored(text, rebaseWritingCitations(text, text, [citation])[0])).toBe(true);
});

test('a soft line break retains the active inline marks without changing its single UTF-16 position', () => {
  const rich = readWritingRichDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }, { type: 'hardBreak', marks: [{ type: 'bold' }] }, { type: 'text', text: 'Second' }] }] })!;
  expect(rich).not.toBeNull(); expect(writingRichText(rich)).toBe('First\nSecond');
});

test.each(['المجلد 12(2), 10–18. نتيجة ٤٢.', 'مراجع (Smith, 2024). النتيجة 20–50.', 'رقم ١٢(٢)، ١٠–١٨.', 'نتيجة 😀 (١٢٣) ثم نتيجة.'])('keeps styled Arabic numeric expressions in the proven visual order (%s)', text => {
  const styled = pdfVisualStyledRuns([{ text }]);
  expect(styled.map(r => r.text).join('')).toBe(pdfVisualRuns(text).join(''));
  const rich = pdfVisualStyledRuns([{ text: text.slice(0, 5) }, { text: text.slice(5), marks: ['bold'] }]);
  expect([...rich.map(r => r.text).join('')].sort()).toEqual([...text].sort());
  expect(rich.some(r => r.marks?.includes('bold'))).toBe(true);
});

test('a style boundary inside an Arabic directional run places the earlier logical span on the right', () => {
  const runs = pdfVisualStyledRuns([{ text: 'أول', marks: ['bold'] }, { text: ' ثاني ثالث' }]);
  expect(runs[0].text).toContain('ثاني'); expect(runs.at(-1)?.text).toBe('أول'); expect(runs.at(-1)?.marks).toEqual(['bold']);
});
