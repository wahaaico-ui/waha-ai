import { extractAcademicStyleProfile, PAGE_NUMBER_POSITIONS, type AcademicStyleProfile } from './academic-style-profile';
import { normalizeUniversityPolicy } from './university-policy';

const PREFIX = 'WAHA_GUIDE_V1:';
export const GUIDE_RULE_KEYS = [
  'university_or_journal_name', 'arabic_font_family', 'arabic_font_size_body', 'arabic_font_size_heading_1',
  'english_font_family', 'english_font_size_body', 'line_spacing', 'paragraph_indentation',
  'margin_top', 'margin_bottom', 'margin_binding_side', 'margin_other_side', 'system', 'in_text_format',
  'max_words', 'abstract_max_words', 'page_numbering',
] as const;
export type GuideRuleKey = typeof GUIDE_RULE_KEYS[number];
export type ReviewedGuideRule = { key: GuideRuleKey; value: string; evidence: string; status: 'approved' | 'review' };
export type SavedGuide = { text: string; rules: ReviewedGuideRule[] };

function isRule(value: unknown): value is ReviewedGuideRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rule = value as Record<string, unknown>;
  return GUIDE_RULE_KEYS.includes(rule.key as GuideRuleKey) && typeof rule.value === 'string' && rule.value.length <= 120
    && typeof rule.evidence === 'string' && rule.evidence.length <= 500
    && (rule.status === 'approved' || rule.status === 'review');
}

export function readSavedGuide(value: string | null): SavedGuide {
  if (!value?.startsWith(PREFIX)) return { text: value || '', rules: [] };
  try {
    const parsed: unknown = JSON.parse(value.slice(PREFIX.length));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid guide');
    const record = parsed as Record<string, unknown>;
    if (typeof record.text !== 'string' || !Array.isArray(record.rules) || record.rules.length > GUIDE_RULE_KEYS.length || !record.rules.every(isRule)) throw new Error('Invalid guide');
    return { text: record.text, rules: record.rules };
  } catch { throw new Error('Saved guide could not be read'); }
}

export function saveGuideEnvelope(text: string, rules: ReviewedGuideRule[]): string | null {
  const normalized = normalizeUniversityPolicy(text);
  if (!normalized || rules.length > GUIDE_RULE_KEYS.length || !rules.every(isRule)
    || new Set(rules.map(rule => rule.key)).size !== rules.length) return null;
  const extracted = extractAcademicStyleProfile(normalized);
  for (const rule of rules) {
    const original = flatRule(extracted, rule.key);
    if (!original || original.evidence !== rule.evidence) return null;
    if (rule.status === 'approved' && !validRuleValue(rule.key, rule.value)) return null;
  }
  const packed = PREFIX + JSON.stringify({ text: normalized, rules });
  return packed.length <= 105_000 ? packed : null;
}

function flatRule(profile: AcademicStyleProfile, key: GuideRuleKey) {
  if (key === 'university_or_journal_name') return profile.university_or_journal_name;
  if (key in profile.language_rules) return profile.language_rules[key as keyof typeof profile.language_rules];
  if (key in profile.page_layout) return profile.page_layout[key as keyof typeof profile.page_layout];
  if (key in profile.document_rules) return profile.document_rules[key as keyof typeof profile.document_rules];
  return profile.citation_style[key as keyof typeof profile.citation_style];
}

function validRuleValue(key: GuideRuleKey, value: string): boolean {
  if (['arabic_font_size_body', 'arabic_font_size_heading_1', 'english_font_size_body'].includes(key)) return /^\d{1,2}(?:\.\d)?$/u.test(value) && +value >= 8 && +value <= 30;
  if (key === 'line_spacing') return ['1', '1.5', '2'].includes(value);
  if (['paragraph_indentation', 'margin_top', 'margin_bottom', 'margin_binding_side', 'margin_other_side'].includes(key)) return /^\d(?:\.\d{1,2})?$/u.test(value) && +value >= (key === 'paragraph_indentation' ? 0 : 0.5) && +value <= (key === 'paragraph_indentation' ? 5 : 8);
  if (key === 'system') return ['APA 7', 'Harvard', 'IEEE', 'Chicago'].includes(value);
  if (key === 'max_words') return /^\d{4,6}$/u.test(value) && +value >= 1000 && +value <= 300000;
  if (key === 'abstract_max_words') return /^\d{2,4}$/u.test(value) && +value >= 50 && +value <= 2000;
  if (key === 'page_numbering') return (PAGE_NUMBER_POSITIONS as readonly string[]).includes(value);
  if (key.includes('font_family')) return ['Simplified Arabic', 'Traditional Arabic', 'Arial', 'Noto Naskh Arabic', 'Amiri', 'Times New Roman', 'Calibri', 'Noto Sans'].includes(value);
  return value.trim().length >= 3 && value.length <= 120 && !/[<>\u0000-\u001f]/u.test(value);
}

export function approvedStyleProfile(guide: SavedGuide): AcademicStyleProfile {
  const extracted = extractAcademicStyleProfile(guide.text);
  const output = structuredClone(extracted);
  for (const key of GUIDE_RULE_KEYS) {
    const rule = guide.rules.find(item => item.key === key && item.status === 'approved');
    const original = flatRule(extracted, key);
    const updated = rule && original?.evidence === rule.evidence && validRuleValue(key, rule.value)
      ? { value: typeof original.value === 'number' ? Number(rule.value) : rule.value, evidence: original.evidence } : null;
    if (key === 'university_or_journal_name') output.university_or_journal_name = updated as typeof output.university_or_journal_name;
    else if (key in output.language_rules) (output.language_rules as Record<string, unknown>)[key] = updated;
    else if (key in output.page_layout) (output.page_layout as Record<string, unknown>)[key] = updated;
    else if (key in output.document_rules) (output.document_rules as Record<string, unknown>)[key] = updated;
    else (output.citation_style as Record<string, unknown>)[key] = updated;
  }
  return output;
}

export function guideRuleCandidates(text: string): ReviewedGuideRule[] {
  const profile = extractAcademicStyleProfile(text);
  return GUIDE_RULE_KEYS.flatMap(key => {
    const found = flatRule(profile, key);
    return found ? [{ key, value: String(found.value), evidence: found.evidence, status: 'review' as const }] : [];
  });
}

export type RuleApplication = 'applied' | 'approximate' | 'not_applied';
/** What src/lib/project-document-export.ts actually does with an approved rule.
 * The PDF embeds its bundled Amiri/Noto fonts, so an arbitrary requested family cannot be honoured there;
 * its line height approximates Word spacing; it has no first-line indent. */
export const GUIDE_RULE_EXPORT: Record<GuideRuleKey, { word: RuleApplication; pdf: RuleApplication }> = {
  university_or_journal_name: { word: 'not_applied', pdf: 'not_applied' },
  arabic_font_family: { word: 'applied', pdf: 'not_applied' },
  arabic_font_size_body: { word: 'applied', pdf: 'applied' },
  arabic_font_size_heading_1: { word: 'applied', pdf: 'applied' },
  english_font_family: { word: 'applied', pdf: 'not_applied' },
  english_font_size_body: { word: 'applied', pdf: 'applied' },
  line_spacing: { word: 'applied', pdf: 'approximate' },
  paragraph_indentation: { word: 'applied', pdf: 'not_applied' },
  margin_top: { word: 'applied', pdf: 'applied' },
  margin_bottom: { word: 'applied', pdf: 'applied' },
  margin_binding_side: { word: 'applied', pdf: 'applied' },
  margin_other_side: { word: 'applied', pdf: 'applied' },
  // Export is refused while the draft uses a different citation style.
  system: { word: 'applied', pdf: 'applied' },
  in_text_format: { word: 'not_applied', pdf: 'not_applied' },
  // Limits are checked against the draft, not applied as formatting.
  max_words: { word: 'not_applied', pdf: 'not_applied' },
  abstract_max_words: { word: 'not_applied', pdf: 'not_applied' },
  // Word places the page number where the guide asks; the PDF keeps its centred footer.
  page_numbering: { word: 'applied', pdf: 'not_applied' },
};

/** Approved rules that Word or PDF does not fully apply, in guide order. */
export function guideExportGaps(guide: SavedGuide) {
  const profile = approvedStyleProfile(guide);
  return GUIDE_RULE_KEYS.flatMap(key => {
    const rule = flatRule(profile, key), use = GUIDE_RULE_EXPORT[key];
    return rule && (use.word !== 'applied' || use.pdf !== 'applied') ? [{ key, value: String(rule.value), ...use }] : [];
  });
}
