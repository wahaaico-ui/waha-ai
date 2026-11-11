/**
 * Project indicators (DOC-38-01): compliance with the university guide, time,
 * and publishability in a journal. Each states what it measured and what is
 * missing; without its data an indicator is "not assessed", never a made-up
 * score.
 */
import { WRITING_STYLE_LABELS, type CitationStyle } from '@/lib/citations/types';
import { approvedStyleProfile, GUIDE_RULE_EXPORT, type GuideRuleKey, type SavedGuide } from '@/lib/guide-workflow';
import { buildJournalFit, countWords, stageText, type FitCheck, type JournalTemplate } from '@/lib/journal-template';
import { TIME_LABELS, type TimeBudget } from '@/lib/idea-selection/questions';

export type IndicatorState = 'met' | 'attention' | 'not_assessed';
/** Text with numbered slots; string values are labels the page translates, numbers are measured. */
export type IndicatorText = { text: string; values?: Array<string | number> };
export type IndicatorLine = IndicatorText & { state: 'met' | 'attention' | 'info' };
export type ProjectIndicator = { id: 'guide' | 'time' | 'publication'; state: IndicatorState; lines: IndicatorLine[]; missing: IndicatorText[] };

const line = (state: IndicatorLine['state'], text: string, values?: Array<string | number>): IndicatorLine => (values ? { text, values, state } : { text, state });

/** Rules the indicator checks against the draft; the others are formatting the Word export applies. */
const CHECKED_RULES: GuideRuleKey[] = ['system', 'max_words', 'abstract_max_words'];
const NOT_FORMATTING: GuideRuleKey[] = [...CHECKED_RULES, 'in_text_format', 'university_or_journal_name'];

function stateOf(lines: IndicatorLine[], measuredOtherwise = false): IndicatorState {
  if (lines.some(item => item.state === 'attention')) return 'attention';
  return lines.some(item => item.state === 'met') || measuredOtherwise ? 'met' : 'not_assessed';
}

export function guideIndicator(input: {
  guide: SavedGuide | null;
  guideUnreadable?: boolean;
  draft: { text: string; citationStyle: string | null } | null;
  abstractText: string | null;
}): ProjectIndicator {
  if (input.guideUnreadable) {
    return { id: 'guide', state: 'not_assessed', lines: [], missing: [{ text: 'تعذر قراءة الدليل المحفوظ؛ افتحه في «تعليمات الجامعة» وأعد حفظه.' }] };
  }
  const approved = input.guide?.rules.filter(rule => rule.status === 'approved') ?? [];
  if (!input.guide || !approved.length) {
    return { id: 'guide', state: 'not_assessed', lines: [], missing: [{ text: 'لا توجد قواعد معتمدة من دليل الجامعة؛ أضف الدليل واعتمد قواعده من «تعليمات الجامعة».' }] };
  }

  const profile = approvedStyleProfile(input.guide);
  const lines: IndicatorLine[] = [line('info', 'قواعد معتمدة من الدليل: {0}.', [approved.length])];
  const missing: IndicatorText[] = [];
  const maxWords = profile.document_rules.max_words?.value ?? null;
  const abstractMax = profile.document_rules.abstract_max_words?.value ?? null;
  const system = profile.citation_style.system?.value ?? null;

  if ((maxWords !== null || system !== null) && !input.draft) missing.push({ text: 'لا توجد مسودة في «الكتابة بالدليل» لمقارنتها بقواعد الدليل.' });
  if (maxWords !== null && input.draft) {
    const draftWords = countWords(input.draft.text);
    lines.push(line(draftWords <= maxWords ? 'met' : 'attention', 'المسودة {0} كلمة، وحد الدليل {1} كلمة.', [draftWords, maxWords]));
  }
  if (abstractMax !== null) {
    const abstractWords = input.abstractText ? countWords(input.abstractText) : 0;
    if (!abstractWords) missing.push({ text: 'لم يُكتب الملخص بعد في مرحلة «جاهزية النشر».' });
    else lines.push(line(abstractWords <= abstractMax ? 'met' : 'attention', 'الملخص {0} كلمة، وحد الدليل {1} كلمة.', [abstractWords, abstractMax]));
  }
  if (system !== null && input.draft) {
    const chosen = input.draft.citationStyle;
    if (!chosen) missing.push({ text: 'لم يُحدَّد نظام التوثيق في المسودة.' });
    else if (system.toLowerCase().replace(/\s+/gu, '-') === chosen) lines.push(line('met', 'نظام التوثيق في المسودة يطابق الدليل: {0}.', [system]));
    else lines.push(line('attention', 'الدليل يطلب {0}، والمسودة مضبوطة على {1}.', [system, WRITING_STYLE_LABELS[chosen as CitationStyle] ?? chosen]));
  }

  const formatting = approved.filter(rule => !NOT_FORMATTING.includes(rule.key) && GUIDE_RULE_EXPORT[rule.key].word === 'applied');
  if (formatting.length) lines.push(line('info', 'قواعد التنسيق المعتمدة ({0}) تُطبَّق تلقائيًا في ملف Word عند التصدير.', [formatting.length]));
  const checkable = approved.some(rule => CHECKED_RULES.includes(rule.key));
  // A guide of formatting rules alone is met by the export itself; checked rules need a measurement.
  return { id: 'guide', state: stateOf(lines, !checkable && formatting.length > 0), lines, missing };
}

const DAY = 86_400_000;
const BUDGET_DAYS: Record<TimeBudget, number | null> = { short: 182, medium: 365, long: null };
const MIN_STAGES_FOR_PACE = 3;

export function timeIndicator(input: { time: TimeBudget | null; completed: number; total: number; startedAt: string | null; now: Date }): ProjectIndicator {
  const lines: IndicatorLine[] = [line('info', 'أنجزت {0} من {1} مرحلة.', [input.completed, input.total])];
  if (input.total > 0 && input.completed >= input.total) {
    return { id: 'time', state: 'met', lines: [...lines, line('met', 'اكتملت المراحل كلها.')], missing: [] };
  }
  const missing: IndicatorText[] = [];
  if (!input.time) missing.push({ text: 'لم تحدد الوقت المتاح في «خمسة أسئلة قبل أن تختار».' });
  const started = input.startedAt ? Date.parse(input.startedAt) : Number.NaN;
  if (input.completed < MIN_STAGES_FOR_PACE || Number.isNaN(started)) missing.push({ text: 'لا تكفي المراحل المنجزة لتقدير الوتيرة؛ يلزم إنجاز ثلاث مراحل على الأقل.' });
  if (missing.length || !input.time) return { id: 'time', state: 'not_assessed', lines, missing };

  const elapsed = Math.max(0, Math.round((input.now.getTime() - started) / DAY));
  const pace = Math.round((elapsed / input.completed) * 10) / 10;
  const remaining = Math.round(((input.total - input.completed) * elapsed) / input.completed);
  lines.push(
    line('info', 'مضى {0} يومًا منذ حفظ أول مرحلة، أي نحو {1} يومًا لكل مرحلة.', [elapsed, pace]),
    line('info', 'بهذه الوتيرة تحتاج المراحل الباقية نحو {0} يومًا.', [remaining]),
  );
  const budget = BUDGET_DAYS[input.time];
  if (budget === null) lines.push(line('met', 'الوقت المتاح لك أكثر من سنة، فلا حد أعلى للمقارنة.'));
  else if (elapsed + remaining <= budget) lines.push(line('met', 'هذا ضمن الوقت المتاح لك: {0}.', [TIME_LABELS[input.time]]));
  else lines.push(line('attention', 'هذا يتجاوز الوقت المتاح لك: {0}؛ ضيّق النطاق أو اختر مسارًا أقصر.', [TIME_LABELS[input.time]]));
  return { id: 'time', state: stateOf(lines), lines, missing };
}

const FIT_TEXT: Record<FitCheck['id'], string> = {
  sections: 'الأقسام المكتملة: {0} من {1}.',
  words: 'عدد كلمات البحث {0}، وحد المجلة {1}.',
  abstract: 'كلمات الملخص {0}، وحد المجلة {1}.',
  keywords: 'الكلمات المفتاحية {0}، والمطلوب {1}.',
  references: 'المراجع {0}، وحد المجلة {1}.',
};

export function publicationIndicator(input: { template: JournalTemplate | null; outputs: Partial<Record<string, unknown>>; referenceCount: number }): ProjectIndicator {
  if (!input.template) {
    return { id: 'publication', state: 'not_assessed', lines: [], missing: [{ text: 'لم تُحفظ تعليمات مجلة في «حزمة النشر والتصدير».' }] };
  }
  const publication = input.outputs.publication && typeof input.outputs.publication === 'object'
    ? input.outputs.publication as { structuredAbstract?: Record<string, string>; keywords?: string[] } : null;
  const fit = buildJournalFit(input.template, input.outputs, publication, input.referenceCount);
  const lines = fit.checks.map(check => line(check.ok ? 'met' : 'attention', FIT_TEXT[check.id], [check.actual, /^\d+$/u.test(check.limit) ? Number(check.limit) : check.limit]));
  return { id: 'publication', state: stateOf(lines), lines, missing: [] };
}

/** The abstract the researcher wrote in the publication stage, as plain text. */
export function publicationAbstract(outputs: Partial<Record<string, unknown>>): string | null {
  const publication = outputs.publication as { structuredAbstract?: unknown } | undefined;
  const text = publication?.structuredAbstract ? stageText(publication.structuredAbstract) : '';
  return text || null;
}
