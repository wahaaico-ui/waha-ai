import { findOverlaps, tokenise, type OverlapMatch, type OverlapSource } from '@/lib/originality/text-match';
import { licensedSimilarityStatus, type LicensedSimilarityStatus } from '@/lib/originality/licensed-service';

/** The part of a saved evidence-writing citation the report needs. */
export type ReportCitation = { sourceKind: 'reference' | 'pdf'; sourceId: string; claimStart: number; claimEnd: number };

export type ReportMatch = OverlapMatch & { cited: boolean };

export type OriginalityReport = {
  checkedAt: string;
  totalWords: number;
  matchedWords: number;
  /** Share of words inside passages that match a checked source, one decimal. */
  coveragePercent: number;
  uncitedPassages: number;
  passages: Array<{ start: number; end: number; text: string; wordCount: number; matches: ReportMatch[] }>;
  checked: { projectSources: number; openSources: number; openSourceProviders: string[] };
  licensedService: LicensedSimilarityStatus;
  limitations: string[];
};

const kindOf = (origin: OverlapMatch['origin']): ReportCitation['sourceKind'] | null =>
  origin === 'project-pdf' ? 'pdf' : origin === 'project-reference' ? 'reference' : null;

/** A match is cited when a citation to that same project source covers the passage. */
function isCited(match: OverlapMatch, start: number, end: number, citations: ReportCitation[]) {
  const kind = kindOf(match.origin);
  if (!kind) return false;
  return citations.some(c => c.sourceKind === kind && c.sourceId.toLowerCase() === match.sourceId.toLowerCase()
    && c.claimStart < end && c.claimEnd > start);
}

export function buildOriginalityReport(input: {
  text: string;
  sources: OverlapSource[];
  citations: ReportCitation[];
  checked: OriginalityReport['checked'];
  now?: Date;
}): OriginalityReport {
  const passages = findOverlaps(input.text, input.sources).map(passage => ({
    ...passage,
    matches: passage.matches.map(match => ({ ...match, cited: isCited(match, passage.start, passage.end, input.citations) })),
  }));
  const totalWords = tokenise(input.text).length;
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
    licensedService,
    limitations,
  };
}
