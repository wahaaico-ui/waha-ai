import { translateUiText, type UiLanguage } from '@/lib/i18n/ui-text';
import type { ProjectExportModel } from '@/lib/project-export';
import type { ResearchAnalysis } from '@/lib/research-analysis';
import type { LanguageTask } from '@/lib/language-task';
import { writingBlocksMarkdown } from '@/lib/writing-markdown';

export const TASK_NOTICE = 'مسودة محفوظة للمراجعة، وليست اعتمادًا علميًا أو مخطوطًا جاهزًا للنشر.';

export function synthesisExportModel(title: string, analysis: ResearchAnalysis, sources: Array<{ id: string; title: string; authors?: string; year?: number | string; doi?: string | null }>, language: UiLanguage = 'ar'): ProjectExportModel {
  const ui = (message: string) => translateUiText(message, language);
  const sourceById = new Map(sources.map((source, index) => [source.id, { ...source, number: index + 1 }]));
  return { language, title, notice: ui(TASK_NOTICE), sections: [
    { title: ui('التأطير'), paragraphs: [analysis.introduction] },
    { title: ui('تخليق المستخلصات'), paragraphs: [analysis.thematicSynthesis] },
    ...analysis.themes.map((theme) => ({ title: theme.title, paragraphs: [theme.synthesis, ...theme.supportingPaperIds.map((id) => { const source = sourceById.get(id); if (!source) throw new Error('Unknown synthesis citation'); return `[${source.number}] ${source.title}`; })] })),
    { title: ui('الفجوات المحتملة'), paragraphs: analysis.researchGapsIdentified.length ? analysis.researchGapsIdentified : [ui('لا تكفي المصادر لتحديد فجوة.')] },
    { title: ui('الخلاصة'), paragraphs: [analysis.conclusion] },
    { title: ui('حدود المخرج'), paragraphs: [...analysis.limitations, ui('المخرج مبني على المستخلصات المتاحة، وليس قراءة للنصوص الكاملة.')] },
    { title: ui('الدراسات المستخدمة'), paragraphs: sources.map((source, index) => `[${index + 1}] ${source.title}${source.authors ? ` — ${source.authors}` : ''}${source.year ? ` (${source.year})` : ''}${source.doi ? ` DOI: ${source.doi}` : ''}`) },
  ] };
}

export function languageExportModel(task: LanguageTask, language: UiLanguage = 'ar'): ProjectExportModel {
  const ui = (message: string) => translateUiText(message, language);
  if (task.status !== 'completed' || !task.output.trim()) throw new Error('Task has no saved output');
  return { language, title: ui(task.operation === 'translate' ? 'ترجمة أكاديمية' : 'مراجعة لغوية'), notice: ui(TASK_NOTICE), sections: [
    { title: ui('المدخل الأصلي'), paragraphs: [task.text] },
    { title: translateUiText('النتيجة ({0})', language, [ui(task.targetLanguage === 'ar' ? 'العربية' : 'الإنجليزية')]), paragraphs: [task.output] },
    { title: ui('حدود المخرج'), paragraphs: [ui('راجع المعنى والمصطلحات والأرقام والإحالات؛ المراجعة اللغوية لا تتحقق من صحة الادعاءات.')] },
  ] };
}

export function taskMarkdown(model: ProjectExportModel) {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [`# ${escape(model.title)}`, escape(model.notice), ...model.sections.flatMap((section) => [`\n## ${escape(section.title)}`, ...(section.blocks ? writingBlocksMarkdown(section.blocks) : section.paragraphs.map(escape))])].join('\n\n');
}
