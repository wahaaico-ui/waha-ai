import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { supervisorExportModel } from '@/lib/supervisor-review';

test('mixed Arabic/English export preserves directions, paragraphs and the actual review decisions', async () => {
  const review = { originalText: 'Declared original English paragraph: sample 42, citation [1].', revisedText: 'Declared revised English paragraph: sample 42, citation [1].\n\nA second paragraph limits the conclusion to the studied context.', notes: [{ id: 'fixture', comment: 'حدد حدود النتيجة ولا تعممها على مجتمع آخر.', location: 'Conclusion', response: 'I restricted the conclusion to the study population.', status: 'addressed' as const }] };
  const model = supervisorExportModel(review);
  const folder = mkdtempSync(join(tmpdir(), 'waha-review-layout-'));
  const docx = await buildProjectDocx(model); const pdf = await buildProjectPdf(model);
  const path = join(folder, 'review.docx'); writeFileSync(path, docx);
  const xml = execFileSync('unzip', ['-p', path, 'word/document.xml'], { encoding: 'utf8' });
  expect(xml).toContain('<w:jc w:val="start"/>');
  expect(xml).toContain('<w:bidi/>'); expect(xml).toContain('<w:bidi w:val="false"/>');
  const storedText = xml.replace(/<[^>]+>/g, '').replace(/\u200e/g, '');
  expect(storedText).toContain('sample 42, citation [1]'); expect(storedText).toContain(review.notes[0].response);
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  if (process.env.WAHA_QA_ARTIFACT_DIR) {
    mkdirSync(process.env.WAHA_QA_ARTIFACT_DIR, { recursive: true });
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, 'supervisor-review-fixture.pdf'), pdf);
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, 'supervisor-review-fixture.docx'), docx);
  }
}, 30_000);
