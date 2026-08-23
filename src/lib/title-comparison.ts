import type { EvidencePaper } from './research-exploration';

export type TitleComparison = {
  id: string;
  title: string;
  clarityScore: number;
  feasibilityScore: number;
  evidenceScore: number;
  recencyScore: number;
  contextScore: number;
  overallScore: number;
  relevantStudies: number;
  recentStudies: number;
  rationale: string;
  references: Array<{
    title: string;
    year: number;
    citations: number;
    url: string;
  }>;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function includesPopulation(title: string) {
  return /لدى|طلبة|طلاب|باحث|معلم|موظف|مريض|مجتمع|عينة|students?|researchers?|teachers?|patients?|employees?/i.test(title);
}

function includesResearchRelation(title: string) {
  return /أثر|علاقة|دور|فاعلية|تأثير|مقارنة|effect|impact|relationship|role|effectiveness|comparison/i.test(title);
}

export function evaluateTitleCandidate(
  id: string,
  title: string,
  evidence: EvidencePaper[],
  contextCountryName: string | null,
  currentYear: number,
): TitleComparison {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const populationSpecified = includesPopulation(title);
  const relationSpecified = includesResearchRelation(title);
  const contextSpecified = /\sفي\s|\b(in|among|within)\b/i.test(title);
  const contextMatched = Boolean(contextCountryName && title.includes(contextCountryName));

  const lengthScore = wordCount >= 9 && wordCount <= 24 ? 45 : wordCount >= 6 && wordCount <= 30 ? 30 : 15;
  const clarityScore = clamp(lengthScore + (populationSpecified ? 25 : 5) + (relationSpecified ? 20 : 5) + (contextSpecified ? 10 : 0));
  const feasibilityScore = clamp(35 + (populationSpecified ? 25 : 0) + (contextSpecified ? 20 : 0) + (wordCount <= 26 ? 20 : 5));
  const evidenceScore = clamp(evidence.length * 10);
  const recentStudies = evidence.filter((paper) => paper.year >= currentYear - 4).length;
  const recencyScore = evidence.length > 0 ? clamp((recentStudies / evidence.length) * 100) : 0;
  const contextEvidence = contextCountryName
    ? evidence.filter((paper) => (paper.countries || []).length > 0).length
    : 0;
  const contextScore = contextCountryName
    ? clamp((contextMatched ? 70 : 25) + Math.min(30, contextEvidence * 5))
    : contextSpecified ? 70 : 40;
  const overallScore = clamp(
    (clarityScore * 0.25)
    + (feasibilityScore * 0.20)
    + (evidenceScore * 0.30)
    + (recencyScore * 0.15)
    + (contextScore * 0.10),
  );

  const strengths = [
    evidence.length >= 5 ? `${evidence.length} نتائج ذات صلة في العينة المفحوصة` : null,
    recentStudies >= 3 ? `${recentStudies} نتائج حديثة منذ ${currentYear - 4}` : null,
    populationSpecified ? 'يحدد مجتمعاً أو فئة مستهدفة' : null,
    contextMatched ? `يرتبط مباشرة بسياق ${contextCountryName}` : null,
  ].filter((item): item is string => Boolean(item));
  const weakness = !populationSpecified
    ? 'يحتاج تحديد مجتمع الدراسة'
    : !contextSpecified
      ? 'يحتاج تحديد البيئة أو النطاق'
      : evidence.length < 3
        ? 'الأدلة المسترجعة محدودة وتحتاج بحثاً أوسع'
        : null;

  return {
    id,
    title,
    clarityScore,
    feasibilityScore,
    evidenceScore,
    recencyScore,
    contextScore,
    overallScore,
    relevantStudies: evidence.length,
    recentStudies,
    rationale: [...strengths, weakness].filter(Boolean).join('؛ ') || 'عنوان قابل للمناقشة ويحتاج مراجعة الباحث والمشرف قبل الاعتماد.',
    references: [...evidence]
      .sort((a, b) => (b.year - a.year) || (b.citations - a.citations))
      .slice(0, 5)
      .map((paper) => ({ title: paper.title, year: paper.year, citations: paper.citations, url: paper.url })),
  };
}

export function recommendedTitle(comparisons: TitleComparison[]) {
  return [...comparisons].sort((a, b) => b.overallScore - a.overallScore)[0] || null;
}
