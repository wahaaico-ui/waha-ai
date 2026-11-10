import { extractAcademicStyleProfile } from '@/lib/academic-style-profile';
import { buildProjectDocx } from '@/lib/project-document-export';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('extracts only explicit guide rules with their supporting line', () => {
  const profile = extractAcademicStyleProfile([
    'University: Example University',
    'Arabic font: Simplified Arabic',
    'Arabic body font size: 14 pt',
    'English font: Times New Roman',
    'Line spacing: 1.5',
    'Top margin: 2.5 cm',
    'Citation style: APA 7',
  ].join('\n'));
  expect(profile.university_or_journal_name?.value).toBe('Example University');
  expect(profile.language_rules.arabic_font_size_body).toEqual({ value: 14, evidence: 'Arabic body font size: 14 pt' });
  expect(profile.language_rules.line_spacing?.value).toBe(1.5);
  expect(profile.page_layout.margin_top?.value).toBe(2.5);
  expect(profile.citation_style.system?.value).toBe('APA 7');
  expect(profile.page_layout.margin_bottom).toBeNull();
});

test('does not infer rules from generic mentions or implausible values', () => {
  const profile = extractAcademicStyleProfile('This university discusses APA generally.\nTop margin: 90 cm\nEnglish body font size: 99 pt');
  expect(profile.citation_style.system).toBeNull();
  expect(profile.page_layout.margin_top).toBeNull();
  expect(profile.language_rules.english_font_size_body).toBeNull();
});

test('reviewed explicit guide rules change actual Word font, spacing and page margins', async () => {
  const profile = extractAcademicStyleProfile('Arabic font: Simplified Arabic\nArabic body font size: 14 pt\nLine spacing: 2\nTop margin: 3 cm\nBinding margin: 3.5 cm');
  const dir = mkdtempSync(join(tmpdir(), 'waha-style-'));
  try {
    const file = join(dir, 'project.docx');
    writeFileSync(file, await buildProjectDocx({ title: 'عنوان المشروع', notice: 'نص عربي', language: 'ar', styleProfile: profile, sections: [] }));
    const document = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
    expect(document).toContain('Simplified Arabic');
    expect(document).toMatch(/w:sz w:val="28"/u);
    expect(document).toMatch(/w:line="480"/u);
    expect(document).toMatch(/w:top="1701"/u);
    expect(document).toMatch(/w:right="1985"/u);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('APA 7 Word tables omit vertical borders and mark the header separator', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'waha-apa-table-'));
  try {
    const file = join(dir, 'project.docx');
    writeFileSync(file, await buildProjectDocx({ title: 'Project', notice: 'Draft', language: 'en', citationStyle: 'apa-7', sections: [{ title: 'Table 1', paragraphs: [], blocks: [
      { kind: 'paragraph', runs: [{ text: 'Column' }], indent: 0, quote: false, start: 0, end: 6, table: { id: 1, row: 0, column: 0, header: true } },
      { kind: 'paragraph', runs: [{ text: 'Value' }], indent: 0, quote: false, start: 6, end: 11, table: { id: 1, row: 1, column: 0, header: false } },
    ] }] }));
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
    expect(xml).toMatch(/<w:insideV w:val="nil"/u);
    expect(xml).toMatch(/<w:bottom w:val="single"/u);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Lines as the text layer of two public university guides returns them
// (Mutah University 2025; Boise State University). Real guides state rules in
// sentences, often across two lines, and in inches; the Arabic layer can split
// lam-alef ("اإلنجليزية").
const ARABIC_GUIDE = [
  'الخط :',
  '1 . يكون حجم الخط في الرسائل باللغة العربية ( 16 Simplified Arabic ) في جميع',
  'التخصصات، وتكون العناوين بنفس الخط ولكن بخط غامق.',
  '3 . يكون الخط في الرسائل باللغة اإلنجليزية ( Times New Roman ) بحجم ( 14 )',
  '4 . يستخدم حجم الخط ( 14 ) في اللغة العربية و ( 12 ) في اللغة النجليزية عند كتابة',
  'الحواشي.',
  'المسافة بين السطور :',
  'جميع التخصصا ت مسافة واحدة (مفرد).',
  '1 . اللغة العربية تكون األبعاد 2.5 سم من جميع الجهات باستثناء الجهة اليمنى فتكون',
  '3.5 سم .',
  '1 . إن التوثيق المعتمد لدى كلية اساتالدر العليا هو نظام جمعية علم النفس المريكية',
  'APA في كل الرسائل باستثناء رسائل الحقوق والتاريخ واللغة العربية والشريعة فيعتمد',
].join('\n');
const ENGLISH_GUIDE = [
  'The font used must be a serif font and 12 pt. size. (Times New Roman is preferred)',
  'a) Mirror margins must be used and the Inside margin must be 1.5 inches (for binding purposes)',
  'b) Right and bottom margins must be 1 inch',
  'c) Top margin must be 1 inch unless it precedes a major heading (all Heading1s) in which case it will be 2 inches',
  'The document text and spaces between paragraphs must be double spaced. First lines of each paragraph need to be indented.',
].join('\n');

test('reads rules written as sentences in a real Arabic guide, keeping the source phrase', () => {
  const p = extractAcademicStyleProfile(ARABIC_GUIDE);
  expect(p.language_rules.arabic_font_family?.value).toBe('Simplified Arabic');
  expect(p.language_rules.arabic_font_size_body).toEqual({ value: 16, evidence: '1 . يكون حجم الخط في الرسائل باللغة العربية ( 16 Simplified Arabic ) في جميع' });
  expect(p.language_rules.english_font_family?.value).toBe('Times New Roman');
  expect(p.language_rules.english_font_size_body?.value).toBe(14);
  expect(p.page_layout.margin_top?.value).toBe(2.5);
  expect(p.page_layout.margin_bottom?.value).toBe(2.5);
  expect(p.page_layout.margin_other_side?.value).toBe(2.5);
  expect(p.page_layout.margin_binding_side).toEqual({ value: 3.5, evidence: '1 . اللغة العربية تكون األبعاد 2.5 سم من جميع الجهات باستثناء الجهة اليمنى فتكون 3.5 سم .' });
  expect(p.citation_style.system?.value).toBe('APA 7');
  // Single spacing there is for headings and tables, not the body text.
  expect(p.language_rules.line_spacing).toBeNull();
});

test('reads rules written as sentences in a real English guide and converts inches to centimetres', () => {
  const p = extractAcademicStyleProfile(ENGLISH_GUIDE);
  expect(p.language_rules.english_font_family?.value).toBe('Times New Roman');
  expect(p.language_rules.english_font_size_body).toEqual({ value: 12, evidence: 'The font used must be a serif font and 12 pt. size. (Times New Roman is preferred)' });
  expect(p.page_layout.margin_binding_side?.value).toBe(3.81);
  expect(p.page_layout.margin_other_side?.value).toBe(2.54);
  expect(p.page_layout.margin_bottom?.value).toBe(2.54);
  expect(p.page_layout.margin_top?.value).toBe(2.54);
  expect(p.language_rules.line_spacing?.value).toBe(2);
  expect(p.language_rules.arabic_font_family).toBeNull();
  expect(p.citation_style.system).toBeNull();
});

test('does not take footnote, caption or table sizes as the body font size', () => {
  const p = extractAcademicStyleProfile('Footnotes use Times New Roman 10 pt.\nTable captions must be 9 pt.');
  expect(p.language_rules.english_font_size_body).toBeNull();
  expect(p.language_rules.english_font_family).toBeNull();
});

describe('document limits and page numbering', () => {
  const ARABIC = [
    'عدد الكلمات :',
    '1 . يجب ألا يزيد عدد كلمات الرسالة عن ( 40000 ) كلمة باستثناء الملاحق.',
    '2 . لا يتجاوز الملخص 300 كلمة باللغة العربية.',
    'ترقيم الصفحات :',
    'يكون ترقيم الصفحات في أسفل الصفحة في المنتصف.',
  ].join('\n');
  const ENGLISH = [
    'The thesis must not exceed 80,000 words, excluding references and appendices.',
    'The abstract should be no more than 350 words.',
    'Page numbers must be placed at the bottom right of each page.',
  ].join('\n');

  test('reads word limits and the page number position from an Arabic guide with their source lines', () => {
    const p = extractAcademicStyleProfile(ARABIC);
    expect(p.document_rules.max_words).toEqual({ value: 40000, evidence: '1 . يجب ألا يزيد عدد كلمات الرسالة عن ( 40000 ) كلمة باستثناء الملاحق.' });
    expect(p.document_rules.abstract_max_words).toEqual({ value: 300, evidence: '2 . لا يتجاوز الملخص 300 كلمة باللغة العربية.' });
    expect(p.document_rules.page_numbering).toEqual({ value: 'bottom-center', evidence: 'يكون ترقيم الصفحات في أسفل الصفحة في المنتصف.' });
  });

  test('reads the same rules from an English guide', () => {
    const p = extractAcademicStyleProfile(ENGLISH);
    expect(p.document_rules.max_words?.value).toBe(80000);
    expect(p.document_rules.abstract_max_words?.value).toBe(350);
    expect(p.document_rules.page_numbering?.value).toBe('bottom-right');
  });

  test('never takes the abstract limit as the thesis limit, and guesses nothing that is not stated', () => {
    const p = extractAcademicStyleProfile('لا يتجاوز الملخص 250 كلمة.\nتُرقّم الصفحات.');
    expect(p.document_rules.max_words).toBeNull();
    expect(p.document_rules.abstract_max_words?.value).toBe(250);
    expect(p.document_rules.page_numbering).toBeNull();
  });
});

test('an approved page number position moves the Word page number', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'waha-numbering-'));
  const docx = async (guide: string) => {
    const file = join(dir, `${Math.random()}.docx`);
    writeFileSync(file, await buildProjectDocx({ title: 'عنوان', notice: 'نص', language: 'ar', styleProfile: extractAcademicStyleProfile(guide), sections: [] }));
    const parts = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' });
    const read = (name: string) => execFileSync('unzip', ['-p', file, name], { encoding: 'utf8' });
    return { parts, read };
  };
  try {
    const top = await docx('Page numbers must be placed at the top right of each page.');
    expect(top.parts).toMatch(/word\/header\d*\.xml/u);
    const header = top.parts.split('\n').find(name => /word\/header\d*\.xml/u.test(name))!;
    expect(top.read(header)).toMatch(/<w:jc w:val="(?:right|end)"\/>/u);
    expect(top.read(header)).toContain('PAGE');

    const fallback = await docx('Arabic font: Simplified Arabic');
    const footer = fallback.parts.split('\n').find(name => /word\/footer\d*\.xml/u.test(name))!;
    expect(fallback.read(footer)).toMatch(/<w:jc w:val="center"\/>/u);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
