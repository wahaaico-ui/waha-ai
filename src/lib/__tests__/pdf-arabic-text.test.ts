import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProjectPdf } from '@/lib/project-document-export';

async function extract(pdf: Buffer, artifact: string) {
  const folder = mkdtempSync(join(tmpdir(), 'waha-arabic-roundtrip-'));
  const file = join(folder, 'arabic.pdf'); writeFileSync(file, pdf);
  try {
    const script = `import {readFileSync} from 'node:fs';import {PDFParse} from 'pdf-parse';const p=new PDFParse({data:new Uint8Array(readFileSync(process.argv[1])),verbosity:0});try{console.log(JSON.stringify((await p.getText()).text))}finally{await p.destroy()}`;
    const extracted: string = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script, file], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
    if (process.env.WAHA_QA_ARTIFACT_DIR) {
      mkdirSync(process.env.WAHA_QA_ARTIFACT_DIR, { recursive: true });
      writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, `${artifact}.pdf`), pdf);
      writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, `${artifact}.txt`), extracted);
    }
    return extracted.replace(/[\u200b\u200e]/gu, '').replace(/\s+/gu, ' ');
  } finally { rmSync(folder, { recursive: true, force: true }); }
}

test('Arabic PDF text retains dotted letters, ligatures and mixed research numbers when extracted', async () => {
  const paragraphs = [
    'ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي',
    'الواحة تشير إلى دراسة بحثية ومناقشة النتائج ومراجعة الاستشهادات.',
    'هذه بيانات حقيقية وليست كلمات بديلة؛ لا توجد نتيجة بلا دليل.',
    'العينة n ≥ 278 من المجتمع N = 1000؛ النسبة 70%، والمرجع Smith (2024).',
    'أ إ آ ؤ ئ ة ى لا لأ لإ لآ',
  ];
  const pdf = await buildProjectPdf({ language: 'ar', title: 'اختبار النص العربي', notice: 'نموذج معلن لاختبار التصدير', sections: [{ title: 'فحص الحروف', paragraphs }] });
  const text = await extract(pdf, 'arabic-copy');
  for (const phrase of ['الواحة تشير إلى دراسة بحثية', 'مناقشة', 'النتائج', 'الاستشهادات', 'حقيقية', 'بديلة', 'دليل', 'أ إ آ ؤ ئ ة ى', 'لا لأ لإ لآ', 'العينة n ≥ 278 من المجتمع N = 1000', '70%', 'Smith', '2024']) expect(text).toContain(phrase);
}, 30_000);

test('rich paragraphs and table cells retain Arabic text and percentage tokens', async () => {
  const pdf = await buildProjectPdf({ language: 'en', documentDirection: 'rtl', title: 'Arabic rich-text QA', notice: 'Declared QA fixture.', sections: [{ title: 'مسودة وجدول', paragraphs: [], blocks: [
    { kind: 'paragraph', indent: 0, quote: false, start: 0, end: 38, runs: [{ text: 'الواحة ', marks: ['bold'] }, { text: 'تشير إلى دراسة بحثية بنسبة ٧٠٪.', marks: ['italic'] }] },
    { kind: 'paragraph', indent: 0, quote: false, start: 38, end: 44, runs: [{ text: 'النتيجة' }], table: { id: 1, row: 0, column: 0, header: true } },
    { kind: 'paragraph', indent: 0, quote: false, start: 44, end: 80, runs: [{ text: 'مناقشة الاستشهادات 70% وأسماء الباحثين' }], table: { id: 1, row: 1, column: 0, header: false } },
  ] }] });
  const text = await extract(pdf, 'arabic-copy-rich');
  for (const phrase of ['الواحة تشير إلى دراسة بحثية بنسبة ٧٠٪', 'النتيجة', 'مناقشة', 'الاستشهادات', '70%', 'الباحثين']) expect(text).toContain(phrase);
}, 30_000);
