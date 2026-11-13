/** @jest-environment node */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';
import { buildProjectLatex } from '@/lib/latex-export';
import { taskMarkdown } from '@/lib/research-task-export';
import type { ProjectExportModel } from '@/lib/project-export';

const MARK = 'أُعد بمساعدة الواحة';
const model = (watermark?: ProjectExportModel['watermark']): ProjectExportModel => ({
  language: 'ar', documentDirection: 'rtl', title: 'عنوان البحث', notice: 'ملاحظة', sections: [{ title: 'المقدمة', paragraphs: ['نص البحث.'] }],
  ...(watermark ? { watermark } : {}),
});
function wordText(buffer: Buffer) {
  const dir = mkdtempSync(join(tmpdir(), 'waha-mark-'));
  try {
    const file = join(dir, 'file.docx'); writeFileSync(file, buffer);
    return execFileSync('unzip', ['-p', file, 'word/*.xml'], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

describe('the free plan mark on exported files (DOC-41-06)', () => {
  test('free files carry the mark in Word, LaTeX and Markdown; it is the default when the plan is unknown', async () => {
    for (const watermark of [undefined, 'free'] as const) {
      expect(wordText(await buildProjectDocx(model(watermark)))).toContain(MARK);
      expect(buildProjectLatex(model(watermark))).toContain(MARK);
      expect(taskMarkdown(model(watermark))).toContain(MARK);
    }
  });

  test('a subscriber\'s files carry no mark and no WAHA footer', async () => {
    const word = wordText(await buildProjectDocx(model('none')));
    expect(word).not.toContain(MARK);
    expect(word).not.toContain('WAHA - ');
    expect(buildProjectLatex(model('none'))).not.toContain(MARK);
    expect(taskMarkdown(model('none'))).not.toContain(MARK);
  });
});

describe('protecting the mark in PDF files (DOC-41-07)', () => {
  test('a free PDF opens without a password but refuses editing; a subscriber\'s PDF is not restricted', async () => {
    const free = await buildProjectPdf(model('free'));
    expect(free.includes(Buffer.from('/Encrypt'))).toBe(true);
    const paid = await buildProjectPdf(model('none'));
    expect(paid.includes(Buffer.from('/Encrypt'))).toBe(false);
  }, 60000);
});
