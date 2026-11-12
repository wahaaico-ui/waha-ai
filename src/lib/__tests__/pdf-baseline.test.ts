import PDFDocument from 'pdfkit';
import { buildProjectPdf } from '@/lib/project-document-export';
import type { ProjectExportModel } from '@/lib/project-export';

type Drawn = { text: string; y: number; baseline: number };

/** Where PDFKit puts each run's baseline: its y plus the drop the baseline option asks for. */
async function drawnRuns(model: ProjectExportModel) {
  const drawn: Drawn[] = [];
  const original = PDFDocument.prototype.text;
  const spy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (this: PDFKit.PDFDocument & { _font: { ascender: number }; _fontSize: number }, ...args: unknown[]) {
    const [text, x, y, options] = args as [string, number | undefined, number | undefined, { baseline?: number | string } | undefined];
    if (typeof y === 'number' && typeof x === 'number') {
      const drop = typeof options?.baseline === 'number' ? -options.baseline : this._font.ascender / 1000 * this._fontSize;
      drawn.push({ text: String(text), y, baseline: y + drop });
    }
    return original.apply(this, args as Parameters<typeof original>);
  });
  try { await buildProjectPdf(model); } finally { spy.mockRestore(); }
  return drawn;
}

test.each([
  ['a plain paragraph', { title: 'تقرير', notice: 'ملاحظة', sections: [{ title: 'القسم', paragraphs: ['المسودة 500 كلمة، وحد الدليل 40000 كلمة حسب APA 7.'] }] }],
  ['a rich block', { title: 'تقرير', notice: 'ملاحظة', sections: [{ title: 'القسم', paragraphs: [], blocks: [{ kind: 'paragraph', level: 0, indent: 0, runs: [{ text: 'أجري الاختبار على 30 طالبًا في عام 2024 باستخدام SPSS.' }] }] }] }],
] as const)('digits and Latin words sit on the Arabic baseline in %s', async (_name, model) => {
  const drawn = await drawnRuns(model as unknown as ProjectExportModel);
  const lines = new Map<number, Drawn[]>();
  for (const run of drawn) lines.set(run.y, [...(lines.get(run.y) || []), run]);
  const mixed = [...lines.values()].filter(runs => runs.some(run => /\p{Script=Arabic}/u.test(run.text)) && runs.some(run => /[0-9A-Za-z]/.test(run.text) && !/\p{Script=Arabic}/u.test(run.text)));
  expect(mixed.length).toBeGreaterThan(0);
  for (const runs of mixed) expect(new Set(runs.map(run => run.baseline.toFixed(2))).size).toBe(1);
});
