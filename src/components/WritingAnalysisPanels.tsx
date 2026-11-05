'use client';

import { useEffect, useState } from 'react';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { EXTRACTION_FIELDS, EXTRACTION_LABELS, assessmentStillApplies, readWritingAnalysis, relationMismatch, relationMismatchText, type CitationAssessment, type ExtractionKey, type StudyExtraction, type WritingAnalysis } from '@/lib/writing-analysis';
import type { WritingDraft, WritingSource } from '@/lib/evidence-writing';

const COPY = {
  ar: { extracting: 'جارٍ استخراج المعلومات…', evaluating: 'جارٍ مراجعة الاستشهاد…', extraction: 'استخراج معلومات الدراسة', extract: 'استخرج المعلومات من هذا النص', intro: 'مسودة منظمة من النص المتاح، مع المقطع الأصلي لكل معلومة. راجع التفسير قبل استخدامه.', missing: 'غير مذكور في النص المستخدم', use: 'أضف إلى المسودة مع دليله', quote: 'المقطع الأصلي', partial: 'شمل الاستخراج أول جزء من النص المتاح فقط؛ راجع بقية الملف.', assessment: 'تقييم الاستشهادات', choose: 'اختر الاستشهاد', evaluate: 'قيّم علاقة المقطع بالجملة', review: 'اقتراح للمراجعة؛ لا يحل محل حكمك العلمي، ولا يشمل كل الاستشهادات المنشورة في العالم.', apply: 'اعتماد العلاقة المقترحة في مسودتي', saved: 'النتيجة محفوظة في مشروعك', source_missing: 'المصدر لم يعد متاحًا في مشروعك.', text_unavailable: 'النص غير متاح لهذا المرجع. أضف ملفه لتتمكن من تحليله.', source_changed: 'تغير نص المصدر؛ افتحه وأعد ربط المقطع قبل التقييم.', claim_changed: 'تغيرت الجملة؛ راجع ربطها واحفظ الكتابة قبل التقييم.', unsupported_output: 'تعذر مطابقة هذه النتيجة مع مصدرها. أعد محاولة التحليل.', unavailable: 'تعذر إكمال التحليل الآن. نصك ومصادرك محفوظة؛ أعد المحاولة.', saveFirst: 'احفظ الكتابة وروابطها أولًا لتقييم النسخة نفسها.', none: 'اربط جملة بمقطع من مصدرها لتبدأ تقييم الاستشهاد.', relations: { supports: 'يدعم الجملة', contradicts: 'يعارض الجملة', contextual: 'يوضح السياق', unclear: 'العلاقة غير محسومة' }, reason: 'سبب التقييم', limitation: 'حدود التقييم', retry: 'إعادة المحاولة' },
  en: { extracting: 'Extracting study information…', evaluating: 'Reviewing the citation…', extraction: 'Extract study information', extract: 'Extract information from this text', intro: 'A structured draft from available text, with an original passage for each item. Review the interpretation before use.', missing: 'Not reported in the text used', use: 'Add to draft with its evidence', quote: 'Original passage', partial: 'Extraction covered only the first part of the available text; review the rest of the file.', assessment: 'Citation assessment', choose: 'Choose a citation', evaluate: 'Assess how the passage relates to the sentence', review: 'A suggestion for review; it does not replace your scientific judgement or cover every published citation worldwide.', apply: 'Use the suggested relation in my draft', saved: 'Saved in your project', source_missing: 'The source is no longer available in your project.', text_unavailable: 'Text is unavailable for this reference. Add its file to analyse it.', source_changed: 'The source changed. Open it and link the passage again before assessment.', claim_changed: 'The sentence changed. Review its link and save the writing before assessment.', unsupported_output: 'We could not match this result to its source. Please retry the analysis.', unavailable: 'We could not complete the analysis. Your writing and sources remain saved; please retry.', saveFirst: 'Save your writing and links first so the assessment uses the same version.', none: 'Link a sentence to its source passage to start assessing a citation.', relations: { supports: 'Supports the sentence', contradicts: 'Contradicts the sentence', contextual: 'Provides context', unclear: 'Relation is unclear' }, reason: 'Reason', limitation: 'Assessment limits', retry: 'Retry' },
} as const;
type Params = Record<string, string>;
function useAnalysis(projectId: string, params: Params) {
  const query = new URLSearchParams(params).toString(); const url = `/api/projects/${encodeURIComponent(projectId)}/writing/analysis`;
  const [record, setRecord] = useState<WritingAnalysis | null>(null); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`${url}?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) }).then(async response => {
      const data = await response.json(); if (!active) return;
      if (!response.ok) { setError(data.code || 'unavailable'); return; }
      const restored = data.record && readWritingAnalysis(data.record);
      if (data.record && !restored) { setError('unavailable'); return; }
      setRecord(restored || null);
    }).catch(() => { if (active) setError('unavailable'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, url]);
  async function run() {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch(url, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(125_000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new URLSearchParams(query))) });
      const data = await response.json(); if (!response.ok) { setError(data.code || 'unavailable'); return; }
      const restored = readWritingAnalysis(data.record); if (!restored || data.saved !== true) throw new Error('invalid_receipt');
      setRecord(restored); return restored;
    } catch { setError('unavailable'); } finally { setBusy(false); }
  }
  return { record, busy, loading, error, run };
}
function AnalysisError({ code }: { code: string }) {
  const { language } = useUiTranslation(); const t = COPY[language];
  return code ? <p role="alert" className="mt-3 text-sm leading-7 text-slate-700">{code in t && typeof t[code as keyof typeof t] === 'string' ? t[code as 'source_missing' | 'source_changed' | 'claim_changed' | 'text_unavailable' | 'unsupported_output'] : t.unavailable}</p> : null;
}

export function StudyExtractionPanel({ projectId, source, disabled, onUse, onSaved }: { projectId: string; source: WritingSource; disabled: boolean; onUse: (record: StudyExtraction, key: ExtractionKey) => void; onSaved?: () => void }) {
  const { language } = useUiTranslation(); const t = COPY[language];
  const analysis = useAnalysis(projectId, { operation: 'extraction', sourceKind: source.kind, sourceId: source.id, language });
  const record = analysis.record?.operation === 'extraction' ? analysis.record : null;
  return <section className="mt-5 border-t border-line pt-5" aria-label={t.extraction}>
    <h4 className="text-lg font-bold">{t.extraction}</h4><p className="mt-2 text-sm leading-7 text-slate-600">{t.intro}</p>
    {!record && <button type="button" disabled={disabled || analysis.busy || analysis.loading || !source.text} onClick={() => void analysis.run().then(record => { if (record) onSaved?.(); })} className="mt-3 rounded-xl border border-primary bg-white px-4 py-3 text-sm font-bold text-primary-dark disabled:opacity-50">{analysis.busy || analysis.loading ? t.extracting : t.extract}</button>}
    <AnalysisError code={analysis.error} />
    {record && <><p role="status" className="mt-3 text-sm text-slate-600">{t.saved}</p>{record.scopeEnd < record.sourceLength && <p className="mt-2 text-sm leading-7">{t.partial}</p>}<dl className="mt-4 space-y-4">{EXTRACTION_FIELDS.map(key => { const field = record.fields[key]; return <div key={key} className="min-w-0 rounded-xl border border-line p-4"><dt className="text-sm font-bold">{EXTRACTION_LABELS[language][key]}</dt><dd className="mt-2"><p dir="auto" className="whitespace-pre-wrap break-words text-base leading-8">{field?.value || t.missing}</p>{field && <><details className="mt-3"><summary className="cursor-pointer text-sm font-bold text-primary-dark">{t.quote}</summary><blockquote dir="auto" className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-7">{field.quoteText}</blockquote></details><button type="button" disabled={disabled} onClick={() => onUse(record, key)} className="mt-3 rounded-lg border px-3 py-2 text-sm font-bold text-primary-dark disabled:opacity-50">{t.use}</button></>}</dd></div>; })}</dl></>}
  </section>;
}
function SelectedCitationAssessment({ projectId, documentId, citationId, draft, disabled, onApply }: { projectId: string; documentId: string; citationId: string; draft: WritingDraft; disabled: boolean; onApply: (record: CitationAssessment) => void }) {
  const { language } = useUiTranslation(); const t = COPY[language];
  const analysis = useAnalysis(projectId, { operation: 'citation', documentId, citationId, language });
  const record = analysis.record?.operation === 'citation' ? analysis.record : null;
  return <div>
    {!record && <button type="button" disabled={disabled || analysis.busy || analysis.loading} onClick={() => void analysis.run()} className="mt-3 rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary-dark disabled:opacity-50">{analysis.busy || analysis.loading ? t.evaluating : t.evaluate}</button>}
    <AnalysisError code={analysis.error} />
    {record && <div className="mt-4 space-y-3 rounded-xl border border-line p-4"><p role="status" className="text-sm text-slate-600">{t.saved}</p><h4 className="text-base font-bold">{t.relations[record.relation]}</h4><p className="text-sm font-bold">{t.reason}</p><p dir="auto" className="whitespace-pre-wrap break-words text-base leading-8">{record.rationale}</p><blockquote dir="auto" className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-7">{record.supportingQuote}</blockquote><p className="text-sm font-bold">{t.limitation}</p><p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7">{record.limitation}</p>{(() => { const mismatch = relationMismatch(draft, record); return mismatch && <p className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-950">{relationMismatchText(mismatch, language)}</p>; })()}<button type="button" disabled={disabled || !assessmentStillApplies(draft, record)} onClick={() => onApply(record)} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{t.apply}</button></div>}
  </div>;
}
export function CitationReviewPanel({ projectId, documentId, draft, dirty, saving, onApply }: { projectId: string; documentId: string | null; draft: WritingDraft; dirty: boolean; saving: boolean; onApply: (record: CitationAssessment) => void }) {
  const { language } = useUiTranslation(); const t = COPY[language]; const [selected, setSelected] = useState('');
  const citation = draft.citations.find(c => c.id === selected) || draft.citations[0];
  return <section className="rounded-2xl border border-line bg-white p-5" aria-label={t.assessment}>
    <h3 className="text-xl font-bold">{t.assessment}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{t.review}</p>
    {!citation ? <p className="mt-3 text-sm leading-7">{t.none}</p> : <><label className="mt-4 block text-sm font-bold">{t.choose}<select value={citation.id} onChange={e => setSelected(e.target.value)} className="mt-2 block w-full rounded-xl border bg-white p-3 text-sm">{draft.citations.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.claimText.slice(0, 100)}</option>)}</select></label><p dir="auto" className="mt-3 break-words text-base leading-8">{citation.claimText}</p><blockquote dir="auto" className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-7">{citation.quoteText}</blockquote>
      {dirty || !documentId ? <p className="mt-3 text-sm leading-7">{t.saveFirst}</p> : <SelectedCitationAssessment key={`${documentId}:${citation.id}:${language}`} projectId={projectId} documentId={documentId} citationId={citation.id} draft={draft} disabled={saving} onApply={onApply} />}</>}
  </section>;
}
