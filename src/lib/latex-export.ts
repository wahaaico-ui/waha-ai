/**
 * The project as a LaTeX source file (DOC-40-03), for XeLaTeX with polyglossia
 * so Arabic and English mix correctly. Every piece of text is escaped: what a
 * researcher typed is printed, never run as a command.
 */
import type { UiLanguage } from '@/lib/i18n/ui-text';
import type { ProjectExportModel } from '@/lib/project-export';
import { groupWritingRenderBlocks, type WritingRenderBlock, type WritingRenderTable, type WritingTextRun } from '@/lib/writing-rich-text';

const SPECIAL: Record<string, string> = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
  '%': '\\%', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
};
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f]/g;
/** A run of Latin words inside Arabic text, or of Arabic words inside English text. */
const OTHER_SCRIPT = {
  ar: /[A-Za-z][A-Za-z0-9'’-]*(?:[ ]+[A-Za-z0-9][A-Za-z0-9'’-]*)*/g,
  en: /[\u0600-\u06FF][\u0600-\u06FF\u064B-\u065F0-9]*(?:[ ]+[\u0600-\u06FF0-9][\u0600-\u06FF\u064B-\u065F0-9]*)*/g,
} as const;

const escape = (text: string) => text.replace(/[\\{}$&#%_^~]/g, char => SPECIAL[char]);

/** Plain text as LaTeX: escaped, with words in the other script marked so they read in their own direction. */
export function latexText(text: string, language: UiLanguage): string {
  const clean = text.replace(CONTROL, '');
  const wrap = language === 'ar' ? '\\textenglish' : '\\textarabic';
  let result = '', last = 0;
  for (const match of clean.matchAll(OTHER_SCRIPT[language])) {
    result += escape(clean.slice(last, match.index)) + `${wrap}{${escape(match[0])}}`;
    last = match.index! + match[0].length;
  }
  return (result + escape(clean.slice(last))).replace(/\r?\n/g, '\\\\\n');
}

const MARK_COMMANDS = { bold: '\\textbf', italic: '\\textit', underline: '\\underline', strike: '\\sout' } as const;

function runsLatex(runs: WritingTextRun[], language: UiLanguage) {
  return runs.map(run => (run.marks ?? []).reduce((text, mark) => `${MARK_COMMANDS[mark]}{${text}}`, latexText(run.text, language))).join('');
}

function blockLatex(block: WritingRenderBlock, language: UiLanguage) {
  const text = latexText(block.prefix ?? '', language) + runsLatex(block.runs, language);
  if (block.kind === 'heading') return `${(block.level ?? 2) <= 2 ? '\\subsection*' : '\\subsubsection*'}{${text}}`;
  return block.quote ? `\\begin{quote}\n${text}\n\\end{quote}` : text;
}

function tableLatex(table: WritingRenderTable, language: UiLanguage) {
  const columns = Math.max(...table.rows.map(row => row.cells.length));
  const width = (0.9 / columns).toFixed(2);
  const rows = table.rows.map(row => `${row.cells.map(cell => {
    const text = cell.blocks.map(block => runsLatex(block.runs, language)).join('\\newline ');
    return cell.header ? `\\textbf{${text}}` : text;
  }).join(' & ')} \\\\ \\hline`);
  return [`\\begin{tabular}{|${Array(columns).fill(`p{${width}\\linewidth}`).join('|')}|}`, '\\hline', ...rows, '\\end{tabular}'].join('\n');
}

export function buildProjectLatex(model: ProjectExportModel): string {
  const language: UiLanguage = model.language === 'en' ? 'en' : 'ar';
  const [main, other] = language === 'ar' ? ['arabic', 'english'] : ['english', 'arabic'];
  const body = model.sections.flatMap(section => [
    `\\section*{${latexText(section.title, language)}}`,
    ...(section.blocks
      ? groupWritingRenderBlocks(section.blocks).map(item => (item.kind === 'table' ? tableLatex(item, language) : blockLatex(item, language)))
      : section.paragraphs.map(paragraph => latexText(paragraph, language))),
  ]);
  return [
    '% WAHA project export. Compile with XeLaTeX (on Overleaf: Menu, Compiler, XeLaTeX).',
    '% Arabic text uses the free Amiri font, included in TeX Live and on Overleaf.',
    '\\documentclass[12pt,a4paper]{article}',
    '\\usepackage[margin=2.5cm]{geometry}',
    '\\usepackage{fontspec}',
    '\\usepackage[normalem]{ulem}',
    '\\usepackage{polyglossia}',
    `\\setmainlanguage{${main}}`,
    `\\setotherlanguage{${other}}`,
    '\\newfontfamily\\arabicfont[Script=Arabic]{Amiri}',
    `\\title{${latexText(model.title, language)}}`,
    '\\author{}',
    '\\date{}',
    '\\begin{document}',
    '\\maketitle',
  ].join('\n') + '\n\n' + [latexText(model.notice, language), ...body].join('\n\n') + '\n\n\\end{document}\n';
}
