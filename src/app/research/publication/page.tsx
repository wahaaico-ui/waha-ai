'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import ProjectExportButton from '@/components/ProjectExportButton';
import { JournalReviewPanel, JournalTemplatePanel } from '@/components/JournalPublicationPanels';
import JournalMatchingPanel from '@/components/JournalMatchingPanel';
import JourneyProgress from '@/components/JourneyProgress';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import {
  buildPublicationDraft,
  isEthicsStatus,
  isManuscriptLanguage,
  isPublicationCitationStyle,
  isPublicationTargetType,
  researchPublicationConsistencyIssue,
  type ResearchPublicationOutput,
} from '@/lib/research-publication';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';
import { useJourneyAutosave } from '@/lib/use-journey-autosave';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;
type AbstractField = keyof ResearchPublicationOutput['structuredAbstract'];

const TARGET_LABELS = { journal: 'مجلة علمية', conference: 'مؤتمر علمي', thesis: 'رسالة جامعية', repository: 'مستودع مؤسسي' } as const;
const LANGUAGE_LABELS = { ar: 'العربية', en: 'الإنجليزية', bilingual: 'ثنائية اللغة' } as const;
const CITATION_LABELS = { apa7: 'APA 7', harvard: 'Harvard', vancouver: 'Vancouver', chicago: 'Chicago', venue_specific: 'حسب دليل جهة النشر' } as const;
const ETHICS_LABELS = { approved: 'تمت الموافقة الأخلاقية', not_required: 'لا تتطلب موافقة وفق الجهة المختصة', pending: 'ما زالت معلّقة' } as const;
const ABSTRACT_LABELS: Record<AbstractField, string> = { background: 'الخلفية والمشكلة', objective: 'الهدف', methods: 'المنهج والإجراءات', results: 'النتائج', conclusion: 'الاستنتاج' };

function savedPublication(output: Record<string, unknown> | undefined): ResearchPublicationOutput | null {
  return output?.structuredAbstract && typeof output.structuredAbstract === 'object' ? output as ResearchPublicationOutput : null;
}

export default function ResearchPublicationPage() {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [form, setForm] = useState<ResearchPublicationOutput | null>(null);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    loadJourney(projectId).then((loaded) => {
      if (!active) return;
      setJourney(loaded);
      const approved = savedPublication(loaded.outputs.publication);
      const draft = savedPublication(loaded.drafts.publication?.content);
      setForm(draft || approved || buildPublicationDraft(loaded.outputs));
      setStatus(approved && !draft ? 'saved' : 'idle');
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.');
    }).finally(() => {
      if (active) setLoadedProjectId(projectId);
    });
    return () => { active = false; };
  }, [projectId]);

  const recommendationsComplete = Boolean(journey && stageComplete('recommendations', journey.outputs.recommendations));
  const validationIssue = useMemo(() => journey && form ? researchPublicationConsistencyIssue(form as unknown as Record<string, unknown>, {
    title: journey.outputs.title,
    problem: journey.outputs.problem,
    objectives: journey.outputs.objectives,
    methodology: journey.outputs.methodology,
    design: journey.outputs.design,
    results: journey.outputs.results,
    conclusions: journey.outputs.conclusions,
  }) : 'جارٍ إعداد حزمة النشر من المخرجات المعتمدة.', [form, journey]);

  function markEdited() {
    setStatus('idle');
    setError('');
  }

  function update(changes: Partial<ResearchPublicationOutput>) {
    markEdited();
    setForm((current) => current ? { ...current, ...changes } : current);
  }

  function updateAbstract(field: AbstractField, value: string) {
    markEdited();
    setForm((current) => current ? { ...current, structuredAbstract: { ...current.structuredAbstract, [field]: value } } : current);
  }

  async function save() {
    if (!projectId || !form || validationIssue || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      await saveJourneyStage(projectId, 'publication', {
        ...form,
        targetName: form.targetName.trim(),
        structuredAbstract: Object.fromEntries(Object.entries(form.structuredAbstract).map(([key, value]) => [key, value.trim()])),
        keywords: form.keywords.map((keyword) => keyword.trim()).filter(Boolean),
        ethicsStatement: form.ethicsStatement.trim(),
        conflictOfInterestStatement: form.conflictOfInterestStatement.trim(),
        fundingStatement: form.fundingStatement.trim(),
        dataAvailabilityStatement: form.dataAvailabilityStatement.trim(),
        aiUseDisclosure: form.aiUseDisclosure.trim(),
      });
      setStatus('saved');
    } catch (reason) {
      setError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ جاهزية النشر.');
      setStatus('idle');
    }
  }

  const loading = Boolean(projectId) && loadedProjectId !== projectId;
  useJourneyAutosave({
    projectId,
    stage: 'publication',
    content: (form || {}) as Record<string, unknown>,
    enabled: Boolean(projectId && !loading && journey && form),
  });
  return <div dir={uiDirection} className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950">
    <SiteHeader />
    <JourneyProgress current="publication" lang={uiLanguage} />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{ui("حزمة جاهزية المخطوط")}</div>
        <h1 className="mt-4 text-3xl font-black">{ui("جهّز مخطوطك للتحكيم من دون ادعاء ضمان القبول")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{ui("تجمع هذه المرحلة ملخصاً منظماً، ووجهة النشر، والإقرارات العلمية. يفحص النظام اتساق الملخص مع نتائجك واستنتاجاتك، لكن القرار النهائي يبقى للمجلة أو الجامعة والمحكمين.")}</p>
      </header>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ui("جارٍ تجهيز حزمة النشر…")}</section>
      : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("افتح مشروعاً محفوظاً أولاً")}</h2><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("مشاريعي")}</Link></section>
      : error && !journey ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{ui(error)}</section>
      : !recommendationsComplete ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("اعتمد التوصيات أولاً")}</h2><p className="mt-3 text-sm leading-7 text-amber-900">{ui("لا تكتمل حزمة النشر قبل إغلاق سلسلة النتائج والمناقشة والاستنتاجات والتوصيات.")}</p><Link href={`/research/recommendations?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">{ui("العودة إلى التوصيات")}</Link></section>
      : journey && form ? <>
        <ProjectExportButton projectId={projectId} />
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold text-emerald-700">{ui("العنوان المعتمد — للقراءة فقط")}</p><p className="mt-2 text-lg font-black leading-8 text-emerald-950">{form.approvedTitle}</p></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">{ui("1. وجهة المخطوط")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-bold">{ui("نوع المخرج")}<select value={form.targetType} onChange={(event) => { if (isPublicationTargetType(event.target.value)) update({ targetType: event.target.value }); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">{Object.entries(TARGET_LABELS).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
            <label className="space-y-2 text-sm font-bold">{ui("اسم المجلة/المؤتمر/الجامعة")}<input value={form.targetName} onChange={(event) => update({ targetName: event.target.value })} maxLength={240} placeholder={ui("اكتب الجهة المستهدفة بدقة")} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="space-y-2 text-sm font-bold">{ui("لغة المخطوط")}<select value={form.manuscriptLanguage} onChange={(event) => { if (isManuscriptLanguage(event.target.value)) update({ manuscriptLanguage: event.target.value }); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">{Object.entries(LANGUAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
            <label className="space-y-2 text-sm font-bold">{ui("نمط التوثيق")}<select value={form.citationStyle} onChange={(event) => { if (isPublicationCitationStyle(event.target.value)) update({ citationStyle: event.target.value }); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">{Object.entries(CITATION_LABELS).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">{ui("2. الملخص المنظم")}</h2><p className="mt-2 text-sm leading-7 text-slate-500">{ui("بُنيت المسودة من مراحل مشروعك. راجعها لغوياً؛ أي رقم جديد أو نص منفصل عن المخرجات المعتمدة سيمنع الحفظ.")}</p>
          <div className="mt-5 space-y-4">{(Object.keys(ABSTRACT_LABELS) as AbstractField[]).map((field) => <label key={field} className="block space-y-2 text-sm font-bold">{ui(ABSTRACT_LABELS[field])}<textarea dir="auto" value={form.structuredAbstract[field]} onChange={(event) => updateAbstract(field, event.target.value)} maxLength={3500} rows={field === 'methods' || field === 'results' ? 5 : 4} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" /></label>)}</div>
          <label className="mt-5 block space-y-2 text-sm font-bold">{ui("الكلمات المفتاحية")}<input value={form.keywords.join('، ')} onChange={(event) => update({ keywords: event.target.value.split(/[،,]/u).map((value) => value.trim()) })} maxLength={500} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /><span className="block text-xs font-normal text-slate-500">{ui("من 3 إلى 8 كلمات، افصل بينها بفاصلة.")}</span></label>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">{ui("3. الإقرارات العلمية")}</h2>
          <div className="mt-5 space-y-4">
            <label className="block space-y-2 text-sm font-bold">{ui("حالة الأخلاقيات")}<select value={form.ethicsStatus} onChange={(event) => { if (isEthicsStatus(event.target.value)) update({ ethicsStatus: event.target.value }); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">{Object.entries(ETHICS_LABELS).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
            {([['ethicsStatement', ui("بيان الأخلاقيات")], ['conflictOfInterestStatement', ui("تضارب المصالح")], ['fundingStatement', ui("التمويل")], ['dataAvailabilityStatement', ui("إتاحة البيانات")], ['aiUseDisclosure', ui("الإفصاح عن استخدام الذكاء الاصطناعي")]] as const).map(([field, label]) => <label key={field} className="block space-y-2 text-sm font-bold">{ui(label)}<textarea dir="auto" value={form[field]} onChange={(event) => update({ [field]: event.target.value })} maxLength={1800} rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" /></label>)}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{([['originalSourcesReviewedConfirmed', ui("راجعت المصادر الأصلية وتحققت من صحة المراجع.")], ['authorshipConfirmed', ui("وافق جميع المؤلفين على المسؤولية والنسخة الحالية.")], ['venueGuidelinesConfirmed', ui("راجعت تعليمات جهة النشر المستهدفة.")], ['noAcceptanceGuaranteeConfirmed', ui("أفهم أن هذه الجاهزية لا تضمن القبول أو النشر.")]] as const).map(([field, label]) => <label key={field} className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><input type="checkbox" checked={form[field]} onChange={(event) => update({ [field]: event.target.checked })} className="mt-1 h-4 w-4" /><span>{ui(label)}</span></label>)}</div>
          {validationIssue ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{ui(validationIssue)}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{ui(error)}</p> : null}
          <button type="button" onClick={() => void save()} disabled={Boolean(validationIssue) || status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? ui("جارٍ فحص الحزمة وحفظها…") : ui("اعتماد الجاهزية وإنهاء الرحلة")}</button>
          {status === 'saved' && !validationIssue ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold leading-7 text-emerald-900">{ui("اكتملت المراحل السبع عشرة وحُفظت حزمة النشر.")}<Link href={`/research/seminar?projectId=${encodeURIComponent(projectId)}`} className="underline">{ui("افتح التقرير النهائي")}</Link></div> : null}
        </section>
        {journey && <JournalMatchingPanel defaultTopic={typeof journey.outputs.title?.title === 'string' ? journey.outputs.title.title : ''} />}
        {journey && form && <JournalTemplatePanel projectId={projectId} outputs={journey.outputs} publication={form} />}
        <JournalReviewPanel projectId={projectId} journalName={form?.targetName || ''} />
      </> : null}
    </main>
  </div>;
}
