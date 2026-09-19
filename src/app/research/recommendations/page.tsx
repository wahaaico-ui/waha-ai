'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import {
  buildRecommendationsDraft,
  isRecommendationHorizon,
  isRecommendationType,
  researchRecommendationsConsistencyIssue,
  type RecommendationHorizon,
  type RecommendationType,
  type ResearchRecommendationsOutput,
} from '@/lib/research-recommendations';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';
import { useJourneyAutosave } from '@/lib/use-journey-autosave';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;

const TYPE_LABELS: Record<RecommendationType, string> = {
  practice: 'ممارسة أو إجراء',
  policy: 'سياسة أو قرار مؤسسي',
  future_research: 'بحث مستقبلي',
};
const HORIZON_LABELS: Record<RecommendationHorizon, string> = {
  immediate: 'أولوية فورية',
  short_term: 'قصيرة المدى',
  long_term: 'طويلة المدى',
};

function savedRecommendations(output: Record<string, unknown> | undefined): ResearchRecommendationsOutput | null {
  if (!output || !Array.isArray(output.recommendations)) return null;
  return output as ResearchRecommendationsOutput;
}

export default function ResearchRecommendationsPage() {
  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [form, setForm] = useState<ResearchRecommendationsOutput | null>(null);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    loadJourney(projectId)
      .then((loaded) => {
        if (!active) return;
        setJourney(loaded);
        const approved = savedRecommendations(loaded.outputs.recommendations);
        const draft = savedRecommendations(loaded.drafts.recommendations?.content);
        setForm(draft || approved || buildRecommendationsDraft(loaded.outputs.conclusions));
        setStatus(approved && !draft ? 'saved' : 'idle');
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.');
      })
      .finally(() => {
        if (active) setLoadedProjectId(projectId);
      });
    return () => { active = false; };
  }, [projectId]);

  const loading = Boolean(projectId) && loadedProjectId !== projectId;
  const conclusionsComplete = Boolean(journey && stageComplete('conclusions', journey.outputs.conclusions));
  const validationIssue = useMemo(() => journey && form
    ? researchRecommendationsConsistencyIssue(form as unknown as Record<string, unknown>, journey.outputs.conclusions)
    : 'جارٍ إعداد التوصيات من الاستنتاجات المعتمدة.', [form, journey]);
  useJourneyAutosave({
    projectId,
    stage: 'recommendations',
    content: (form || {}) as Record<string, unknown>,
    enabled: Boolean(projectId && !loading && journey && form),
  });

  function markEdited() {
    setStatus('idle');
    setError('');
  }

  function updateItem(index: number, changes: Partial<ResearchRecommendationsOutput['recommendations'][number]>) {
    markEdited();
    setForm((current) => current ? {
      ...current,
      recommendations: current.recommendations.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    } : current);
  }

  async function save() {
    if (!projectId || !form || validationIssue || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      await saveJourneyStage(projectId, 'recommendations', {
        ...form,
        recommendations: form.recommendations.map((item) => ({
          ...item,
          targetAudience: item.targetAudience.trim(),
          recommendationText: item.recommendationText.trim(),
        })),
        overallPriorities: form.overallPriorities.trim(),
        feasibilityNote: form.feasibilityNote.trim(),
      });
      setStatus('saved');
    } catch (reason) {
      setError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ التوصيات.');
      setStatus('idle');
    }
  }

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950">
    <SiteHeader />
    <JourneyProgress current="recommendations" lang="ar" />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">من المعرفة إلى الإجراء</div>
        <h1 className="mt-4 text-3xl font-black">حوّل الاستنتاجات إلى خطوات مسؤولة وقابلة للتنفيذ</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">حدّد لكل استنتاج من ينبغي أن يتصرف، وما نوع الإجراء، وأفقه الزمني. التوصية لا تعني أن الدراسة أثبتت شيئاً جديداً، ولا يجوز أن تتجاوز حدود الاستنتاج.</p>
      </header>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ إعداد التوصيات…</section>
      : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">اختر مشروعاً</Link></section>
      : error && !journey ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</section>
      : !conclusionsComplete ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">اعتمد الاستنتاجات أولاً</h2><p className="mt-3 text-sm leading-7 text-amber-900">كل توصية يجب أن تعالج استنتاجاً واضحاً، لا انطباعاً أو نتيجة غير معتمدة.</p><Link href={`/research/conclusions?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى الاستنتاجات</Link></section>
      : journey && form ? <>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">الاستنتاجات</p><p className="mt-2 text-sm font-black text-emerald-950">{form.recommendations.length} استنتاجات معتمدة</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">المطلوب</p><p className="mt-2 text-sm font-black text-blue-950">جهة + إجراء + أفق تنفيذ</p></div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-bold text-violet-700">الحماية</p><p className="mt-2 text-sm font-black text-violet-950">لا نتائج أو أرقام جديدة</p></div>
        </section>

        <section className="space-y-5">
          {form.recommendations.map((item, index) => <article key={item.questionIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">الاستنتاج المعتمد للسؤال {index + 1}</p><p className="mt-2 text-sm font-bold leading-7 text-emerald-950">{item.conclusionStatement}</p><p className="mt-2 border-t border-emerald-200 pt-2 text-xs leading-6 text-emerald-800">{item.questionText}</p></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="space-y-2 text-sm font-bold">نوع التوصية<select value={item.recommendationType} onChange={(event) => { if (isRecommendationType(event.target.value)) updateItem(index, { recommendationType: event.target.value }); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="space-y-2 text-sm font-bold">الجهة المستهدفة<input value={item.targetAudience} onChange={(event) => updateItem(index, { targetAudience: event.target.value })} maxLength={240} placeholder="مثال: إدارات الجامعات" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
              <label className="space-y-2 text-sm font-bold">أفق التنفيذ<select value={item.implementationHorizon} onChange={(event) => { if (isRecommendationHorizon(event.target.value)) updateItem(index, { implementationHorizon: event.target.value }); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">{Object.entries(HORIZON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label className="mt-4 block space-y-2 text-sm font-bold">صياغة التوصية
              <textarea value={item.recommendationText} onChange={(event) => updateItem(index, { recommendationText: event.target.value })} maxLength={2400} rows={6} placeholder="اكتب إجراءً محدداً ومتناسباً مع الاستنتاج وحدود الدراسة، ووضّح الغرض منه…" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              <span className="block text-xs font-normal leading-6 text-slate-500">لا تضف نسبة أو هدفاً رقمياً لم يرد في الاستنتاج. استخدم حقل أفق التنفيذ بدل كتابة مدة مخترعة.</span>
            </label>
          </article>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="space-y-2 text-sm font-bold">ترتيب أولويات التوصيات
            <textarea value={form.overallPriorities} onChange={(event) => { markEdited(); setForm((current) => current ? { ...current, overallPriorities: event.target.value } : current); }} maxLength={3000} rows={6} placeholder="وضّح أي التوصيات تسبق غيرها ولماذا، اعتماداً على قوة الاستنتاج وقابلية التنفيذ…" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <label className="mt-5 block space-y-2 text-sm font-bold">ملاحظة قابلية التنفيذ والحدود
            <textarea value={form.feasibilityNote} onChange={(event) => { markEdited(); setForm((current) => current ? { ...current, feasibilityNote: event.target.value } : current); }} maxLength={1800} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><input type="checkbox" checked={form.conclusionGroundingConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, conclusionGroundingConfirmed: event.target.checked as true } : current); }} className="mt-1 h-4 w-4" /><span>أؤكد أن كل توصية مشتقة من استنتاج معتمد.</span></label><label className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950"><input type="checkbox" checked={form.noNewFindingsConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, noNewFindingsConfirmed: event.target.checked as true } : current); }} className="mt-1 h-4 w-4" /><span>أؤكد أن التوصيات لا تقدّم نتائج جديدة على أنها حقائق.</span></label></div>
          {validationIssue ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{validationIssue}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p> : null}
          <button type="button" onClick={() => void save()} disabled={Boolean(validationIssue) || status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ التحقق والحفظ…' : 'اعتماد التوصيات'}</button>
          {status === 'saved' && !validationIssue ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold leading-7 text-emerald-900">تم حفظ التوصيات والتحقق من ارتباطها بالاستنتاجات. <Link href={`/research/publication?projectId=${encodeURIComponent(projectId)}`} className="underline">انتقل إلى جاهزية النشر</Link></p> : null}
        </section>
      </> : null}
    </main>
  </div>;
}
