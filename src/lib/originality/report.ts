import { findOverlaps, tokenise, type OverlapMatch, type OverlapOrigin, type OverlapSource, type Token } from '@/lib/originality/text-match';
import { licensedSimilarityStatus, type LicensedSimilarityStatus } from '@/lib/originality/licensed-service';

/** How each kind of source is named on the page and in the report file. */
export const ORIGIN_LABELS: Record<OverlapOrigin, string> = {
  'project-pdf': 'ملف PDF في المشروع',
  'project-reference': 'مرجع في مكتبة المشروع',
  'open-source': 'مصدر علمي مفتوح',
};

/** The part of a saved evidence-writing citation the report needs. */
export type ReportCitation = { sourceKind: 'reference' | 'pdf'; sourceId: string; claimStart: number; claimEnd: number };

/** A match points at its source's number in `OriginalityReport.sources`. */
export type ReportMatch = OverlapMatch & { cited: boolean; sourceNumber: number };

export type ReportPassage = {
  /** Character range in the checked text. */
  start: number;
  end: number;
  text: string;
  wordCount: number;
  /** Where a reviewer finds the passage: paragraph and word positions, counted from 1. */
  paragraph: number;
  firstWord: number;
  lastWord: number;
  matches: ReportMatch[];
};

/** A source the text was compared with, numbered so every match can be traced to it. */
export type CheckedSource = { number: number; origin: OverlapOrigin; title: string; year: number | null; url: string | null; passages: number };

export type OriginalityReport = {
  checkedAt: string;
  totalWords: number;
  matchedWords: number;
  /** Share of words inside passages that match a checked source, one decimal. */
  coveragePercent: number;
  uncitedPassages: number;
  passages: ReportPassage[];
  checked: { projectSources: number; openSources: number; openSourceProviders: string[] };
  /** Every source the text was compared with, matched or not. */
  sources: CheckedSource[];
  licensedService: LicensedSimilarityStatus;
  limitations: string[];
};

const kindOf = (origin: OverlapMatch['origin']): ReportCitation['sourceKind'] | null =>
  origin === 'project-pdf' ? 'pdf' : origin === 'project-reference' ? 'reference' : null;

const sourceKey = (origin: OverlapOrigin, id: string) => `${origin}:${id.toLowerCase()}`;

/** A match is cited when a citation to that same project source covers the passage. */
function isCited(match: OverlapMatch, start: number, end: number, citations: ReportCitation[]) {
  const kind = kindOf(match.origin);
  if (!kind) return false;
  return citations.some(c => c.sourceKind === kind && c.sourceId.toLowerCase() === match.sourceId.toLowerCase()
    && c.claimStart < end && c.claimEnd > start);
}

/** Paragraphs are separated by line breaks; blank lines between them count once. */
function paragraphAt(text: string, start: number) {
  const before = text.slice(0, start).trimStart();
  return before ? before.split(/\n\s*/).length : 1;
}

/** Word positions of a passage, counted the same way as `totalWords`. */
function wordRange(tokens: Token[], start: number, end: number) {
  return { firstWord: tokens.findIndex(token => token.start === start) + 1, lastWord: tokens.findIndex(token => token.end === end) + 1 };
}

export function buildOriginalityReport(input: {
  text: string;
  sources: OverlapSource[];
  citations: ReportCitation[];
  checked: OriginalityReport['checked'];
  now?: Date;
}): OriginalityReport {
  // One entry per source, so each keeps a single number.
  const unique = [...new Map(input.sources.map(source => [sourceKey(source.origin, source.id), source])).values()];
  const numbers = new Map(unique.map((source, index) => [sourceKey(source.origin, source.id), index + 1]));
  const tokens = tokenise(input.text);

  const passages: ReportPassage[] = findOverlaps(input.text, unique).map(passage => ({
    ...passage,
    paragraph: paragraphAt(input.text, passage.start),
    ...wordRange(tokens, passage.start, passage.end),
    matches: passage.matches.map(match => ({
      ...match,
      cited: isCited(match, passage.start, passage.end, input.citations),
      sourceNumber: numbers.get(sourceKey(match.origin, match.sourceId)) ?? 0,
    })),
  }));
  const sources: CheckedSource[] = unique.map((source, index) => ({
    number: index + 1, origin: source.origin, title: source.title, year: source.year, url: source.url,
    passages: passages.filter(passage => passage.matches.some(match => match.sourceNumber === index + 1)).length,
  }));
  const totalWords = tokens.length;
  const matchedWords = passages.reduce((sum, passage) => sum + passage.wordCount, 0);
  const licensedService = licensedSimilarityStatus();

  const limitations = [
    'هذا فحص تطابق حرفي مع المصادر المذكورة أدناه فقط، وليس تقرير أصالة رسميًا تعتمده الجامعات.',
    'لا يكشف إعادة الصياغة ولا الترجمة من لغة أخرى.',
    input.checked.openSources
      ? 'المصادر المفتوحة قورنت بعناوينها ومستخلصاتها فقط، لا بنصوصها الكاملة.'
      : 'لم تُفحص المصادر العلمية المفتوحة في هذا التقرير.',
    licensedService === 'not_configured'
      ? 'لم تُفحص قواعد النصوص الكاملة المرخّصة لأن الخدمة المرخّصة غير مُعدّة.'
      : 'قواعد النصوص الكاملة المرخّصة غير متاحة في هذا التقرير.',
    'لا يقيس هذا الفحص احتمال الكتابة الآلية؛ لا توجد أداة موثوقة بما يكفي للحكم على عمل الطالب بذلك.',
    'المطابقة مع مصدر موثّق في النص ليست خطأ؛ راجع المقاطع غير الموثقة فقط.',
  ];

  return {
    checkedAt: (input.now ?? new Date()).toISOString(),
    totalWords,
    matchedWords,
    coveragePercent: totalWords ? Math.round((matchedWords / totalWords) * 1000) / 10 : 0,
    uncitedPassages: passages.filter(passage => passage.matches.some(match => !match.cited)).length,
    passages,
    checked: input.checked,
    sources,
    licensedService,
    limitations,
  };
}
