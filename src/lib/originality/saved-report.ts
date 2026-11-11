import { RESEARCH_SOURCE_REGISTRY } from '@/lib/academic/ResearchSourceRegistry';
import { translateUiText, type UiLanguage } from '@/lib/i18n/ui-text';
import type { ProjectExportModel } from '@/lib/project-export';
import { ORIGIN_LABELS, type OriginalityReport } from '@/lib/originality/report';
import { SHINGLE_SIZE } from '@/lib/originality/text-match';

/**
 * A `journey:` type that is not a workflow stage: the journey, the dashboard
 * and the full project export read only stage types, so they skip it.
 */
export const ORIGINALITY_DOCUMENT_TYPE = 'journey:originality_report';

/** One similarity check as saved for download; never edited after it is written. */
export type SavedOriginalityReport = {
  version: 1;
  input: 'draft' | 'text';
  /** When the checked evidence-writing draft was saved; null for pasted text. */
  draftSavedAt: string | null;
  report: OriginalityReport;
};

type Value = Record<string, unknown>;
const isRecord = (value: unknown): value is Value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const isText = (value: unknown): value is string => typeof value === 'string';
const isOptionalText = (value: unknown) => value === null || isText(value);
const isOptionalYear = (value: unknown) => value === null || Number.isInteger(value);
const isTime = (value: unknown): value is string => isText(value) && !Number.isNaN(Date.parse(value));
const isOrigin = (value: unknown) => isText(value) && Object.hasOwn(ORIGIN_LABELS, value);
const listOf = (value: unknown, check: (item: unknown) => boolean) => Array.isArray(value) && value.every(check);

const isMatch = (value: unknown) => isRecord(value) && isText(value.sourceId) && isOrigin(value.origin) && isText(value.title)
  && isOptionalText(value.url) && isOptionalYear(value.year) && typeof value.cited === 'boolean' && isCount(value.sourceNumber);
const isPassage = (value: unknown) => isRecord(value) && isText(value.text) && listOf(value.matches, isMatch)
  && [value.start, value.end, value.wordCount, value.paragraph, value.firstWord, value.lastWord].every(isCount);
const isCheckedSource = (value: unknown) => isRecord(value) && isCount(value.number) && isOrigin(value.origin) && isText(value.title)
  && isOptionalYear(value.year) && isOptionalText(value.url) && isCount(value.passages);

function isReport(value: unknown): value is OriginalityReport {
  if (!isRecord(value) || !isRecord(value.checked)) return false;
  const { checked } = value;
  return isTime(value.checkedAt) && [value.totalWords, value.matchedWords, value.uncitedPassages].every(isCount)
    && typeof value.coveragePercent === 'number' && Number.isFinite(value.coveragePercent)
    && listOf(value.passages, isPassage) && listOf(value.sources, isCheckedSource)
    && isCount(checked.projectSources) && isCount(checked.openSources) && listOf(checked.openSourceProviders, isText)
    && value.licensedService === 'not_configured' && listOf(value.limitations, isText);
}

/** The saved report, or null when the stored content is not a complete one. */
export function readSavedOriginalityReport(content: unknown): SavedOriginalityReport | null {
  let value = content;
  if (typeof content === 'string') {
    try { value = JSON.parse(content); } catch { return null; }
  }
  if (!isRecord(value) || value.version !== 1 || (value.input !== 'draft' && value.input !== 'text')) return null;
  if (!(value.draftSavedAt === null || isTime(value.draftSavedAt)) || !isReport(value.report)) return null;
  return { version: 1, input: value.input, draftSavedAt: value.draftSavedAt, report: value.report };
}

/** A stored time as a reviewer reads it, always in UTC. */
const utc = (time: string) => { const iso = new Date(time).toISOString(); return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`; };
const providerName = (id: string) => RESEARCH_SOURCE_REGISTRY.find(source => source.id === id)?.label ?? id;

/**
 * The report a researcher hands to a supervisor (DOC-39-02): what was checked,
 * by which rules, every match with its place in the text and its numbered
 * source, and what the check cannot show. Never a bare percentage.
 *
 * Lines avoid brackets beside numbers or Latin words, and Arabic commas
 * between Latin names: the PDF writer's bidi reordering misplaces the former
 * and its Latin fonts have no glyph for the latter.
 */
export function originalityExportModel(input: {
  documentId: string;
  projectTitle: string | null;
  researcherName: string | null;
  saved: SavedOriginalityReport;
}, language: UiLanguage = 'ar'): ProjectExportModel {
  const ui = (message: string, values?: readonly unknown[]) => translateUiText(message, language, values);
  const { saved } = input;
  const { report } = saved;
  const citedLabel = (cited: boolean) => ui(cited ? 'موثّق' : 'غير موثّق');
  const quote = (text: string) => (language === 'en' ? `“${text}”` : `«${text}»`);
  const noMatch = ui('لم يُعثر على مقاطع تتطابق حرفيًا مع المصادر المفحوصة.');
  const providers = report.checked.openSourceProviders.map(providerName);

  const checkedText = saved.input === 'text'
    ? ui('النص المفحوص: نص ألصقه الباحث في صفحة الفحص، دون استشهادات مرتبطة به')
    : saved.draftSavedAt
      ? ui('النص المفحوص: آخر مسودة في الكتابة بالدليل، المحفوظة في {0}', [utc(saved.draftSavedAt)])
      : ui('النص المفحوص: آخر مسودة في الكتابة بالدليل');

  const details = [
    ui('رقم التقرير: {0}', [input.documentId]),
    ui('تاريخ الفحص: {0}', [utc(report.checkedAt)]),
    ...(input.projectTitle ? [ui('المشروع: {0}', [input.projectTitle])] : []),
    ...(input.researcherName ? [ui('الباحث: {0}', [input.researcherName])] : []),
    checkedText,
    ui('عدد كلمات النص: {0}', [report.totalWords]),
  ];

  const summary = [
    ui('نسبة النص المطابق للمصادر المفحوصة: {0}%، أي {1} كلمة من {2}.', [report.coveragePercent, report.matchedWords, report.totalWords]),
    ...(report.passages.length ? [
      ui('المقاطع المطابقة: {0}، منها {1} غير موثّقة.', [report.passages.length, report.uncitedPassages]),
      ui('النسبة وحدها لا تحكم على أصالة العمل؛ راجع المقاطع غير الموثّقة ومصادرها أدناه.'),
    ] : [noMatch]),
  ];

  const scope = [
    ui('مصادر المشروع التي قورن النص بنصوصها الكاملة: {0}.', [report.checked.projectSources]),
    !report.checked.openSources ? ui('لم تُفحص المصادر العلمية المفتوحة في هذا التقرير.')
      : providers.length ? ui('السجلات العلمية المفتوحة التي قورن بها النص: {0}، بعناوينها ومستخلصاتها فقط، من {1}.', [report.checked.openSources, providers.join(', ')])
        : ui('السجلات العلمية المفتوحة التي قورن بها النص: {0}، بعناوينها ومستخلصاتها فقط.', [report.checked.openSources]),
    ui('قواعد النصوص الكاملة المرخّصة: لم تُفحص لأن الخدمة المرخّصة غير مُعدّة.'),
  ];

  const sources = report.sources.length
    ? report.sources.flatMap(source => [
      [
        ui('المصدر {0}: {1}', [source.number, `${source.title}${source.year ? ` (${source.year})` : ''}`]),
        ui(ORIGIN_LABELS[source.origin]),
        source.passages ? ui('مطابقات: {0}', [source.passages]) : ui('لا مطابقة'),
      ].join(' — '),
      ...(source.url ? [ui('الرابط: {0}', [source.url])] : []),
    ])
    : [ui('لم يُقارن النص بأي مصدر؛ لا توجد في هذا الفحص مصادر مقروءة النص.')];

  const rules = [
    ui('يُعدّ المقطع مطابقًا إذا اشترك مع مصدر في {0} كلمات متتالية على الأقل.', [SHINGLE_SIZE]),
    ui('قبل المقارنة يُحذف التشكيل والتطويل وعلامات الترقيم، وتُوحَّد أشكال الألف والهمزة والياء والتاء المربوطة، وتُحوَّل الحروف اللاتينية إلى صغيرة.'),
    ui('تُدمج السلاسل المتجاورة أو المتداخلة في مقطع واحد، ويُذكر كل مصدر وُجد فيه المقطع.'),
    ui('يُعدّ المقطع موثّقًا إذا وقع داخل ادعاء أحال فيه الباحث إلى المصدر نفسه في مسودة الكتابة بالدليل؛ والنص الملصق لا استشهادات له، فتظهر مطابقاته كلها غير موثّقة.'),
    ui('النسبة = عدد الكلمات الواقعة في مقاطع مطابقة ÷ عدد كلمات النص كله.'),
    ui('تُعدّ الفقرات والكلمات من أول النص المفحوص.'),
  ];

  const matches = report.passages.length
    ? report.passages.flatMap((passage, index) => [
      ui('المقطع {0}: الفقرة {1}، الكلمات من {2} إلى {3}، وعددها {4} — {5}', [
        index + 1, passage.paragraph, passage.firstWord, passage.lastWord, passage.wordCount, citedLabel(passage.matches.every(match => match.cited)),
      ]),
      quote(passage.text),
      ...passage.matches.map(match => ui('وُجد في المصدر {0}: {1} — {2}', [match.sourceNumber, match.title, citedLabel(match.cited)])),
    ])
    : [noMatch];

  return {
    language,
    documentDirection: language === 'en' ? 'ltr' : 'rtl',
    title: ui('تقرير التطابق الحرفي مع المصادر'),
    notice: ui('تقرير محفوظ في مشروع الباحث على واحة. يعرض نطاق الفحص وقواعده وكل مطابقة ومصدرها وحدوده، وليس تقرير أصالة رسميًا تعتمده الجامعات.'),
    sections: [
      { title: ui('بيانات التقرير'), paragraphs: details },
      { title: ui('خلاصة الفحص'), paragraphs: summary },
      { title: ui('نطاق الفحص'), paragraphs: scope },
      { title: ui('المصادر المفحوصة'), paragraphs: sources },
      { title: ui('قواعد المطابقة'), paragraphs: rules },
      { title: ui('المطابقات'), paragraphs: matches },
      { title: ui('حدود الفحص'), paragraphs: report.limitations.map(item => ui(item)) },
    ],
  };
}
