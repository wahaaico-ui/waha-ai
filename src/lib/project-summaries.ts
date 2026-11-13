/**
 * Two summaries of a finished project (DOC-39-04): a formal one for a journal
 * and one for a decision maker. Both are assembled from the project's saved
 * and approved stage outputs, word for word. Nothing is generated, so neither
 * can add a result or a recommendation the project does not contain. What a
 * summary cannot show yet is listed as missing.
 */
import { translateUiText, type UiLanguage } from '@/lib/i18n/ui-text';
import { countWords, stageText, type JournalTemplate } from '@/lib/journal-template';
import type { ProjectExportModel } from '@/lib/project-export';
import { RECOMMENDATION_HORIZON_LABELS, isRecommendationHorizon } from '@/lib/research-recommendations';

/** Text with numbered slots; string values are labels the page translates, numbers are measured. */
export type SummaryText = { text: string; values?: Array<string | number> };
export type SummaryCheck = SummaryText & { state: 'met' | 'attention' };
export type SummarySection = { heading: string; text: string };
export type ProjectSummary = {
  kind: 'journal' | 'decision';
  title: string | null;
  target: string | null;
  sections: SummarySection[];
  checks: SummaryCheck[];
  missing: SummaryText[];
};

type Outputs = Partial<Record<string, unknown>>;
type RecordValue = Record<string, unknown>;

const record = (value: unknown): RecordValue => (value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {});
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const records = (value: unknown) => (Array.isArray(value) ? value.map(record) : []);
const joined = (...values: unknown[]) => values.map(text).filter(Boolean).join('\n');
const say = (message: string, values?: Array<string | number>): SummaryText => (values ? { text: message, values } : { text: message });

/** The structured-abstract headings, in the order journals ask for them. */
const ABSTRACT_PARTS = [
  ['background', 'الخلفية'], ['objective', 'الهدف'], ['methods', 'المنهج'], ['results', 'النتائج'], ['conclusion', 'الخاتمة'],
] as const;

function titleOf(outputs: Outputs) {
  return text(record(outputs.publication).approvedTitle) || text(record(outputs.title).title) || null;
}

export function journalSummary(outputs: Outputs, template: JournalTemplate | null): ProjectSummary {
  const publication = record(outputs.publication);
  const abstract = record(publication.structuredAbstract);
  const keywords = Array.isArray(publication.keywords) ? publication.keywords.map(text).filter(Boolean) : [];
  const summary: ProjectSummary = { kind: 'journal', title: titleOf(outputs), target: text(publication.targetName) || null, sections: [], checks: [], missing: [] };
  if (!Object.keys(publication).length) {
    summary.missing.push(say('لم تُحفظ مرحلة «جاهزية النشر» بعد؛ منها يُؤخذ الملخص المهيكل والكلمات المفتاحية.'));
    return summary;
  }

  for (const [key, heading] of ABSTRACT_PARTS) {
    const part = text(abstract[key]);
    if (part) summary.sections.push({ heading, text: part });
    else summary.missing.push(say('الجزء «{0}» من الملخص المهيكل فارغ في مرحلة «جاهزية النشر».', [heading]));
  }
  if (keywords.length) summary.sections.push({ heading: 'الكلمات المفتاحية', text: keywords.join('; ') });
  else summary.missing.push(say('لا توجد كلمات مفتاحية في مرحلة «جاهزية النشر».'));

  if (!template) {
    summary.missing.push(say('لم يُحفظ قالب المجلة بعد، فلم تُقارن حدود الملخص والكلمات المفتاحية.'));
    return summary;
  }
  const words = countWords(stageText(abstract));
  if (template.abstractMaxWords !== null && words) {
    summary.checks.push({ ...say('الملخص {0} كلمات، وحد المجلة {1} كلمة.', [words, template.abstractMaxWords]), state: words <= template.abstractMaxWords ? 'met' : 'attention' });
  }
  if (keywords.length && template.keywordsMin !== null && template.keywordsMax !== null) {
    const fits = keywords.length >= template.keywordsMin && keywords.length <= template.keywordsMax;
    summary.checks.push({ ...say('الكلمات المفتاحية {0}، والمطلوب من {1} إلى {2}.', [keywords.length, template.keywordsMin, template.keywordsMax]), state: fits ? 'met' : 'attention' });
  }
  return summary;
}

export function decisionSummary(outputs: Outputs): ProjectSummary {
  const results = record(outputs.results);
  const conclusions = record(outputs.conclusions);
  const summary: ProjectSummary = { kind: 'decision', title: titleOf(outputs), target: null, sections: [], checks: [], missing: [] };
  const add = (heading: string, value: string, missing: SummaryText) => {
    if (value) summary.sections.push({ heading, text: value });
    else summary.missing.push(missing);
  };

  add('المشكلة', text(record(outputs.problem).problemStatement), say('لم تُحفظ مشكلة البحث بعد في مرحلة «مشكلة البحث والفجوة».'));
  add('ما توصلت إليه الدراسة',
    joined(results.overallSummary, ...records(conclusions.conclusions).map(item => item.conclusionStatement)),
    say('لا توجد نتائج أو استنتاجات معتمدة بعد في مرحلتي «النتائج» و«الاستنتاجات».'));
  // Only recommendations meant for practice or policy concern a decision maker; research ones stay out.
  const forDecision = records(record(outputs.recommendations).recommendations)
    .filter(item => item.recommendationType === 'practice' || item.recommendationType === 'policy')
    .map(item => [text(item.recommendationText), text(item.targetAudience), isRecommendationHorizon(item.implementationHorizon) ? RECOMMENDATION_HORIZON_LABELS[item.implementationHorizon] : '']
      .filter(Boolean).join(' — '))
    .filter(Boolean);
  add('ما يعنيه للقرار', forDecision.join('\n'), say('لا توجد توصيات للممارسة أو السياسة في مرحلة «التوصيات».'));
  add('حدود النتائج', joined(results.limitations, conclusions.scopeStatement),
    say('لم تُذكر حدود النتائج في مرحلتي «النتائج» و«الاستنتاجات»؛ لا يُسلَّم ملخص القرار دونها.'));
  return summary;
}

/**
 * Whether the summary can be handed over as a file: a journal summary needs its
 * abstract; a decision summary needs both what was found and the limits of it.
 */
export function summaryReady(summary: ProjectSummary) {
  const headings = new Set(summary.sections.map(section => section.heading));
  return summary.kind === 'journal'
    ? ABSTRACT_PARTS.some(([, heading]) => headings.has(heading))
    : headings.has('ما توصلت إليه الدراسة') && headings.has('حدود النتائج');
}

/** The summary as a Word or PDF file, with its checks and what it still lacks. */
export function summaryExportModel(summary: ProjectSummary, language: UiLanguage = 'ar'): ProjectExportModel {
  const ui = (message: string, values?: readonly unknown[]) => translateUiText(message, language, values);
  const line = (item: SummaryText) => ui(item.text, (item.values ?? []).map(value => (typeof value === 'string' ? ui(value) : value)));
  const sections: ProjectExportModel['sections'] = summary.sections.map(section => ({ title: ui(section.heading), paragraphs: section.text.split('\n') }));
  if (summary.checks.length) sections.push({ title: ui('مطابقة قالب المجلة'), paragraphs: summary.checks.map(line) });
  if (summary.missing.length) sections.push({ title: ui('ما ينقص هذا الملخص'), paragraphs: summary.missing.map(line) });
  return {
    language,
    documentDirection: language === 'en' ? 'ltr' : 'rtl',
    title: ui(summary.kind === 'journal' ? 'ملخص رسمي للمجلة' : 'ملخص لصانع القرار'),
    notice: [
      summary.title,
      summary.target ? ui('المجلة المستهدفة: {0}', [summary.target]) : '',
      ui('منقول من مخرجات المشروع المعتمدة كما هي؛ لا يضيف نتيجة أو توصية ليست فيها.'),
    ].filter(Boolean).join('\n'),
    sections,
  };
}
