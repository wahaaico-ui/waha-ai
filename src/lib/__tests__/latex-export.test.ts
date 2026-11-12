import { buildProjectLatex, latexText } from '@/lib/latex-export';
import type { WritingRenderBlock } from '@/lib/writing-rich-text';

describe('LaTeX text is data, never commands (DOC-40-03)', () => {
  test('every special character is escaped, so typed commands cannot run', () => {
    expect(latexText('\\input{/etc/passwd} \\write18{rm -rf /} $x$ 50% #1 a_b ^ ~ & {}', 'en'))
      .toBe('\\textbackslash{}input\\{/etc/passwd\\} \\textbackslash{}write18\\{rm -rf /\\} \\$x\\$ 50\\% \\#1 a\\_b \\textasciicircum{} \\textasciitilde{} \\& \\{\\}');
  });

  test('control characters are dropped and line breaks stay inside the paragraph', () => {
    expect(latexText('a\u0000b\u001fc\nd', 'en')).toBe('abc\\\\\nd');
  });

  test('Latin words inside Arabic text are marked as English so they read left to right', () => {
    expect(latexText('دراسة على 80 طالبًا في BMC Nursing.', 'ar')).toBe('دراسة على 80 طالبًا في \\textenglish{BMC Nursing}.');
  });

  test('a citation or an English reference stays one piece with its punctuation and numbers', () => {
    expect(latexText('وفق APA 7 (Smith & Jones, 2020).', 'ar')).toBe('وفق \\textenglish{APA 7 (Smith \\& Jones, 2020)}.');
    expect(latexText('Smith, J. (2020). Simulation. https://doi.org/10.1/a_b', 'ar')).toBe('\\textenglish{Smith, J. (2020). Simulation. https://doi.org/10.1/a\\_b}');
    expect(latexText('عام 2025، بنسبة 95%', 'ar')).toBe('عام 2025، بنسبة 95\\%');
    expect(latexText('A sample (عينة واحدة) here.', 'en')).toBe('A sample \\textarabic{(عينة واحدة)} here.');
  });
});

const run = (text: string, marks?: Array<'bold' | 'italic' | 'underline' | 'strike'>) => ({ text, ...(marks ? { marks } : {}) });
const block = (part: Partial<WritingRenderBlock>): WritingRenderBlock => ({ kind: 'paragraph', indent: 0, quote: false, start: 0, end: 0, runs: [], ...part });

describe('a project as a LaTeX file', () => {
  const model = {
    language: 'ar' as const, documentDirection: 'rtl' as const, title: 'أثر المحاكاة', notice: 'ملف من الواحة',
    sections: [
      { title: 'المشكلة', paragraphs: ['ضعف المهارات.', 'سطر ثانٍ'] },
      { title: 'المسودة', paragraphs: [], blocks: [
        block({ kind: 'heading', level: 2, runs: [run('الإطار النظري')] }),
        block({ runs: [run('نص '), run('عريض', ['bold']), run(' و'), run('مائل', ['italic'])] }),
        block({ quote: true, runs: [run('اقتباس')] }),
        block({ runs: [run('العمود')], table: { id: 1, row: 0, column: 0, header: true } }),
        block({ runs: [run('القيمة')], table: { id: 1, row: 0, column: 1, header: true } }),
        block({ runs: [run('العينة')], table: { id: 1, row: 1, column: 0, header: false } }),
        block({ runs: [run('80')], table: { id: 1, row: 1, column: 1, header: false } }),
      ] },
    ],
  };
  const tex = buildProjectLatex(model);

  test('an Arabic project compiles with XeLaTeX in Arabic with a free Arabic font', () => {
    expect(tex).toMatch(/^% /);
    expect(tex).toContain('\\documentclass[12pt,a4paper]{article}');
    expect(tex).toContain('\\setmainlanguage{arabic}');
    expect(tex).toContain('\\newfontfamily\\arabicfont[Script=Arabic]{Amiri}');
    expect(tex).toContain('\\title{أثر المحاكاة}');
    expect(tex.trimEnd().endsWith('\\end{document}')).toBe(true);
  });

  test('sections, headings, marks, quotes and tables keep their structure', () => {
    expect(tex).toContain('\\section*{المشكلة}\n\nضعف المهارات.\n\nسطر ثانٍ');
    expect(tex).toContain('\\subsection*{الإطار النظري}');
    expect(tex).toContain('نص \\textbf{عريض} و\\textit{مائل}');
    expect(tex).toContain('\\begin{quote}\nاقتباس\n\\end{quote}');
    expect(tex).toContain('\\begin{tabular}{|p{0.45\\linewidth}|p{0.45\\linewidth}|}');
    expect(tex).toContain('\\textbf{العمود} & \\textbf{القيمة} \\\\ \\hline');
    expect(tex).toContain('العينة & 80 \\\\ \\hline');
  });

  test('an English project uses English as the main language', () => {
    const english = buildProjectLatex({ ...model, language: 'en', documentDirection: 'ltr', title: 'Simulation', sections: [{ title: 'Problem', paragraphs: ['Text'] }] });
    expect(english).toContain('\\setmainlanguage{english}');
    expect(english).not.toContain('\\setmainlanguage{arabic}');
  });
});

// The LaTeX workflow sets LATEX_SAMPLE_DIR and compiles these files with XeLaTeX.
const sampleDir = process.env.LATEX_SAMPLE_DIR;
(sampleDir ? test : test.skip)('writes sample files for the XeLaTeX compile check', async () => {
  const { mkdirSync, writeFileSync } = await import('fs');
  mkdirSync(sampleDir!, { recursive: true });
  const blocks = [
    block({ kind: 'heading', level: 2, runs: [run('الإطار النظري والمنهج')] }),
    block({ runs: [run('أُجريت دراسة شبه تجريبية على 80 طالبًا في BMC Nursing عام 2025، '), run('بنسبة 95%', ['bold']), run(' وفق APA 7 (Smith & Jones, 2020).')] }),
    block({ prefix: '1. ', runs: [run('المحاكاة عالية الدقة'), run(' high-fidelity', ['italic'])] }),
    block({ quote: true, runs: [run('«التعلم بالممارسة أبقى أثرًا»')] }),
    block({ runs: [run('المجموعة')], table: { id: 1, row: 0, column: 0, header: true } }),
    block({ runs: [run('المتوسط')], table: { id: 1, row: 0, column: 1, header: true } }),
    block({ runs: [run('التجريبية')], table: { id: 1, row: 1, column: 0, header: false } }),
    block({ runs: [run('4.2')], table: { id: 1, row: 1, column: 1, header: false } }),
  ];
  const sections = [{ title: 'المسودة', paragraphs: [], blocks }, { title: 'المراجع', paragraphs: ['Smith, J., & Jones, K. (2020). Simulation in nursing. Nurse Education Today, 85, 104-110. https://doi.org/10.1016/j.nedt.2020.104_1', 'عبدالله، م. (2019). التعليم بالمحاكاة. مجلة التمريض العربية، 3(2)، 10–20.'] },
    { title: 'نص كتبه المستخدم', paragraphs: ['\\input{/etc/passwd} \\write18{ls} $\\alpha$ # % ^ ~ _ { }'] }];
  writeFileSync(`${sampleDir}/sample-ar.tex`, buildProjectLatex({ language: 'ar', documentDirection: 'rtl', title: 'أثر المحاكاة في تعليم التمريض', notice: 'ملف من الواحة', sections }));
  writeFileSync(`${sampleDir}/sample-en.tex`, buildProjectLatex({ language: 'en', documentDirection: 'ltr', title: 'Simulation in Nursing Education', notice: 'Exported from WAHA', sections: [{ title: 'Draft', paragraphs: ['A study of 80 students (عينة من جامعة واحدة) at 95% confidence.'] }] }));
});
