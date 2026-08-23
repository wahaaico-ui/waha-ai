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

const text = (value: unknown, minimum: number, maximum: number) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length >= minimum && cleaned.length <= maximum ? cleaned : null;
};

const textList = (value: unknown, minimumItems: number, maximumItems: number) => {
  if (!Array.isArray(value)) return null;
  const values = value.map((item) => text(item, 10, 1_500)).filter((item): item is string => Boolean(item));
  return values.length >= minimumItems && values.length <= maximumItems ? values : null;
};

export function normaliseResearchAnalysis(value: unknown, allowedPaperIds: string[]): ResearchAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const introduction = text(candidate.introduction, 20, 6_000);
  const thematicSynthesis = text(candidate.thematicSynthesis, 40, 10_000);
  const researchGapsIdentified = textList(candidate.researchGapsIdentified, 1, 6);
  const conclusion = text(candidate.conclusion, 20, 6_000);
  const limitations = textList(candidate.limitations, 1, 6);
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
