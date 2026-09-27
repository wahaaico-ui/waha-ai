import { countryName } from './researcher-profile';

export type EvidencePaper = {
  title: string;
  abstract?: string;
  year: number;
  citations: number;
  url: string;
  source: 'semanticscholar' | 'openalex' | 'both';
  authors?: string[];
  venue?: string;
  countries?: string[];
};

export type VerifyReport = {
  topic: string;
  researcherInput: ResearcherInput;
  translatedQuery?: string;
  totalPapers: number;
  yearDistribution: { year: number; count: number }[];
  geographicDistribution: { region: string; count: number }[];
  methodologyDistribution: { type: string; count: number }[];
  methodologyNote: string;
  gaps: string[];
  acceptanceScore: number;
  /** The score is a legacy count-based heuristic kept for compatibility, not an academic judgement. */
  scoreStatus?: 'legacy_heuristic';
  scoreNotice?: string;
  scoreBreakdown: {
    gapExists: number;
    recency: number;
    methodDiversity: number;
    geoDiversity: number;
    sufficientRefs: number;
    consistency: number;
  };
  decision: 'reject' | 'improve' | 'proceed';
  decisionMessage: string;
  alternativeAngles?: string[];
  improvements?: string[];
  topPapers: EvidencePaper[];
  searchCoverage: SearchCoverage;
  researcherContext: ResearcherContext;
  contextMatch: {
    localAffiliationMatches: number;
    note: string;
  };
  researchPaths: ResearchPath[];
  evidenceLimitations: string[];
  usageInfo?: {
    count: number;
    limit: number;
    period?: 'day';
    resetsAfterHours?: number;
    isFirstCheck: boolean;
    isBlurred: boolean;
    isBlocked: boolean;
    projectId: string | null;
  };
};

export type ResearcherContext = {
  countryCode: string | null;
  countryName: string | null;
  specialty: string | null;
  university: string | null;
  level: string | null;
};

export type ResearchScenario = 'uncertain' | 'idea' | 'rejected_title' | 'compare_titles' | 'references_only';

export type ResearcherInput = {
  scenario: ResearchScenario;
  candidateTitles: string[];
  rejectionFeedback: string | null;
};

export type SearchCoverage = {
  queryCount: number;
  candidateResults: number;
  uniqueStudies: number;
  excludedByRelevance: number;
  searchedAt: string;
  sources: Array<{ id: 'semanticscholar' | 'openalex'; label: string; uniqueMatches: number }>;
  scopeNote: string;
};

export type ResearchPath = {
  id: string;
  title: string;
  rationale: string;
  evidenceLevel: 'suggestion';
  supportingReferences: Array<{ title: string; year: number; url: string }>;
};

/** The path used when the researcher saves their own candidate titles for comparison. */
export function buildProvidedTitlesPath(report: Pick<VerifyReport, 'topPapers'>): ResearchPath {
  return {
    id: 'provided-title-comparison',
    title: 'مقارنة العناوين التي قدّمها الباحث',
    rationale: 'هذا الاتجاه يحفظ العناوين المدخلة كما هي لقياس وضوحها وغنى أدلتها قبل اعتماد أحدها.',
    evidenceLevel: 'suggestion',
    supportingReferences: (report.topPapers || []).slice(0, 3).map((paper) => ({ title: paper.title, year: paper.year, url: paper.url })),
  };
}

export function isResearchScenario(value: unknown): value is ResearchScenario {
  return value === 'uncertain' || value === 'idea' || value === 'rejected_title' || value === 'compare_titles' || value === 'references_only';
}

export function normalizeResearcherInput(value: unknown): ResearcherInput {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const scenario = isResearchScenario(input.scenario) ? input.scenario : 'idea';
  const candidateTitles = Array.isArray(input.candidateTitles)
    ? [...new Set(input.candidateTitles
      .filter((title): title is string => typeof title === 'string')
      .map((title) => title.trim())
      .filter((title) => title.length >= 10))].slice(0, 4)
    : [];
  const rejectionFeedback = typeof input.rejectionFeedback === 'string' && input.rejectionFeedback.trim()
    ? input.rejectionFeedback.trim().slice(0, 1_000)
    : null;

  return { scenario, candidateTitles, rejectionFeedback };
}

const METHOD_PATTERNS = [
  { type: 'كمي', pattern: /quantitative|survey|questionnaire|statistic|regression|correlation|كمي|استبانة|إحصائ/i },
  { type: 'نوعي', pattern: /qualitative|interview|ethnograph|case study|نوعي|مقابلة|دراسة حالة/i },
  { type: 'مختلط', pattern: /mixed method|mixed-method|مختلط/i },
  { type: 'تجريبي', pattern: /experiment|trial|randomized|تجريب|تجربة/i },
] as const;

const SEARCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'among', 'between', 'through', 'using', 'use', 'uses',
  'effect', 'effects', 'impact', 'study', 'research', 'analysis', 'role', 'toward', 'towards',
  'في', 'من', 'على', 'إلى', 'الى', 'عن', 'لدى', 'بين', 'أثر', 'دور', 'دراسة', 'بحث', 'تحليل',
]);

const BROAD_TECHNOLOGY_TOKENS = new Set(['ai', 'generative', 'technology', 'digital', 'تقنية', 'تكنولوجيا', 'رقمي', 'الذكاء', 'الاصطناعي', 'التوليدي']);

function searchTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/artificial intelligence/g, ' ai ')
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !SEARCH_STOP_WORDS.has(token));
}

export function paperRelevanceScore(paper: EvidencePaper, queries: string[]) {
  const titleTokens = new Set(searchTokens(paper.title));
  const contentTokens = new Set(searchTokens(`${paper.title} ${paper.abstract || ''}`));
  let bestScore = 0;

  for (const query of queries) {
    const tokens = [...new Set(searchTokens(query))];
    if (tokens.length === 0) continue;
    const titleMatches = tokens.filter((token) => titleTokens.has(token)).length;
    const contentMatches = tokens.filter((token) => contentTokens.has(token)).length;
    const weightedMatches = (titleMatches * 2) + Math.max(0, contentMatches - titleMatches);
    bestScore = Math.max(bestScore, weightedMatches / (tokens.length * 2));
  }

  return Math.min(1, bestScore);
}

export function filterRelevantPapers(papers: EvidencePaper[], queries: string[]) {
  const anchorTokens = [...new Set(queries.flatMap(searchTokens).filter((token) => !BROAD_TECHNOLOGY_TOKENS.has(token)))];
  return papers.filter((paper) => {
    if (paperRelevanceScore(paper, queries) < 0.28) return false;
    if (anchorTokens.length === 0) return true;
    const contentTokens = new Set(searchTokens(`${paper.title} ${paper.abstract || ''}`));
    return anchorTokens.some((token) => contentTokens.has(token));
  });
}

function references(papers: EvidencePaper[], limit = 3) {
  return papers
    .filter((paper) => paper.title)
    .slice(0, limit)
    .map((paper) => ({ title: paper.title, year: paper.year, url: paper.url }));
}

export function inferMethodologyDistribution(papers: EvidencePaper[]) {
  return METHOD_PATTERNS.map(({ type, pattern }) => ({
    type,
    count: papers.filter((paper) => pattern.test(paper.abstract || '')).length,
  })).filter((method) => method.count > 0);
}

export function buildSearchCoverage(
  papers: EvidencePaper[],
  queryCount: number,
  searchedAt = new Date().toISOString(),
  candidateResults = papers.length,
): SearchCoverage {
  return {
    queryCount,
    candidateResults,
    uniqueStudies: papers.length,
    excludedByRelevance: Math.max(0, candidateResults - papers.length),
    searchedAt,
    sources: [
      {
        id: 'semanticscholar',
        label: 'Semantic Scholar',
        uniqueMatches: papers.filter((paper) => paper.source === 'semanticscholar' || paper.source === 'both').length,
      },
      {
        id: 'openalex',
        label: 'OpenAlex',
        uniqueMatches: papers.filter((paper) => paper.source === 'openalex' || paper.source === 'both').length,
      },
    ],
    scopeNote: 'هذه الأعداد تصف النتائج الفريدة الأقرب إلى الموضوع ضمن المصادر والاستعلامات الحالية بعد ترشيح الصلة، وليست حكماً على جميع ما نُشر عالمياً.',
  };
}

export function buildResearchPaths(
  topic: string,
  papers: EvidencePaper[],
  context: ResearcherContext,
  currentYear: number,
): ResearchPath[] {
  const ranked = [...papers].sort((a, b) => (b.year - a.year) || (b.citations - a.citations));
  const recent = ranked.filter((paper) => paper.year >= currentYear - 4);
  const countryCounts = new Map<string, number>();
  papers.forEach((paper) => (paper.countries || []).forEach((code) => countryCounts.set(code, (countryCounts.get(code) || 0) + 1)));
  const leadingCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const localPapers = context.countryCode
    ? ranked.filter((paper) => (paper.countries || []).includes(context.countryCode as string))
    : [];

  const paths: ResearchPath[] = [];

  if (context.countryCode && context.countryName) {
    paths.push({
      id: 'local-context',
      title: `${topic} في سياق ${context.countryName}`,
      rationale: localPapers.length > 0
        ? `ظهر في البيانات الوصفية ${localPapers.length} من النتائج المرتبطة بمؤسسات في ${context.countryName}. يمكن اختبار ما إذا كانت النتائج السابقة تنطبق على البيئة المحلية ومجتمع الدراسة المقترح.`
        : `لم تظهر ضمن النتائج الحالية دراسة مرتبطة بمؤسسة في ${context.countryName}. هذا مؤشر أولي يستحق بحثاً محلياً أوسع، وليس دليلاً قاطعاً على غياب الدراسات.`,
      evidenceLevel: 'suggestion',
      supportingReferences: references(localPapers.length > 0 ? localPapers : ranked),
    });
  }

  paths.push({
    id: 'recent-evidence',
    title: `${topic}: قراءة تركز على الأدلة المنشورة خلال السنوات الخمس الأخيرة`,
    rationale: `استرجع البحث الحالي ${recent.length} دراسة حديثة منذ ${currentYear - 4}. يصلح هذا المسار لاختبار ما تغيّر حديثاً وتحديد ما إذا كان السؤال ما زال مفتوحاً.`,
    evidenceLevel: 'suggestion',
    supportingReferences: references(recent.length > 0 ? recent : ranked),
  });

  if (paths.length < 3) {
    paths.push({
      id: 'scope-refinement',
      title: `${topic}: تضييق النطاق بتحديد الظاهرة والمجتمع والسياق`,
      rationale: 'هذا مسار بناء أولي عندما لا تكفي البيانات المسترجعة للمقارنة. يلزم تحديد المتغير أو الظاهرة ومجتمع الدراسة والمكان والفترة، ثم إعادة البحث قبل اعتماده.',
      evidenceLevel: 'suggestion',
      supportingReferences: references(ranked),
    });
  }

  if (leadingCountries.length >= 2) {
    const firstName = countryName(leadingCountries[0][0]) || leadingCountries[0][0];
    const secondName = countryName(leadingCountries[1][0]) || leadingCountries[1][0];
    const comparisonPapers = ranked.filter((paper) => (paper.countries || []).some((code) => code === leadingCountries[0][0] || code === leadingCountries[1][0]));
    paths.push({
      id: 'geographic-comparison',
      title: `${topic}: مقارنة سياقية بين ${firstName} و${secondName}`,
      rationale: `هما أكثر سياقين جغرافيين ظهوراً في البيانات الوصفية للنتائج الحالية (${leadingCountries[0][1]} و${leadingCountries[1][1]} دراسة). المقارنة قد تكشف أثر اختلاف البيئة أو السياسات أو مجتمع الدراسة.`,
      evidenceLevel: 'suggestion',
      supportingReferences: references(comparisonPapers),
    });
  }

  const highImpact = [...papers].sort((a, b) => b.citations - a.citations);
  paths.push({
    id: 'replication',
    title: `${topic}: إعادة اختبار نتائج دراسة مرجعية في مجتمع بحثي جديد`,
    rationale: 'يختبر هذا المسار قابلية تعميم نتيجة سابقة بدلاً من ادعاء جدة كاملة، ويحتاج تحديد الدراسة المرجعية ومجتمع الدراسة والأداة قبل اعتماده.',
    evidenceLevel: 'suggestion',
    supportingReferences: references(highImpact),
  });

  if (context.specialty) {
    paths.push({
      id: 'disciplinary-lens',
      title: `${topic} من منظور ${context.specialty}`,
      rationale: `هذا مسار تخصيص أولي مبني على تخصص الباحث المسجل. لا يعتمد كعنوان نهائي قبل التحقق من المفاهيم والفجوة وتوافر الأدلة داخل التخصص.`,
      evidenceLevel: 'suggestion',
      supportingReferences: references(ranked),
    });
  }

  return paths.slice(0, 5);
}
