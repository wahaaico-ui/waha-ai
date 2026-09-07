'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { JOURNEY_STAGES, loadJourney, type JourneyStage } from '@/lib/research-journey';
import { stageComplete, stageLabel } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;

function outputPreview(stage: JourneyStage, output: Record<string, unknown> | undefined) {
  if (!output) return '';
  const candidates: Record<JourneyStage, unknown[]> = {
    verify: [output.topic, output.decisionMessage],
    title: [output.title],
    problem: [output.problemStatement, output.researchGap],
    objectives: Array.isArray(output.objectives) ? output.objectives : [],
    questions: Array.isArray(output.questions) ? output.questions : [],
    hypotheses: output.mode === 'not_applicable'
      ? [output.rationale]
      : Array.isArray(output.hypotheses) ? output.hypotheses : [],
    methodology: [output.population, output.sample, output.instrument],
    design: Array.isArray(output.variables) ? output.variables.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).name : '') : [],
    instrument: [output.title, ...(Array.isArray(output.sections) ? output.sections.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).title : '') : [])],
    literature: Array.isArray(output.papers) ? output.papers.map((paper) => paper && typeof paper === 'object' ? (paper as Record<string, unknown>).title : '') : [],
    analysis: [output.conclusion, output.thematicSynthesis],
    analysis_input: Array.isArray(output.findings) ? output.findings.map((finding) => finding && typeof finding === 'object' ? (finding as Record<string, unknown>).findingSummary : '') : [],
    results: Array.isArray(output.results) ? output.results.map((result) => result && typeof result === 'object' ? (result as Record<string, unknown>).resultStatement : '') : [],
    discussion: Array.isArray(output.discussions) ? output.discussions.map((discussion) => discussion && typeof discussion === 'object' ? (discussion as Record<string, unknown>).interpretation : '') : [],
    conclusions: Array.isArray(output.conclusions) ? output.conclusions.map((conclusion) => conclusion && typeof conclusion === 'object' ? (conclusion as Record<string, unknown>).conclusionStatement : '') : [],
    recommendations: Array.isArray(output.recommendations) ? output.recommendations.map((recommendation) => recommendation && typeof recommendation === 'object' ? (recommendation as Record<string, unknown>).recommendationText : '') : [],
    publication: [output.targetName, output.approvedTitle],
  };
  return candidates[stage].filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 2).join(' — ');
}

export default function JourneyDashboardPage() {
  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId).then(setJourney).catch((reason) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.')).finally(() => setLoading(false));
  }, [projectId]);

  const completeCount = useMemo(() => journey ? JOURNEY_STAGES.filter((stage) => stageComplete(stage.id, journey.outputs[stage.id])).length : 0, [journey]);
  const next = journey?.nextStage ? JOURNEY_STAGES.find((stage) => stage.id === journey.nextStage) || null : null;
  const title = typeof journey?.outputs.title?.title === 'string' ? journey.outputs.title.title : typeof journey?.outputs.verify?.topic === 'string' ? journey.outputs.verify.topic : 'مشروعك البحثي';
  const lastStage = journey?.lastActivity?.stage;
  const lastPreview = lastStage ? outputPreview(lastStage, journey?.outputs[lastStage]) : '';

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950"><SiteHeader /><main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">جارٍ استعادة آخر نقطة محفوظة…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><h1 className="text-2xl font-black text-amber-950">اختر مشروعاً لعرض رحلته</h1><p className="mt-3 text-sm text-amber-900">لوحة الرحلة لا تقرأ أي نسخة محلية؛ يجب فتحها من مشروعك المحمي.</p><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">اذهب إلى مشاريعي</Link></section>
    : error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"><h1 className="text-xl font-black text-rose-950">تعذر فتح المشروع</h1><p className="mt-3 text-sm text-rose-800">{error}</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : journey ? <div className="contents"><section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white shadow-xl shadow-blue-900/15 sm:p-10"><p className="text-xs font-bold text-blue-100">مرحباً {journey.researcher.displayName}{journey.researcher.specialty ? ` · ${journey.researcher.specialty}` : ''}</p><div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">هذه هي النسخة المحفوظة على الخادم. نعرض أين توقفت، وما اعتُمد، وما يجب استكماله من دون قفز بين المراحل.</p></div><div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center"><div className="text-2xl font-black">{completeCount}/{JOURNEY_STAGES.length}</div><div className="mt-1 text-xs text-blue-100">مراحل مكتملة</div></div></div></section>

      {journey.lastActivity && <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-blue-700">دعنا نكمل من حيث توقفت</p><h2 className="mt-1 text-lg font-black">آخر حفظ: {stageLabel(journey.lastActivity.stage)}</h2><p className="mt-1 text-xs text-slate-500">{journey.lastActivity.at ? new Date(journey.lastActivity.at).toLocaleString('ar') : 'الوقت غير متاح'}</p></div>{lastPreview && <button type="button" onClick={() => setShowPreview((current) => !current)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">{showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{showPreview ? 'إخفاء آخر مخرج' : 'إظهار لمحة'}</button>}</div>{showPreview && lastPreview && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950">{lastPreview}</p>}</section>}

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-blue-700">{next ? 'الخطوة التالية المسموح بها' : 'اكتملت الرحلة البحثية'}</p><h2 className="mt-1 text-lg font-black">{next?.title || 'حزمة النشر محفوظة والتقرير النهائي جاهز للمراجعة'}</h2>{journey.gate?.reason && <p className="mt-2 text-xs leading-6 text-slate-500">{journey.gate.reason}</p>}</div>{next ? <Link href={`${next.href}?projectId=${encodeURIComponent(projectId)}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white sm:mt-0">متابعة <ArrowLeft className="h-4 w-4" /></Link> : <Link href={`/research/seminar?projectId=${encodeURIComponent(projectId)}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white sm:mt-0">فتح التقرير النهائي <ArrowLeft className="h-4 w-4" /></Link>}</section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{JOURNEY_STAGES.map((stage, index) => { const complete = stageComplete(stage.id, journey.outputs[stage.id]); const active = stage.id === journey.nextStage; const locked = !complete && !active; return <article key={stage.id} className={`rounded-2xl border p-4 ${complete ? 'border-emerald-200 bg-emerald-50' : active ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-400">{String(index + 1).padStart(2, '0')}</span>{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : locked ? <LockKeyhole className="h-4 w-4 text-slate-400" /> : <Circle className="h-5 w-5 text-blue-600" />}</div><p className={`mt-4 text-sm font-black ${complete ? 'text-emerald-800' : active ? 'text-blue-900' : 'text-slate-500'}`}>{stage.title}</p><p className="mt-1 text-xs text-slate-500">{complete ? 'معتمدة ومحفوظة' : active ? 'مفتوحة الآن' : 'تُفتح بالتسلسل'}</p>{(complete || active) && <Link href={`${stage.href}?projectId=${encodeURIComponent(projectId)}`} className="mt-3 inline-flex text-xs font-bold text-blue-700">{complete ? 'عرض/تحديث المرحلة' : 'فتح المرحلة'} ←</Link>}</article>; })}</section>
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-violet-700">ضمن خطة الباحث</p><h2 className="mt-1 text-lg font-black text-violet-950">ترجمة الملخص والتدقيق اللغوي</h2><p className="mt-2 text-sm text-violet-800">أداة داخل الواحة؛ لا تحتاج إلى فتح موقع خارجي.</p></div><Link href="/research/language-tools" className="mt-4 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white sm:mt-0">فتح أدوات النص</Link></section>
    </div> : null}
  </main></div>;
}
