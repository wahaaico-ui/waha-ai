import { renderToStaticMarkup } from 'react-dom/server';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import WritingCitationPreview from '@/components/WritingCitationPreview';
import { attachWritingSource } from '@/lib/evidence-writing';
import { bibliographyFromReference } from '@/lib/citations/writing-bibliography';
import { writingExportModel } from '@/lib/evidence-writing-export';
import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';
import { writingRichText, type WritingRichDocument } from '@/lib/writing-rich-text';

test.each(['ar', 'en'] as const)('formatted writing and its real CSL citation survive preview and native files (%s)', async language => {
  const ar = language === 'ar';
  const heading = ar ? 'عينة تنسيق تجريبية — ليست بحثًا علميًا' : 'Formatting fixture — not scientific research';
  const claim = ar ? 'تشير العينة ٤٢ إلى تحسن محدود.' : 'The sample of 42 suggests a limited improvement.';
  const richText: WritingRichDocument = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: heading }] },
    { type: 'paragraph', content: [{ type: 'text', text: claim, marks: [{ type: 'bold' }] }] },
    { type: 'orderedList', attrs: { start: 1 }, content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: ar ? 'مجلد 12(2), 10–18.' : 'Volume 12(2), 10–18.', marks: [{ type: 'italic' }] }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: ar ? 'هذه نتيجة تحتاج مراجعة.' : 'This finding needs review.', marks: [{ type: 'underline' }] }] }] },
    ] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'strike' }] }] }] },
  ] };
  const text = writingRichText(richText); const claimStart = text.indexOf(claim);
  const source = { id: 'ba13fcdb-69a7-41aa-a2c9-c495917bcfa3', kind: 'reference' as const, title: 'Fixture study', text: 'Original bounded passage.', hash: 'a'.repeat(64), origin: 'user_asserted', url: null, year: 2024, bibliography: bibliographyFromReference({ authors: [{ family: 'Smith', given: 'Jane' }], publication_title: 'Fixture Journal', doi: null, citation_data: {} }) };
  const citation = attachWritingSource({ id: 'faddfe2c-78f0-4e15-a24d-df151c43f7aa', claimStart, claimEnd: claimStart + claim.length, claimText: claim, sourceKind: 'reference', sourceId: source.id, sourceHash: source.hash, quoteStart: 0, quoteEnd: source.text.length, quoteText: source.text, relation: 'contextual', note: '' }, source);
  const draft = { text, richText, citations: [citation] };
  const html = renderToStaticMarkup(<WritingCitationPreview draft={draft} sources={{}} language={language} onOpen={() => {}} />);
  expect(html).toContain('role="heading"'); expect(html).toContain('font-weight:750'); expect(html).toContain('font-style:italic');
  expect(html).toContain('(Smith, 2024)'); expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
  const model = writingExportModel(draft, language);
  const blocks = model.sections[0].blocks!;
  expect(blocks.map(b => (b.prefix || '') + b.runs.map(r => r.text).join('')).join('\n')).toContain('(Smith, 2024).');
  expect(blocks[1].runs[0].marks).toContain('bold'); expect(blocks[2].prefix).toBe('1. ');
  const folder = mkdtempSync(join(tmpdir(), 'waha-formatted-export-'));
  const file = join(folder, 'fixture.docx'); const docx = await buildProjectDocx(model); writeFileSync(file, docx);
  const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
  expect(xml).toContain('<w:b/>'); expect(xml).toContain('<w:i/>'); expect(xml).toContain('<w:u'); expect(xml).toContain('<w:strike/>');
  expect(xml).toContain('w:val="Heading1"'); expect(xml.replace(/<[^>]+>/g, '').replace(/\u200e/g, '')).toContain('12(2), 10–18');
  expect(xml).toContain('<w:numPr>');
  if (language === 'en') expect(xml).not.toMatch(/[\u0600-\u06ff]/);
  const pdf = await buildProjectPdf(model); expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  if (process.env.WAHA_QA_ARTIFACT_DIR) {
    mkdirSync(process.env.WAHA_QA_ARTIFACT_DIR, { recursive: true });
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, `rich-editor-${language}.pdf`), pdf);
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, `rich-editor-${language}.docx`), docx);
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, `rich-editor-${language}.json`), JSON.stringify(model, null, 2));
  }
}, 30000);
