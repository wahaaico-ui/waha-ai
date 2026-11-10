/**
 * Arrange a project's saved stages to a journal's own instructions and check
 * the manuscript against them (DOC-29-05, part of DOC-29-04). The template is
 * entered by the researcher; presets are generic starting points.
 */

export const JOURNAL_TEMPLATE_TYPE = 'journal-template:v1';

export const MANUSCRIPT_SECTIONS = ['introduction', 'literature', 'methods', 'results', 'discussion', 'conclusion'] as const;
export type ManuscriptSection = typeof MANUSCRIPT_SECTIONS[number];

export const SECTION_LABELS: Record<ManuscriptSection, string> = {
  introduction: 'المقدمة', literature: 'الإطار النظري والدراسات السابقة', methods: 'المنهجية',
  results: 'النتائج', discussion: 'المناقشة', conclusion: 'الخاتمة والتوصيات',
};

/** Which journey stages feed each manuscript section. */
export const STAGE_SECTIONS: Record<ManuscriptSection, string[]> = {
  introduction: ['problem', 'objectives', 'questions', 'hypotheses'],
  literature: ['literature', 'analysis'],
  methods: ['methodology', 'design', 'instrument'],
  results: ['analysis_input', 'results'],
  discussion: ['discussion'],
  conclusion: ['conclusions', 'recommendations'],
};

export type JournalTemplate = {
  preset: 'imrad' | 'review' | 'custom';
  sections: ManuscriptSection[];
  wordLimit: number | null;
  abstractMaxWords: number | null;
  keywordsMin: number;
  keywordsMax: number;
  referenceLimit: number | null;
};

export const JOURNAL_PRESETS: Record<'imrad' | 'review', JournalTemplate> = {
  imrad: { preset: 'imrad', sections: ['introduction', 'literature', 'methods', 'results', 'discussion', 'conclusion'], wordLimit: 8000, abstractMaxWords: 250, keywordsMin: 3, keywordsMax: 6, referenceLimit: null },
  review: { preset: 'review', sections: ['introduction', 'literature', 'discussion', 'conclusion'], wordLimit: 10000, abstractMaxWords: 250, keywordsMin: 3, keywordsMax: 6, referenceLimit: null },
};

const limit = (value: unknown, max: number) => value === null || value === undefined || value === ''
  ? null : Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= max ? value as number : undefined;

export function parseJournalTemplate(value: unknown): JournalTemplate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!['imrad', 'review', 'custom'].includes(String(v.preset))) return null;
  if (!Array.isArray(v.sections) || !v.sections.length || new Set(v.sections).size !== v.sections.length
    || v.sections.some(s => !MANUSCRIPT_SECTIONS.includes(s as ManuscriptSection))) return null;
  const wordLimit = limit(v.wordLimit, 200_000), abstractMaxWords = limit(v.abstractMaxWords, 2_000), referenceLimit = limit(v.referenceLimit, 2_000);
  const keywordsMin = limit(v.keywordsMin, 30), keywordsMax = limit(v.keywordsMax, 30);
  if (wordLimit === undefined || abstractMaxWords === undefined || referenceLimit === undefined || !keywordsMin || !keywordsMax || keywordsMin > keywordsMax) return null;
  return { preset: v.preset as JournalTemplate['preset'], sections: v.sections as ManuscriptSection[], wordLimit, abstractMaxWords, keywordsMin, keywordsMax, referenceLimit };
}

/** Words with a letter or digit; dashes and punctuation alone do not count. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(token => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Every string value in a saved stage output, in order. */
export function stageText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(stageText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(stageText).filter(Boolean).join('\n');
  return '';
}

export type FitCheck = { id: 'sections' | 'words' | 'abstract' | 'keywords' | 'references'; ok: boolean; actual: number; limit: string };
export type JournalFit = {
  outline: Array<{ section: ManuscriptSection; stages: string[]; words: number; missing: boolean }>;
  totalWords: number;
  checks: FitCheck[];
};

export function buildJournalFit(
  template: JournalTemplate,
  outputs: Partial<Record<string, unknown>>,
  publication: { structuredAbstract?: Record<string, string>; keywords?: string[] } | null,
  referenceCount: number,
): JournalFit {
  const outline = template.sections.map(section => {
    const stages = STAGE_SECTIONS[section].filter(stage => stageText(outputs[stage]));
    const words = stages.reduce((sum, stage) => sum + countWords(stageText(outputs[stage])), 0);
    return { section, stages, words, missing: words === 0 };
  });
  const totalWords = outline.reduce((sum, section) => sum + section.words, 0);
  const abstractWords = countWords(stageText(publication?.structuredAbstract ?? ''));
  const keywords = (publication?.keywords ?? []).filter(k => k.trim()).length;
  const missing = outline.filter(s => s.missing).length;

  const checks: FitCheck[] = [{ id: 'sections', ok: missing === 0, actual: template.sections.length - missing, limit: String(template.sections.length) }];
  if (template.wordLimit) checks.push({ id: 'words', ok: totalWords <= template.wordLimit, actual: totalWords, limit: String(template.wordLimit) });
  if (template.abstractMaxWords) checks.push({ id: 'abstract', ok: abstractWords > 0 && abstractWords <= template.abstractMaxWords, actual: abstractWords, limit: String(template.abstractMaxWords) });
  checks.push({ id: 'keywords', ok: keywords >= template.keywordsMin && keywords <= template.keywordsMax, actual: keywords, limit: `${template.keywordsMin}–${template.keywordsMax}` });
  if (template.referenceLimit) checks.push({ id: 'references', ok: referenceCount <= template.referenceLimit, actual: referenceCount, limit: String(template.referenceLimit) });
  return { outline, totalWords, checks };
}
