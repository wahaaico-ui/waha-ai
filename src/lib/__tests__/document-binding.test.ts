import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { inferDocumentDirection } from '@/lib/document-direction';
import { WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';
import { buildProjectExportModel } from '@/lib/project-export';
import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';

test.each([
  { language: 'en' as const, text: 'هذه مسودة بحثية عربية، وتبقى جهة التجليد يمين الصفحة عند تغيير لغة الواجهة.', direction: 'rtl', side: 'right', other: 'left' },
  { language: 'ar' as const, text: 'This English manuscript keeps its binding margin on the left even when the interface is Arabic.', direction: 'ltr', side: 'left', other: 'right' },
])('binding follows manuscript rather than $language interface in Word and PDF', async ({ language, text, direction, side, other }) => {
  const model = buildProjectExportModel({ title: 'Project', university_policy: 'Binding margin: 3.5 cm\nOther margin: 2.5 cm' }, [
    { type: WRITING_DOCUMENT_TYPE, content: JSON.stringify({ text, citations: [] }), version: 1 },
  ], [], Array.from({ length: 50 }, (_, i) => ({ title: `English source ${i}`, authors: ['Smith'], publication_year: 2024, publication_title: null, doi: null, url: null })), 'apa-7', language);
  expect(model.documentDirection).toBe(direction);
  const folder = mkdtempSync(join(tmpdir(), 'waha-binding-'));
  const originalAddPage = PDFDocument.prototype.addPage;
  const margins: Array<{ left: number; right: number }> = [];
  const pageSpy = jest.spyOn(PDFDocument.prototype, 'addPage').mockImplementation(function (this: PDFKit.PDFDocument, options) {
    const result = originalAddPage.call(this, options);
    margins.push({ left: this.page.margins.left, right: this.page.margins.right });
    return result;
  });
  try {
    const file = join(folder, 'manuscript.docx');
    writeFileSync(file, await buildProjectDocx(model));
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
    expect(xml).toContain(`w:${side}="1985"`);
    expect(xml).toContain(`w:${other}="1418"`);
    expect((await buildProjectPdf(model)).subarray(0, 4).toString()).toBe('%PDF');
    expect(margins.length).toBeGreaterThan(0);
    for (const page of margins) {
      expect(page[side as 'left' | 'right']).toBeCloseTo(3.5 * 72 / 2.54);
      expect(page[other as 'left' | 'right']).toBeCloseTo(2.5 * 72 / 2.54);
    }
  } finally { pageSpy.mockRestore(); rmSync(folder, { recursive: true, force: true }); }
}, 30_000);

test('script ties use the manuscript first letter and digits do not choose a binding side', () => {
  expect(inferDocumentDirection('2026 أ A')).toBe('rtl');
  expect(inferDocumentDirection('٢٠٢٦ A أ')).toBe('ltr');
});
