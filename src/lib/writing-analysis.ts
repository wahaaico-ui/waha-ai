import { isUuid } from '@/lib/research-evidence';
import { SUPPORT_RELATIONS, type SupportRelation } from '@/lib/research-claims';
import { claimIsAnchored, quoteMatchesSource, safeWritingUrl, type WritingCitation, type WritingDraft, type WritingSource, type SavedWritingCitation } from '@/lib/evidence-writing';
import { readWritingBibliography } from '@/lib/citations/writing-bibliography';
import { appendWritingRichText } from '@/lib/writing-rich-text';
import { scientificNumbersAreGrounded } from '@/lib/scientific-numbers';

export const WRITING_ANALYSIS_TYPE = 'writing-analysis:v1';
export const EXTRACTION_FIELDS = ['objective', 'design', 'sample', 'methods', 'findings', 'limitations'] as const;
export type ExtractionKey = typeof EXTRACTION_FIELDS[number];
export const EXTRACTION_LABELS = {
  ar: { objective: 'هدف الدراسة', design: 'تصميم الدراسة', sample: 'العينة والسياق', methods: 'المنهج والإجراءات', findings: 'النتائج', limitations: 'حدود الدراسة' },
  en: { objective: 'Study objective', design: 'Study design', sample: 'Sample and setting', methods: 'Methods and procedures', findings: 'Findings', limitations: 'Study limitations' },
} as const;
type SourceSnapshot = SavedWritingCitation['source'];
export type ExtractedField = { value: string; quoteText: string; quoteStart: number; quoteEnd: number };
type RecordBase = { language: 'ar' | 'en'; source: SourceSnapshot; sourceHash: string; generatedAt: string };
export type StudyExtraction = RecordBase & { operation: 'extraction'; scopeEnd: number; sourceLength: number; fields: Record<ExtractionKey, ExtractedField | null> };
export type CitationAssessment = RecordBase & { operation: 'citation'; writingDocumentId: string; citationId: string; claimText: string; quoteText: string; supportingQuote: string; relation: SupportRelation; rationale: string; limitation: string };
export type WritingAnalysis = StudyExtraction | CitationAssessment;
const clean = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export function sourceSnapshot(source: WritingSource): SourceSnapshot {
  return { id: source.id, kind: source.kind, title: source.title, origin: source.origin, url: safeWritingUrl(source.url), year: source.year, ...(source.bibliography ? { bibliography: source.bibliography } : {}) };
}
/** Legacy snapshots may lack bibliography, but supplied publication facts must
 * match the source rather than silently using an outdated author or title. */
export function writingSourceSnapshotMatches(saved: SourceSnapshot, source: WritingSource) {
  if (saved.id !== source.id || saved.kind !== source.kind || saved.title !== source.title || saved.year !== source.year || saved.url !== source.url || saved.origin !== source.origin) return false;
  return saved.bibliography === undefined || JSON.stringify(readWritingBibliography(saved.bibliography)) === JSON.stringify(source.bibliography);
}
function parsedOutput(output: string): unknown {
  try { return JSON.parse(output.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); } catch { return null; }
}
/** Keep the validator and the provider prompt on exactly the same evidence. */
export function citationAssessmentContext(source: WritingSource, citation: WritingCitation): string | null {
  if (!quoteMatchesSource(citation, source)) return null;
  return source.text.slice(Math.max(0, citation.quoteStart - 8000), citation.quoteEnd + 8000);
}
/** A returned value needs a verbatim passage; this does not prove its interpretation. */
export function parseExtractionOutput(output: string, source: WritingSource, language: 'ar' | 'en'): StudyExtraction | null {
  const value = parsedOutput(output); if (!object(value) || !object(value.fields)) return null;
  const scopeEnd = Math.min(source.text.length, 60_000); const scope = source.text.slice(0, scopeEnd);
  const fields = {} as StudyExtraction['fields'];
  for (const key of EXTRACTION_FIELDS) {
    const field = value.fields[key];
    if (field === null) { fields[key] = null; continue; }
    if (!object(field) || !clean(field.value, 2000) || !clean(field.quote, 4000)) return null;
    const quoteStart = scope.indexOf(field.quote); if (quoteStart < 0) return null;
    if (!scientificNumbersAreGrounded(field.value, field.quote)) return null;
    fields[key] = { value: field.value.trim(), quoteText: field.quote, quoteStart, quoteEnd: quoteStart + field.quote.length };
  }
  return { operation: 'extraction', language, source: sourceSnapshot(source), sourceHash: source.hash, generatedAt: new Date().toISOString(), scopeEnd, sourceLength: source.text.length, fields };
}
export function parseAssessmentOutput(output: string, source: WritingSource, citation: WritingCitation, writingDocumentId: string, language: 'ar' | 'en'): CitationAssessment | null {
  const context = citationAssessmentContext(source, citation); if (context === null) return null;
  const value = parsedOutput(output);
  if (!object(value) || !SUPPORT_RELATIONS.includes(value.relation as SupportRelation) || !clean(value.rationale, 1800) || !clean(value.limitation, 1800)
    || !clean(value.quote, 4000) || !citation.quoteText.includes(value.quote)) return null;
  if (!scientificNumbersAreGrounded(value.rationale + '\n' + value.limitation, context + '\n' + citation.claimText)) return null;
  return { operation: 'citation', language, source: sourceSnapshot(source), sourceHash: source.hash, generatedAt: new Date().toISOString(), writingDocumentId, citationId: citation.id, claimText: citation.claimText, quoteText: citation.quoteText, supportingQuote: value.quote, relation: value.relation as SupportRelation, rationale: value.rationale.trim(), limitation: value.limitation.trim() };
}
export function readWritingAnalysis(content: unknown): WritingAnalysis | null {
  try {
    const r = typeof content === 'string' ? JSON.parse(content) : content;
    if (!object(r) || !['ar', 'en'].includes(String(r.language)) || !object(r.source) || !isUuid(r.source.id) || !['reference', 'pdf'].includes(String(r.source.kind))
      || !clean(r.source.title, 1000) || typeof r.source.origin !== 'string' || !(r.source.url === null || safeWritingUrl(r.source.url))
      || !(r.source.year === null || Number.isInteger(r.source.year)) || typeof r.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(r.sourceHash)
      || typeof r.generatedAt !== 'string' || !Number.isFinite(Date.parse(r.generatedAt))) return null;
    if (r.source.bibliography !== undefined && !readWritingBibliography(r.source.bibliography)) return null;
    if (r.operation === 'extraction') {
      if (!object(r.fields) || !Number.isSafeInteger(r.scopeEnd) || !Number.isSafeInteger(r.sourceLength) || Number(r.scopeEnd) < 1 || Number(r.scopeEnd) > Number(r.sourceLength) || Number(r.scopeEnd) > 60_000) return null;
      for (const key of EXTRACTION_FIELDS) {
        const f = r.fields[key]; if (f === null) continue;
        if (!object(f) || !clean(f.value, 2000) || !clean(f.quoteText, 4000) || !Number.isSafeInteger(f.quoteStart) || !Number.isSafeInteger(f.quoteEnd)
          || Number(f.quoteStart) < 0 || Number(f.quoteEnd) > Number(r.scopeEnd) || Number(f.quoteEnd) - Number(f.quoteStart) !== f.quoteText.length) return null;
      }
    } else if (r.operation === 'citation') {
      if (!isUuid(r.writingDocumentId) || !isUuid(r.citationId) || !clean(r.claimText, 4000) || !clean(r.quoteText, 4000) || !clean(r.supportingQuote, 4000)
        || !r.quoteText.includes(r.supportingQuote) || !SUPPORT_RELATIONS.includes(r.relation as SupportRelation) || !clean(r.rationale, 1800) || !clean(r.limitation, 1800)) return null;
    } else return null;
    return r as unknown as WritingAnalysis;
  } catch { return null; }
}

/** Stored model output is checked against the current owned source, too. */
export function readGroundedWritingAnalysis(content: unknown, source: WritingSource, citation?: WritingCitation): WritingAnalysis | null {
  const record = readWritingAnalysis(content);
  if (!record || !writingSourceSnapshotMatches(record.source, source) || record.sourceHash !== source.hash) return null;
  if (record.operation === 'extraction') {
    if (citation || record.sourceLength !== source.text.length || record.scopeEnd !== Math.min(source.text.length, 60_000)) return null;
    for (const key of EXTRACTION_FIELDS) {
      const field = record.fields[key]; if (!field) continue;
      if (source.text.slice(field.quoteStart, field.quoteEnd) !== field.quoteText) return null;
      if (!scientificNumbersAreGrounded(field.value, field.quoteText)) return null;
    }
  } else {
    if (!citation || record.citationId !== citation.id || record.claimText !== citation.claimText || record.quoteText !== citation.quoteText) return null;
    const parsed = parseAssessmentOutput(JSON.stringify({ relation: record.relation, rationale: record.rationale, limitation: record.limitation, quote: record.supportingQuote }), source, citation, record.writingDocumentId, record.language);
    if (!parsed) return null;
  }
  return record;
}

export function extractionIntoDraft(draft: WritingDraft, record: StudyExtraction, key: ExtractionKey): WritingDraft | null {
  const field = record.fields[key]; if (!field) return null;
  const prefix = draft.text ? '\n\n' : ''; const start = draft.text.length + prefix.length;
  const richText = appendWritingRichText(draft.richText, draft.text, field.value);
  return { ...draft, ...(richText ? { richText } : {}), text: draft.text + prefix + field.value, citations: [...draft.citations, { id: crypto.randomUUID(), claimStart: start, claimEnd: start + field.value.length, claimText: field.value, sourceKind: record.source.kind, sourceId: record.source.id, sourceHash: record.sourceHash, quoteStart: field.quoteStart, quoteEnd: field.quoteEnd, quoteText: field.quoteText, relation: 'contextual', note: record.language === 'ar' ? 'معلومة مستخرجة؛ راجع تفسير المقطع وعلاقته بالجملة.' : 'Extracted information; review the passage interpretation and its relation to the sentence.' }] };
}
export function assessmentStillApplies(draft: WritingDraft, assessment: CitationAssessment) {
  const c = draft.citations.find(c => c.id === assessment.citationId);
  return Boolean(c && claimIsAnchored(draft.text, c) && c.sourceId === assessment.source.id && c.sourceKind === assessment.source.kind && c.sourceHash === assessment.sourceHash && c.claimText === assessment.claimText && c.quoteText === assessment.quoteText);
}
/** The relation the researcher kept differs from the saved suggestion; the citation still reads as the researcher chose. */
export function relationMismatch(draft: WritingDraft, assessment: CitationAssessment) {
  const c = draft.citations.find(c => c.id === assessment.citationId);
  return c && assessmentStillApplies(draft, assessment) && c.relation !== assessment.relation ? { researcher: c.relation, suggested: assessment.relation } : null;
}
const RELATION_NAMES = { ar: { supports: 'يدعم', contradicts: 'يعارض', contextual: 'سياق', unclear: 'غير محسوم' }, en: { supports: 'Supports', contradicts: 'Contradicts', contextual: 'Context', unclear: 'Unclear' } } as const;
export function relationMismatchText(mismatch: { researcher: SupportRelation; suggested: SupportRelation }, language: 'ar' | 'en') {
  const names = RELATION_NAMES[language];
  return language === 'ar'
    ? `تنبيه: العلاقة التي حددتها «${names[mismatch.researcher]}»، والعلاقة المقترحة في التقييم «${names[mismatch.suggested]}». راجع الإحالة قبل التسليم.`
    : `Warning: the relation you set is “${names[mismatch.researcher]}”; the assessment suggests “${names[mismatch.suggested]}”. Review this citation before submission.`;
}
export function analysisExportSections(records: WritingAnalysis[], language: 'ar' | 'en', draft?: WritingDraft | null) {
  const ar = language === 'ar';
  return records.map(r => r.operation === 'extraction' ? {
    title: `${ar ? 'معلومات الدراسة' : 'Study information'} — ${r.source.title}`,
    paragraphs: [ar ? 'مسودة استخراج من النص المتاح؛ تحتاج مراجعة الباحث.' : 'Extraction draft from available text; researcher review is required.',
      ...(r.scopeEnd < r.sourceLength ? [ar ? 'شمل الاستخراج جزءًا من النص المتاح فقط.' : 'Extraction covered only part of the available text.'] : []),
      ...EXTRACTION_FIELDS.flatMap(key => { const f = r.fields[key]; return [`${EXTRACTION_LABELS[language][key]}: ${f?.value || (ar ? 'غير مذكور في النص المستخدم' : 'Not reported in the text used')}`, ...(f ? [`${ar ? 'المقطع الأصلي' : 'Original passage'}: ${f.quoteText}`] : [])]; }),
    ],
  } : {
    title: `${ar ? 'اقتراح تقييم الاستشهاد' : 'Suggested citation assessment'} — ${r.source.title}`,
    paragraphs: [...(() => { const m = draft ? relationMismatch(draft, r) : null; return m ? [relationMismatchText(m, language)] : []; })(),
      r.claimText, `${ar ? 'المقطع الأصلي' : 'Original passage'}: ${r.supportingQuote}`, `${ar ? 'العلاقة المقترحة' : 'Suggested relation'}: ${RELATION_NAMES[language][r.relation]}`, r.rationale, r.limitation, ar ? 'اقتراح من الذكاء الاصطناعي، وليس حكمًا نهائيًا أو إحصاءً لاستشهادات العالم.' : 'An AI suggestion, not a final judgement or a global citation count.'],
  });
}
