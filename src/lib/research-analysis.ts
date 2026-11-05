export type AnalysisTheme = {
  title: string;
  synthesis: string;
  supportingPaperIds: string[];
};

export type ResearchAnalysis = {
  introduction: string;
  thematicSynthesis: string;
  themes: AnalysisTheme[];
  researchGapsIdentified: string[];
  conclusion: string;
  limitations: string[];
};

type AnalysisEvidenceSource = { id: string; title?: string; year?: unknown; abstract?: string };

function numericEvidenceTokens(value: string, sourceCount = 0) {
  const normalized = value.normalize('NFKC')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, '.').replace(/٪/g, '%').replace(/−/g, '-').replace(/\s+(?=%)/g, '')
    // Numbered source markers are references, not quantitative findings.
    .replace(/\[(\d+(?:\s*[,،]\s*\d+)*)\]/g, (marker, indexes: string) =>
      indexes.split(/[,،]/).every((index) => Number(index) >= 1 && Number(index) <= sourceCount) ? '' : marker);
  return [...normalized.matchAll(/(?<![\p{L}\p{N}_])[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)%?(?![\p{L}\p{N}_])/gu)]
    .map(([token]) => `${Number(token.replace('%', '').replace(',', '.'))}${token.endsWith('%') ? '%' : ''}`);
}

/** Numeric presence only: never a verification of meaning, causality or accuracy. */
export function researchAnalysisEvidenceIssue(analysis: ResearchAnalysis, sources: AnalysisEvidenceSource[]): string | null {
  const sourceText = (selected: AnalysisEvidenceSource[]) => selected.map((source) => `${source.title || ''} ${typeof source.year === 'number' || typeof source.year === 'string' ? source.year : ''} ${source.abstract || ''}`).join('\n');
  const unsupported = (candidate: string, selected: AnalysisEvidenceSource[], includeCount = false) => {
    const allowed = new Set(numericEvidenceTokens(`${sourceText(selected)}${includeCount ? ` ${sources.length}` : ''}`));
    return numericEvidenceTokens(candidate, sources.length).some((token) => !allowed.has(token));
  };
  for (const theme of analysis.themes) {
    if (unsupported(theme.synthesis, sources.filter((source) => theme.supportingPaperIds.includes(source.id)))) {
      return 'رُفض المخرج لأنه يتضمن أرقامًا لا تظهر في مستخلصات المصادر الداعمة أو بياناتها. راجع الدليل وأعد المحاولة.';
    }
  }
  const overview = [analysis.introduction, analysis.thematicSynthesis, analysis.conclusion, ...analysis.researchGapsIdentified].join('\n');
  return unsupported(overview, sources, true)
    ? 'رُفض المخرج لأنه يتضمن أرقامًا لا تظهر في مستخلصات المصادر الداعمة أو بياناتها. راجع الدليل وأعد المحاولة.'
    : null;
}

const text = (value: unknown, minimum: number, maximum: number) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length >= minimum && cleaned.length <= maximum ? cleaned : null;
};

const textList = (value: unknown, minimumItems: number, maximumItems: number) => {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((item) => text(item, 10, 1_500));
  if (parsed.some((item) => item === null)) return null;
  const values = parsed as string[];
  return values.length >= minimumItems && values.length <= maximumItems ? values : null;
};

export function normaliseResearchAnalysis(value: unknown, allowedPaperIds: string[]): ResearchAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const introduction = text(candidate.introduction, 20, 6_000);
  const thematicSynthesis = text(candidate.thematicSynthesis, 40, 10_000);
  const researchGapsIdentified = textList(candidate.researchGapsIdentified, 0, 6);
  const conclusion = text(candidate.conclusion, 20, 6_000);
  const limitations = textList(candidate.limitations, 1, 64);
  if (!introduction || !thematicSynthesis || !researchGapsIdentified || !conclusion || !limitations || !Array.isArray(candidate.themes)) return null;

  const allowed = new Set(allowedPaperIds);
  const themes: AnalysisTheme[] = [];
  for (const rawTheme of candidate.themes.slice(0, 6)) {
    if (!rawTheme || typeof rawTheme !== 'object' || Array.isArray(rawTheme)) return null;
    const theme = rawTheme as Record<string, unknown>;
    const title = text(theme.title, 5, 300);
    const synthesis = text(theme.synthesis, 20, 3_000);
    if (!title || !synthesis || !Array.isArray(theme.supportingPaperIds)) return null;
    const supportingPaperIds = [...new Set(theme.supportingPaperIds.filter((id): id is string => typeof id === 'string' && allowed.has(id)))];
    if (supportingPaperIds.length === 0 || supportingPaperIds.length !== theme.supportingPaperIds.length) return null;
    themes.push({ title, synthesis, supportingPaperIds });
  }
  if (themes.length === 0) return null;

  return { introduction, thematicSynthesis, themes, researchGapsIdentified, conclusion, limitations };
}
