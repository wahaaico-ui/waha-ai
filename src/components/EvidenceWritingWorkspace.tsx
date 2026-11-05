'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useAuthSession } from '@/components/AuthSessionProvider';
import ProjectExportButton from '@/components/ProjectExportButton';
import GuideWritingPanel from '@/components/GuideWritingPanel';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { claimIsAnchored, parseWritingDraft, quoteMatchesSource, readSavedWriting, rebaseWritingCitations, type SavedWritingDraft, type WritingCitation, type WritingDraft, type WritingSource, type WritingSourceKind } from '@/lib/evidence-writing';
import { CITATION_STYLES, WRITING_STYLE_LABELS, type CitationStyle } from '@/lib/citations/types';
import type { SupportRelation } from '@/lib/research-claims';
import { CitationReviewPanel, StudyExtractionPanel } from '@/components/WritingAnalysisPanels';
import { assessmentStillApplies, extractionIntoDraft, readGroundedWritingAnalysis, type ExtractionKey, type StudyExtraction } from '@/lib/writing-analysis';
import PdfSourceUpload from '@/components/PdfSourceUpload';
import { clearMatchingWritingRecovery, persistWritingRecovery, readWritingSaveReceipt, restoreWritingWorkspace, type RecoveryStorage, type WritingVersion } from '@/lib/writing-recovery';

const WritingCitationPreview = dynamic(() => import('@/components/WritingCitationPreview'));
const ResearchTextEditor = dynamic(() => import('@/components/ResearchTextEditor'), { ssr: false });
const PdfEvidenceReader = dynamic(() => import('@/components/PdfEvidenceReader'), { ssr: false });
const StudyComparisonPanel = dynamic(() => import('@/components/StudyComparisonPanel'));

const CONTENT = {
  ar: {
    title: 'اكتب واربط كلامك بدليله', intro: 'حدد جملة من مسودتك، وافتح مصدرًا محفوظًا، ثم اختر المقطع الذي ستستند إليه. تظل الكتابة والمقاطع ومراجعاتك داخل مشروعك.',
    loading: 'جارٍ استرجاع الكتابة…', loadError: 'تعذر استرجاع الكتابة. أعد المحاولة.', retry: 'إعادة المحاولة',
    draft: 'مسودتك', chooseClaim: 'حدد الجملة التي تريد ربطها بالدليل.', selectedClaim: 'الجملة المختارة',
    references: 'مراجع المكتبة', pdfs: 'ملفات المشروع', source: 'المصدر', open: 'افتح المصدر', more: 'عرض مصادر إضافية', noSources: 'أضف مراجع أو ملفات إلى مشروعك لتختار منها الدليل.',
    sourceText: 'النص المتاح من المصدر', abstract: 'مستخلص متاح', extracted: 'نص ملف مستخرج', unavailable: 'النص غير متاح لهذا المرجع. يمكنك إضافة ملفه النصي إلى مشروعك.', chooseQuote: 'حدد المقطع الداعم من هذا النص.', selectedQuote: 'المقطع المختار',
    relation: 'علاقة المقطع بالجملة حسب مراجعتك', relations: { supports: 'يدعمها', contradicts: 'يعارضها', contextual: 'يوضح السياق', unclear: 'غير محسومة' },
    note: 'تفسيرك للعلاقة (اختياري)', attach: 'اربط المقطع بالجملة', saved: 'محفوظ في مشروعك', unsaved: 'تعديلات لم تُحفظ', saving: 'جارٍ الحفظ…', save: 'حفظ الكتابة والأدلة',
    preview: 'راجع النص وإحالاته', evidence: 'الدليل', linked: 'مرتبط بنصك', needsReview: 'تغير نص الجملة أو موضعها؛ راجع الربط.', remove: 'إزالة الربط', origin: 'مقطع من نص محفوظ؛ العلاقة يحددها الباحث.',
    local: 'استرجعنا تعديلات لم تُحفظ من هذه الجلسة.', failedSave: 'تعذر الحفظ. نصك باقٍ؛ أعد المحاولة.', sourceChanged: 'تغير نص المصدر. افتحه وحدد المقطع مجددًا قبل الحفظ.', sourceMissing: 'المصدر لم يعد متاحًا. أزل الربط أو اختر مصدرًا آخر.', versionConflict: 'توجد نسخة أحدث. احتفظ بنصك وراجع النسخ المحفوظة قبل الحفظ.',
    sourceError: 'تعذر فتح المصدر. أعد المحاولة.', duplicate: 'هذا المقطع مرتبط بالجملة بالفعل.', invalidLink: 'اختر جملة ومقطعًا واضحين لا يتداخلان مع ربط آخر. يمكن ربط عدة مصادر بالجملة نفسها.',
    history: 'آخر النسخ المحفوظة', original: 'فتح المصدر الأصلي', library: 'إضافة مراجع إلى المكتبة', files: 'إضافة ملف إلى المشروع', line: 'الأسطر', sourceSelection: 'اختر مصدرًا',
    inspectLatest: 'عرض آخر نسخة محفوظة', latestTitle: 'آخر نص محفوظ في المشروع', continueCurrent: 'تابع بنصي الحالي كنسخة جديدة',
    selectionTooLong: 'اختر جملة ومقطعًا أقصر؛ حتى 4000 حرف لكل منهما.',
    origins: { server_discovered: 'نص من نتيجة بحث محفوظة', uploaded_text: 'نص محفوظ من ملفك', zotero_import: 'مرجع مستورد من Zotero', user_asserted: 'مرجع أدخلته بنفسك', legacy_client_submitted: 'مرجع محفوظ سابقًا' },
  },
  en: {
    title: 'Write with your evidence in view', intro: 'Select a sentence in your draft, open a saved source, then select the passage you want to use. Keep your writing, passages and review together in your project.',
    loading: 'Restoring your writing…', loadError: 'We could not restore your writing. Please retry.', retry: 'Retry',
    draft: 'Your draft', chooseClaim: 'Select the sentence you want to link to evidence.', selectedClaim: 'Selected sentence',
    references: 'Library references', pdfs: 'Project files', source: 'Source', open: 'Open source', more: 'Show more sources', noSources: 'Add references or files to your project to choose evidence from them.',
    sourceText: 'Available source text', abstract: 'Available abstract', extracted: 'Extracted file text', unavailable: 'Text is unavailable for this reference. You can add its text-based file to your project.', chooseQuote: 'Select the passage you want to use from this text.', selectedQuote: 'Selected passage',
    relation: 'How the passage relates to the sentence, in your judgement', relations: { supports: 'Supports it', contradicts: 'Contradicts it', contextual: 'Provides context', unclear: 'Unclear' },
    note: 'Explain the relation (optional)', attach: 'Link passage to sentence', saved: 'Saved in your project', unsaved: 'Unsaved changes', saving: 'Saving…', save: 'Save writing and evidence',
    preview: 'Review text and linked passages', evidence: 'Evidence', linked: 'Linked to your text', needsReview: 'The sentence or its position changed; review this link.', remove: 'Remove link', origin: 'A passage from saved text; the researcher assigns its relation.',
    local: 'We restored unsaved changes from this browser session.', failedSave: 'We could not save. Your text remains here; please retry.', sourceChanged: 'The source text changed. Open it and select the passage again before saving.', sourceMissing: 'The source is unavailable. Remove this link or choose another source.', versionConflict: 'A newer version exists. Keep your text and review saved versions before saving.',
    sourceError: 'We could not open the source. Please retry.', duplicate: 'This passage is already linked to the sentence.', invalidLink: 'Select a clear sentence and passage without partially overlapping another link. Several sources can link to the same sentence.',
    history: 'Recent saved versions', original: 'Open original source', library: 'Add references to the library', files: 'Add a project file', line: 'Lines', sourceSelection: 'Choose a source',
    inspectLatest: 'Show the latest saved version', latestTitle: 'Latest saved project text', continueCurrent: 'Continue with my text as a new version',
    selectionTooLong: 'Choose a shorter sentence and passage, up to 4000 characters each.',
    origins: { server_discovered: 'Text from a saved search result', uploaded_text: 'Saved text from your file', zotero_import: 'Reference imported from Zotero', user_asserted: 'Reference you entered', legacy_client_submitted: 'Previously saved reference' },
  },
} as const;
type Selection = { start: number; end: number; text: string };
type Version = WritingVersion;
type SourceItem = { id: string; title: string; kind: WritingSourceKind; year: number | null };
const EMPTY: WritingDraft = { text: '', citations: [] };

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000), ...init });
  return { response, data: await response.json() };
}

export default function EvidenceWritingWorkspace({ projectId }: { projectId: string }) {
  const { user } = useAuthSession();
  return <EvidenceWritingWorkspaceContent key={`${user?.id || 'guest'}:${projectId}`} projectId={projectId} />;
}
function EvidenceWritingWorkspaceContent({ projectId }: { projectId: string }) {
  const { language } = useUiTranslation(); const t = CONTENT[language];
  const { user } = useAuthSession();
  const base = `/api/projects/${encodeURIComponent(projectId)}/writing`;
  const cacheKey = user ? `waha-writing:${user.id}:${projectId}` : '';
  const recoveryStorage: RecoveryStorage | null = cacheKey ? { read: () => sessionStorage.getItem(cacheKey), write: raw => sessionStorage.setItem(cacheKey, raw), clear: () => sessionStorage.removeItem(cacheKey) } : null;
  const [draft, setDraft] = useState<WritingDraft>(EMPTY);
  const [versions, setVersions] = useState<Version[]>([]);
  const [baseDocumentId, setBaseDocumentId] = useState<string | null>(null);
  const [knownSources, setKnownSources] = useState<Record<string, WritingSource | SavedWritingDraft['citations'][number]['source']>>({});
  const [loading, setLoading] = useState(true); const [loadFailed, setLoadFailed] = useState(false); const [reload, setReload] = useState(0);
  const [resolvedFor, setResolvedFor] = useState<string | null>(null); const [listReload, setListReload] = useState(0);
  const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('');
  const [serverUnavailable, setServerUnavailable] = useState(false); const [localUnavailable, setLocalUnavailable] = useState(false);
  const [conflict, setConflict] = useState<Version | null>(null); const [conflictBusy, setConflictBusy] = useState(false);
  const [claim, setClaim] = useState<Selection | null>(null); const [quote, setQuote] = useState<Selection | null>(null);
  const [kind, setKind] = useState<WritingSourceKind>('reference'); const [items, setItems] = useState<SourceItem[]>([]); const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [listBusy, setListBusy] = useState(true); const [listError, setListError] = useState(false); const [sourceId, setSourceId] = useState('');
  const [source, setSource] = useState<WritingSource | null>(null); const [sourceBusy, setSourceBusy] = useState(false); const [sourceError, setSourceError] = useState(false);
  const [relation, setRelation] = useState<SupportRelation>('supports'); const [note, setNote] = useState('');
  const [comparisonRevision, setComparisonRevision] = useState(0);
  const sourceEpoch = useRef(0); const listEpoch = useRef(0); const sourceTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    const storage: RecoveryStorage | null = cacheKey ? { read: () => sessionStorage.getItem(cacheKey), write: raw => sessionStorage.setItem(cacheKey, raw), clear: () => sessionStorage.removeItem(cacheKey) } : null;
    restoreWritingWorkspace(base, storage).then(({ versions: saved, local: restored, serverUnavailable }) => {
      if (!active) return;
      const latest = saved[0]; setVersions(saved); setBaseDocumentId(latest?.documentId || null);
      setKnownSources(Object.fromEntries([...saved].reverse().flatMap(v => v.citations.map(c => [c.id, c.source]))));
      if (restored) setBaseDocumentId(restored.baseDocumentId);
      setServerUnavailable(serverUnavailable);
      setDraft(restored || latest || EMPTY); setDirty(Boolean(restored)); setNotice(restored ? 'local' : ''); setLoadFailed(false);
    }).catch(() => { if (active) setLoadFailed(true); }).finally(() => { if (active) { setLoading(false); setResolvedFor(cacheKey); } });
    return () => { active = false; };
  }, [base, cacheKey, reload]);

  useEffect(() => {
    let active = true;
    listEpoch.current++;
    requestJson(`${base}/sources?kind=${kind}`).then(({ response, data }) => {
      if (!active) return;
      if (!response.ok || !Array.isArray(data.items)) throw new Error('sources_failed');
      setItems(data.items); setNextOffset(data.nextOffset); setListError(false);
    }).catch(() => { if (active) setListError(true); }).finally(() => { if (active) setListBusy(false); });
    return () => { active = false; };
  }, [base, kind, listReload]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => () => { sourceEpoch.current++; listEpoch.current++; }, []);

  function update(value: WritingDraft) {
    setDraft(value); setDirty(true); setNotice('');
    setLocalUnavailable(!persistWritingRecovery(recoveryStorage, value, baseDocumentId));
  }
  function changeKind(value: WritingSourceKind) {
    if (value === kind) return;
    listEpoch.current++;
    sourceEpoch.current++; setKind(value); setItems([]); setNextOffset(null); setListBusy(true); setSourceId(''); setSource(null); setQuote(null); setSourceError(false); setSourceBusy(false);
  }
  async function moreSources() {
    if (nextOffset === null || listBusy) return;
    setListBusy(true); setListError(false);
    const epoch = listEpoch.current;
    try { const { response, data } = await requestJson(`${base}/sources?kind=${kind}&offset=${nextOffset}`); if (epoch !== listEpoch.current) return; if (!response.ok) throw new Error('list_failed'); setItems(previous => [...previous, ...data.items.filter((item: SourceItem) => !previous.some(p => p.id === item.id))]); setNextOffset(data.nextOffset); }
    catch { if (epoch === listEpoch.current) setListError(true); } finally { if (epoch === listEpoch.current) setListBusy(false); }
  }
  async function openSource(sourceKind: WritingSourceKind, id: string, linked?: WritingCitation, extraction?: { record: StudyExtraction; key: ExtractionKey }) {
    if (!id) return;
    const epoch = ++sourceEpoch.current; setSourceBusy(true); setSourceError(false); setQuote(null); setSource(null); setSourceId(id);
    try {
      const { response, data } = await requestJson(`${base}/sources?kind=${sourceKind}&sourceId=${encodeURIComponent(id)}`);
      if (epoch !== sourceEpoch.current) return;
      if (!response.ok) throw new Error('source_failed');
      setSource(data.source);
      if (linked) setKnownSources(previous => ({ ...previous, [linked.id]: data.source }));
      if (linked && quoteMatchesSource(linked, data.source)) {
        setQuote({ start: linked.quoteStart, end: linked.quoteEnd, text: linked.quoteText });
        requestAnimationFrame(() => { const reader = sourceTextRef.current; if (reader) { reader.focus(); reader.setSelectionRange(linked.quoteStart, linked.quoteEnd); } });
      } else if (linked) setNotice('sourceChanged');
      if (extraction) {
        const valid = readGroundedWritingAnalysis(extraction.record, data.source);
        const field = valid?.operation === 'extraction' && valid.fields[extraction.key];
        if (field) {
          setQuote({ start: field.quoteStart, end: field.quoteEnd, text: field.quoteText });
          requestAnimationFrame(() => { const reader = sourceTextRef.current; if (reader) { reader.focus(); reader.setSelectionRange(field.quoteStart, field.quoteEnd); } });
        } else setNotice('sourceChanged');
      }
    } catch { if (epoch === sourceEpoch.current) setSourceError(true); }
    finally { if (epoch === sourceEpoch.current) setSourceBusy(false); }
  }
  function showCitation(c: WritingCitation) { setKind(c.sourceKind); setClaim(claimIsAnchored(draft.text, c) ? { start: c.claimStart, end: c.claimEnd, text: c.claimText } : null); void openSource(c.sourceKind, c.sourceId, c); }
  function useExtraction(record: StudyExtraction, key: ExtractionKey) {
    const next = extractionIntoDraft(draft, record, key); const parsed = next && parseWritingDraft(next);
    if (!parsed) { setNotice('invalidLink'); return; }
    const added = parsed.citations[parsed.citations.length - 1]; setKnownSources(previous => ({ ...previous, [added.id]: record.source })); update(parsed);
  }
  function attach() {
    if (!claim || !quote || !source) return;
    if (claim.text.length > 4000 || quote.text.length > 4000) { setNotice('selectionTooLong'); return; }
    const previous = draft.citations.find(c => c.claimStart === claim.start && c.claimEnd === claim.end && c.sourceId === source.id && c.sourceKind === source.kind && c.quoteStart === quote.start && c.quoteEnd === quote.end);
    if (previous?.sourceHash === source.hash) { setNotice('duplicate'); return; }
    const c: WritingCitation = { id: previous?.id || crypto.randomUUID(), claimStart: claim.start, claimEnd: claim.end, claimText: claim.text, sourceId: source.id, sourceKind: source.kind, sourceHash: source.hash, quoteStart: quote.start, quoteEnd: quote.end, quoteText: quote.text, relation, note };
    const updated = parseWritingDraft({ ...draft, citations: previous ? draft.citations.map(item => item.id === c.id ? c : item) : [...draft.citations, c] });
    if (!updated) { setNotice('invalidLink'); return; }
    setKnownSources(previous => ({ ...previous, [c.id]: source })); update(updated); setNote('');
  }
  async function save() {
    if (saving) return; setSaving(true); setNotice('');
    try {
      const { response, data } = await requestJson(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, baseDocumentId }) });
      if (!response.ok) { setNotice(data.code === 'version_conflict' ? 'versionConflict' : data.code === 'source_changed' ? 'sourceChanged' : data.code === 'source_missing' ? 'sourceMissing' : 'failedSave'); return; }
      const version = readWritingSaveReceipt(data, draft); if (!version) throw new Error('invalid_receipt');
      const parsed = readSavedWriting(version)!;
      setDraft(parsed); setBaseDocumentId(data.documentId); setKnownSources(previous => ({ ...previous, ...Object.fromEntries(parsed.citations.map(c => [c.id, c.source])) }));
      setVersions(previous => [version, ...previous.filter(v => v.documentId !== version.documentId)].slice(0, 20)); setDirty(false);
      clearMatchingWritingRecovery(recoveryStorage, draft, baseDocumentId); setServerUnavailable(false); setLocalUnavailable(false);
    } catch { setNotice('failedSave'); } finally { setSaving(false); }
  }
  async function inspectLatest() {
    setConflictBusy(true);
    try {
      const { response, data } = await requestJson(base);
      if (!response.ok || !Array.isArray(data.versions) || !data.versions[0]) throw new Error('latest_unavailable');
      const latest = data.versions[0]; const parsed = readSavedWriting(latest);
      if (!parsed) throw new Error('invalid_latest');
      setConflict({ ...parsed, documentId: latest.documentId, savedAt: latest.savedAt });
    } catch { setNotice('failedSave'); } finally { setConflictBusy(false); }
  }
  function continueCurrent() {
    if (!conflict) return;
    setBaseDocumentId(conflict.documentId); setConflict(null); setNotice(''); setDirty(true);
    setLocalUnavailable(!persistWritingRecovery(recoveryStorage, draft, conflict.documentId));
  }

  if (loading || resolvedFor !== cacheKey) return <p role="status" className="text-sm">{t.loading}</p>;
  if (loadFailed) return <section role="alert" className="rounded-2xl border bg-white p-5"><p>{t.loadError}</p><button type="button" onClick={() => { setLoading(true); setReload(v => v + 1); }} className="mt-3 rounded-xl bg-primary px-5 py-3 font-bold text-white">{t.retry}</button></section>;
  return <section className="space-y-5">
    <header className="rounded-2xl border border-line bg-white p-5"><h2 className="text-2xl font-bold">{t.title}</h2><p className="mt-3 text-base leading-8 text-slate-600">{t.intro}</p></header>
    {serverUnavailable && <p role="status" className="rounded-xl border border-line bg-white p-4 text-sm leading-7">{language === 'ar' ? 'استرجعنا نسختك من هذه الجلسة. لم نتصل بالمشروع بعد؛ يمكنك متابعة الكتابة والمحاولة مجددًا للحفظ عند عودة الاتصال.' : 'We restored your copy from this session. We could not reach your project yet. You can keep writing and retry saving when the connection returns.'}</p>}
    {localUnavailable && <p role="alert" className="rounded-xl border border-line bg-white p-4 text-sm leading-7">{language === 'ar' ? 'تعديلاتك ظاهرة هنا، لكن تعذر الاحتفاظ بنسخة منها في هذا المتصفح. احفظها في المشروع أو انسخها قبل مغادرة الصفحة.' : 'Your edits are visible here, but this browser could not keep a recovery copy. Save them to your project or copy them before leaving this page.'}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-line bg-white p-5">
        <label htmlFor="evidence-draft" className="text-base font-bold">{t.draft}</label>
        <label className="mt-4 block text-sm font-bold">{language === 'ar' ? 'نمط الإحالات والمراجع' : 'Citation and reference style'}<select value={draft.citationStyle || 'apa-7'} disabled={saving} onChange={e => update({ ...draft, citationStyle: e.target.value as CitationStyle })} className="mt-2 block w-full rounded-xl border bg-white p-3 text-sm">{CITATION_STYLES.map(style => <option key={style} value={style}>{WRITING_STYLE_LABELS[style]}</option>)}</select></label>
        <ResearchTextEditor id="evidence-draft" label={t.draft} text={draft.text} richText={draft.richText} language={language} disabled={saving} onChange={(text, richText) => { update({ ...draft, text, richText, citations: rebaseWritingCitations(draft.text, text, draft.citations) }); setClaim(null); }} onSelection={setClaim} />
        <div className="mt-4"><GuideWritingPanel projectId={projectId} draftText={draft.text} language={language} citationStyle={draft.citationStyle || 'apa-7'} citationCount={draft.citations.length} linkedCount={draft.citations.filter(c => claimIsAnchored(draft.text, c)).length} /></div>
        <p className="mt-3 text-sm leading-7 text-slate-600">{t.chooseClaim}</p>
        {claim && <div className="mt-3 rounded-xl bg-primary-tint p-4"><h3 className="text-sm font-bold">{t.selectedClaim}</h3><p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-base leading-8">{claim.text}</p></div>}
        <button type="button" disabled={saving || (!dirty && !draft.citations.some(c => c.sourceKind === 'reference' && !(c as SavedWritingDraft['citations'][number]).source?.bibliography))} onClick={() => void save()} className="mt-5 min-h-12 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? t.saving : t.save}</button>
        <p role="status" className="mt-2 text-sm text-slate-600">{dirty ? t.unsaved : versions.length ? t.saved : ''}</p>
        {versions.length > 1 && <label className="mt-4 block text-sm font-bold">{t.history}<select disabled={dirty || saving} value={dirty ? '' : baseDocumentId || ''} onChange={e => { const v = versions.find(item => item.documentId === e.target.value); if (v) update(v); }} className="mt-2 block w-full rounded-xl border p-3 text-sm"><option value="">{t.history}</option>{versions.map(v => <option key={v.documentId} value={v.documentId}>{new Date(v.savedAt).toLocaleString(language)}</option>)}</select></label>}
      </section>
      <section className="min-w-0 rounded-2xl border border-line bg-white p-5">
        <fieldset disabled={saving} className="min-w-0"><legend className="text-base font-bold">{t.source}</legend><div className="mt-3 flex flex-wrap gap-3"><button type="button" aria-pressed={kind === 'reference'} onClick={() => changeKind('reference')} className="rounded-xl border px-4 py-3 text-sm font-bold aria-pressed:border-primary aria-pressed:bg-primary-tint">{t.references}</button><button type="button" aria-pressed={kind === 'pdf'} onClick={() => changeKind('pdf')} className="rounded-xl border px-4 py-3 text-sm font-bold aria-pressed:border-primary aria-pressed:bg-primary-tint">{t.pdfs}</button></div>
          <label className="mt-4 block text-sm font-bold">{t.sourceSelection}<select value={sourceId} onChange={e => { sourceEpoch.current++; setSourceId(e.target.value); setSource(null); setQuote(null); setSourceError(false); setSourceBusy(false); }} className="mt-2 block w-full rounded-xl border bg-white p-3 text-sm"><option value="">{t.sourceSelection}</option>{sourceId && !items.some(i => i.id === sourceId) && source && <option value={sourceId}>{source.title}</option>}{items.map(item => <option key={item.id} value={item.id}>{item.title}{item.year ? ` (${item.year})` : ''}</option>)}</select></label>
          <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!sourceId || sourceBusy} onClick={() => void openSource(kind, sourceId)} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sourceBusy ? t.loading : t.open}</button>{nextOffset !== null && <button type="button" disabled={listBusy} onClick={() => void moreSources()} className="rounded-xl border px-4 py-3 text-sm font-bold">{t.more}</button>}</div>
        </fieldset>
        {kind === 'pdf' && <PdfSourceUpload projectId={projectId} language={language} disabled={saving} onSaved={({ sourceId: id }) => { setListReload(v => v + 1); void openSource('pdf', id); }} />}
        {listError && <div role="alert" className="mt-3 text-sm"><p>{t.sourceError}</p><button type="button" onClick={() => { setListBusy(true); setListReload(v => v + 1); }} className="mt-2 rounded-lg border px-3 py-2 font-bold">{t.retry}</button></div>}{listBusy && !items.length && <p role="status" className="mt-3 text-sm">{t.loading}</p>}
        {!listBusy && !listError && !items.length && <p className="mt-3 text-sm leading-7 text-slate-600">{t.noSources}</p>}
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-primary-dark"><Link href={`/research/library?projectId=${encodeURIComponent(projectId)}`}>{t.library}</Link><Link href={`/projects/workspace?projectId=${encodeURIComponent(projectId)}`}>{t.files}</Link></div>
        {sourceError && <p role="alert" className="mt-3 text-sm">{t.sourceError}</p>}
        {source && <div className="mt-5 border-t border-line pt-4"><h3 className="break-words text-base font-bold">{source.title}</h3><p className="mt-1 text-sm text-slate-600">{source.kind === 'reference' ? t.abstract : t.extracted}</p><p className="mt-1 text-xs text-slate-500">{t.origins[source.origin as keyof typeof t.origins]}</p>
          {source.pdf && <PdfEvidenceReader key={`${source.id}:${source.pdf.fileHash}`} projectId={projectId} sourceId={source.id} sourceText={source.text} info={source.pdf} quote={quote} language={language} onSelect={setQuote} />}
          {source.kind === 'pdf' && !source.pdf && <p className="mt-3 text-sm leading-7 text-slate-600">{language === 'ar' ? 'المتاح لهذا الملف نص محفوظ فقط. أضف ملف PDF الأصلي لعرض صفحاته وربط المقاطع بها.' : 'Only saved text is available for this file. Add the original PDF to view its pages and link passages to them.'}</p>}
          {source.text ? <><label htmlFor="writing-source-text" className="mt-3 block text-sm font-bold">{t.sourceText}</label><textarea ref={sourceTextRef} id="writing-source-text" dir="auto" readOnly rows={9} value={source.text} onSelect={e => { const el = e.currentTarget; if (el.selectionEnd > el.selectionStart) setQuote({ start: el.selectionStart, end: el.selectionEnd, text: el.value.slice(el.selectionStart, el.selectionEnd) }); }} className="mt-2 block w-full min-w-0 resize-y rounded-xl border bg-slate-50 p-4 text-base leading-8" /><p className="mt-2 text-sm leading-7 text-slate-600">{t.chooseQuote}</p></> : <p className="mt-3 text-sm leading-7">{t.unavailable}</p>}
          {quote && <div className="mt-3 rounded-xl bg-primary-tint p-4"><h4 className="text-sm font-bold">{t.selectedQuote}</h4><blockquote dir="auto" className="mt-2 whitespace-pre-wrap break-words text-base leading-8">{quote.text}</blockquote>{source.pdf && <p className="mt-2 text-sm leading-7 text-slate-600">{language === 'ar' ? 'طابق النص المختار مع الصفحة الأصلية قبل الاستشهاد به؛ قد يختلف ترتيب النص المستخرج في بعض الملفات.' : 'Compare the selected text with the original page before citing it; extracted text order can differ in some files.'}</p>}</div>}
          <label className="mt-4 block text-sm font-bold">{t.relation}<select disabled={saving} value={relation} onChange={e => setRelation(e.target.value as SupportRelation)} className="mt-2 block w-full rounded-xl border bg-white p-3 text-sm">{Object.entries(t.relations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="mt-4 block text-sm font-bold">{t.note}<textarea dir="auto" disabled={saving} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} rows={2} className="mt-2 block w-full rounded-xl border p-3 text-base leading-8" /></label>
          <button type="button" disabled={saving || !claim || !quote || !source.text} onClick={attach} className="mt-4 min-h-12 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{t.attach}</button>
          {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-4 block text-sm font-bold text-primary-dark underline">{t.original}</a>}
          <StudyExtractionPanel key={`${source.kind}:${source.id}:${source.hash}:${language}`} projectId={projectId} source={source} disabled={saving} onUse={useExtraction} onSaved={() => setComparisonRevision(v => v + 1)} />
        </div>}
      </section>
    </div>
    <StudyComparisonPanel projectId={projectId} revision={comparisonRevision + listReload} disabled={saving || loading || loadFailed} onUse={useExtraction} onOpen={item => { setKind(item.kind); void openSource(item.kind, item.id); }} onInspect={(record, key) => { setKind(record.source.kind); void openSource(record.source.kind, record.source.id, undefined, { record, key }); }} />
    {notice && <p role="status" className="rounded-xl border border-line bg-white p-4 text-sm leading-7">{t[notice as 'local' | 'failedSave' | 'sourceChanged' | 'sourceMissing' | 'versionConflict' | 'duplicate' | 'invalidLink' | 'selectionTooLong']}</p>}
    {notice === 'versionConflict' && <button type="button" disabled={conflictBusy} onClick={() => void inspectLatest()} className="rounded-xl border bg-white px-5 py-3 text-sm font-bold text-primary-dark">{conflictBusy ? t.loading : t.inspectLatest}</button>}
    {conflict && <section className="rounded-2xl border border-line bg-white p-5"><h3 className="text-lg font-bold">{t.latestTitle}</h3><textarea dir="auto" readOnly rows={8} value={conflict.text} aria-label={t.latestTitle} className="mt-3 block w-full resize-y rounded-xl border bg-slate-50 p-4 text-base leading-8" /><button type="button" onClick={continueCurrent} className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">{t.continueCurrent}</button></section>}
    <WritingCitationPreview draft={draft} sources={knownSources} language={language} onOpen={showCitation} />
    <ol className="grid gap-4 sm:grid-cols-2">{draft.citations.map((c, index) => <li key={c.id} className="min-w-0 rounded-2xl border border-line bg-white p-5"><h4 className="break-words text-base font-bold [overflow-wrap:anywhere]">{t.evidence} {index + 1} — {knownSources[c.id]?.title || t.source}</h4><p className="mt-2 text-sm text-slate-600">{claimIsAnchored(draft.text, c) ? t.linked : t.needsReview}</p><p dir="auto" className="mt-3 break-words text-sm leading-7">{c.claimText}</p><blockquote dir="auto" className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-base leading-8">{c.quoteText}</blockquote><p className="mt-3 text-sm">{t.relations[c.relation]}</p><PdfCitationPages citation={c} language={language} />{c.note && <p dir="auto" className="mt-2 break-words text-sm leading-7">{c.note}</p>}<p className="mt-2 text-xs leading-6 text-slate-500">{t.origin}</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => showCitation(c)} className="rounded-xl border px-4 py-2 text-sm font-bold text-primary-dark">{t.open}</button><button type="button" disabled={saving} onClick={() => update({ ...draft, citations: draft.citations.filter(item => item.id !== c.id) })} className="rounded-xl border px-4 py-2 text-sm">{t.remove}</button></div></li>)}</ol>
    <CitationReviewPanel projectId={projectId} documentId={baseDocumentId} draft={draft} dirty={dirty} saving={saving} onApply={record => {
      if (!assessmentStillApplies(draft, record)) return;
      update({ ...draft, citations: draft.citations.map(c => c.id === record.citationId ? { ...c, relation: record.relation, note: c.note || `${language === 'ar' ? 'راجعت اقتراح التقييم: ' : 'Reviewed assessment suggestion: '}${record.rationale}` } : c) });
    }} />
    {!dirty && versions.length > 0 && <ProjectExportButton projectId={projectId} citationStyle={draft.citationStyle || 'apa-7'} />}
  </section>;
}

function PdfCitationPages({ citation, language }: { citation: WritingCitation; language: "ar" | "en" }) {
  const pages = (citation as SavedWritingDraft["citations"][number]).pdfPages;
  return pages ? <p className="mt-2 text-sm text-slate-600">{language === "ar" ? "صفحات الملف الأصلي" : "Original file pages"}: {pages.first}–{pages.last}</p> : null;
}
