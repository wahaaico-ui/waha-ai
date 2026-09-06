'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import {
  externalAnalysisConsistencyIssue,
  type AnalystRole,
  type ExternalAnalysisFinding,
  type ExternalAnalysisKind,
} from '@/lib/research-analysis-input';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;
type FormState = {
  analysisKind: ExternalAnalysisKind;
  analyzedBy: AnalystRole;
  softwareOrMethod: string;
  sampleAnalyzed: string;
  procedureSummary: string;
  findings: ExternalAnalysisFinding[];
  limitations: string;
  noRawDataConfirmed: boolean;
  noPersonalDataConfirmed: boolean;
};

const EMPTY_FORM: FormState = {
  analysisKind: 'quantitative',
  analyzedBy: 'researcher',
  softwareOrMethod: '',
  sampleAnalyzed: '',
  procedureSummary: '',
  findings: [],
  limitations: '',
  noRawDataConfirmed: false,
  noPersonalDataConfirmed: false,
};

const textList = (value: unknown) => Array.isArray(value)
  ? value.flatMap((item) => typeof item === 'string' && item.trim() ? [item.trim()] : [])
  : [];

function recommendedKind(approach: unknown): ExternalAnalysisKind {
  if (approach === 'qualitative') return 'qualitative';
  if (approach === 'mixed') return 'mixed';
  return 'quantitative';
}

function formFromJourney(journey: JourneyData): FormState {
  const questions = textList(journey.outputs.questions?.questions);
  const hypothesesRequired = journey.outputs.hypotheses?.mode === 'required';
  const hypotheses = hypothesesRequired ? textList(journey.outputs.hypotheses?.hypotheses) : [];
  const saved = journey.outputs.analysis_input;
  const savedFindings = Array.isArray(saved?.findings)
    ? saved.findings.filter((item): item is ExternalAnalysisFinding => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
  const findings = questions.map((questionText, questionIndex) => {
    const existing = savedFindings.find((item) => item.questionIndex === questionIndex);
    return {
      questionIndex,
      questionText,
      hypothesisIndex: hypothesesRequired ? questionIndex : null,
      hypothesisText: hypothesesRequired ? hypotheses[questionIndex] || null : null,
      findingSummary: typeof existing?.findingSummary === 'string' ? existing.findingSummary : '',
      evidenceSummary: typeof existing?.evidenceSummary === 'string' ? existing.evidenceSummary : '',
    };
  });
  const savedKind = saved?.analysisKind;
  const savedRole = saved?.analyzedBy;
  return {
    analysisKind: savedKind === 'quantitative' || savedKind === 'qualitative' || savedKind === 'mixed'
      ? savedKind
      : recommendedKind(journey.outputs.methodology?.approach),
    analyzedBy: savedRole === 'researcher' || savedRole === 'statistical_specialist' || savedRole === 'research_team' ? savedRole : 'researcher',
    softwareOrMethod: typeof saved?.softwareOrMethod === 'string' ? saved.softwareOrMethod : '',
    sampleAnalyzed: typeof saved?.sampleAnalyzed === 'string' ? saved.sampleAnalyzed : '',
    procedureSummary: typeof saved?.procedureSummary === 'string' ? saved.procedureSummary : '',
    findings,
    limitations: typeof saved?.limitations === 'string' ? saved.limitations : '',
    noRawDataConfirmed: saved?.noRawDataConfirmed === true,
    noPersonalDataConfirmed: saved?.noPersonalDataConfirmed === true,
  };
}

export default function ExternalAnalysisInputPage() {
  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    loadJourney(projectId)
      .then((loaded) => {
        if (!active) return;
        setJourney(loaded);
        setForm(formFromJourney(loaded));
        if (loaded.outputs.analysis_input) setStatus('saved');
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.');
      })
      .finally(() => {
        if (active) setLoadedProjectId(projectId);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  const loading = Boolean(projectId) && loadedProjectId !== projectId;

  const payload = useMemo(() => ({
    analysisKind: form.analysisKind,
    analyzedBy: form.analyzedBy,
    softwareOrMethod: form.softwareOrMethod.trim(),
    sampleAnalyzed: form.sampleAnalyzed.trim(),
    procedureSummary: form.procedureSummary.trim(),
    findings: form.findings.map((finding) => ({
      ...finding,
      findingSummary: finding.findingSummary.trim(),
      evidenceSummary: finding.evidenceSummary.trim(),
    })),
    limitations: form.limitations.trim(),
    noRawDataConfirmed: form.noRawDataConfirmed,
    noPersonalDataConfirmed: form.noPersonalDataConfirmed,
  }), [form]);

  const validationIssue = useMemo(() => journey
    ? externalAnalysisConsistencyIssue(payload, journey.outputs.questions, journey.outputs.hypotheses, journey.outputs.methodology)
    : 'جارٍ تحميل أسئلة المشروع.', [journey, payload]);
  const literatureAnalysisComplete = Boolean(journey && stageComplete('analysis', journey.outputs.analysis));

  function updateFinding(index: number, field: 'findingSummary' | 'evidenceSummary', value: string) {
    setStatus('idle');
    setForm((current) => ({
      ...current,
      findings: current.findings.map((finding, findingIndex) => findingIndex === index ? { ...finding, [field]: value } : finding),
    }));
  }

  async function save() {
    if (!projectId || validationIssue || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      await saveJourneyStage(projectId, 'analysis_input', payload);
      setStatus('saved');
    } catch (reason) {
      setError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ مخرجات التحليل.');
      setStatus('idle');
    }
  }

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950">
    <SiteHeader />
    <JourneyProgress current="analysis_input" lang="ar" />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 12 · مخرجات التحليل الخارجي</div>
        <h1 className="mt-4 text-3xl font-black">أعد نتائج تحليلك إلى أسئلة الدراسة</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">WAHA لا يجمع بياناتك ولا ينفذ التحليل الإحصائي. بعد إنهاء التحليل في أداتك المتخصصة، أدخل هنا ملخصاً مجهول الهوية؛ سنفحص اكتمال الارتباط بالأسئلة والفرضيات قبل صياغة النتائج.</p>
      </header>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأسئلة والمنهجية المعتمدة…</section>
      : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
      : error && !journey ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</section>
      : !literatureAnalysisComplete ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">أكمل تحليل الأدبيات أولاً</h2><p className="mt-3 text-sm leading-7 text-amber-900">يحافظ هذا الترتيب على فصل ما توصلت إليه الدراسات السابقة عن نتائج بياناتك الميدانية.</p><Link href={`/research/analysis?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى تحليل الأدبيات</Link></section>
      : journey ? <>
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-950">
          <strong>حد الخصوصية:</strong> لا ترفع ملف البيانات، إجابات المشاركين، الأسماء، أرقام الهواتف، البريد، أو أرقام الهوية. أدخل نتائج مجمعة فقط مثل الاتجاه العام، المتوسطات، العلاقات، الثيمات أو الاقتباسات المنزوعة الهوية.
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
          <label className="space-y-2 text-sm font-bold">نوع التحليل
            <select value={form.analysisKind} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, analysisKind: event.target.value as ExternalAnalysisKind })); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">
              <option value="quantitative">كمي</option><option value="qualitative">نوعي</option><option value="mixed">مختلط</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-bold">من نفّذ التحليل؟
            <select value={form.analyzedBy} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, analyzedBy: event.target.value as AnalystRole })); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">
              <option value="researcher">الباحث</option><option value="statistical_specialist">مختص إحصائي/تحليلي</option><option value="research_team">فريق البحث</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-bold">الأداة أو طريقة التحليل
            <input value={form.softwareOrMethod} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, softwareOrMethod: event.target.value })); }} maxLength={300} placeholder="مثال: SPSS وتحليل الانحدار المتعدد" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="space-y-2 text-sm font-bold">ما الذي شمله التحليل؟ — بلا بيانات خام
            <input value={form.sampleAnalyzed} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, sampleAnalyzed: event.target.value })); }} maxLength={500} placeholder="مثال: 214 استجابة صالحة بعد استبعاد الاستجابات غير المكتملة" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="space-y-2 text-sm font-bold sm:col-span-2">ملخص إجراءات التحليل
            <textarea value={form.procedureSummary} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, procedureSummary: event.target.value })); }} maxLength={1500} rows={4} placeholder="اذكر الاختبارات أو خطوات الترميز ومعيار اتخاذ القرار دون لصق المخرجات الخام." className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
        </section>

        <section className="space-y-4">
          <div><h2 className="text-xl font-black">مخرج مقابل كل سؤال</h2><p className="mt-1 text-sm leading-7 text-slate-600">الأسئلة والفرضيات مقفلة كما اعتمدتها سابقاً؛ اكتب فقط ما أظهره تحليلك والدليل الملخص الذي يدعمه.</p></div>
          {form.findings.map((finding, index) => <article key={finding.questionIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">السؤال {index + 1}</p><p className="mt-2 text-sm font-bold leading-7 text-blue-950">{finding.questionText}</p>{finding.hypothesisText ? <p className="mt-2 border-t border-blue-200 pt-2 text-xs leading-6 text-blue-800"><strong>الفرضية المقابلة:</strong> {finding.hypothesisText}</p> : null}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">خلاصة ما ظهر
                <textarea value={finding.findingSummary} onChange={(event) => updateFinding(index, 'findingSummary', event.target.value)} maxLength={1200} rows={4} placeholder="اكتب النتيجة كما ظهرت، بلا تفسير زائد أو استنتاج غير مدعوم." className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              </label>
              <label className="space-y-2 text-sm font-bold">الدليل التحليلي الملخص
                <textarea value={finding.evidenceSummary} onChange={(event) => updateFinding(index, 'evidenceSummary', event.target.value)} maxLength={1200} rows={4} placeholder="مثال كمي: قيمة الاختبار واتجاه العلاقة. مثال نوعي: الثيمة وعدد/نمط تكرارها." className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              </label>
            </div>
          </article>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="space-y-2 text-sm font-bold">حدود التحليل
            <textarea value={form.limitations} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, limitations: event.target.value })); }} maxLength={1000} rows={3} placeholder="اذكر ما يحد تفسير النتائج: حجم العينة، الاستجابة، الافتراضات، أو حدود الأداة." className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
            <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" checked={form.noRawDataConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, noRawDataConfirmed: event.target.checked })); }} className="mt-1 h-4 w-4" /><span>أؤكد أنني لم أرفع بيانات خام أو إجابات المشاركين.</span></label>
            <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" checked={form.noPersonalDataConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => ({ ...current, noPersonalDataConfirmed: event.target.checked })); }} className="mt-1 h-4 w-4" /><span>أؤكد أن النص لا يتضمن اسماً أو بريداً أو هاتفاً أو أي معرّف شخصي.</span></label>
          </div>
          {validationIssue ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{validationIssue}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p> : null}
          <button type="button" onClick={() => void save()} disabled={Boolean(validationIssue) || status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ التحقق والحفظ…' : 'اعتماد مخرجات التحليل'}</button>
          {status === 'saved' && !validationIssue ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900"><strong>تم الحفظ والتحقق.</strong> أصبحت الأسئلة والفرضيات مرتبطة بمخرجات التحليل.<div><Link href={`/research/results?projectId=${encodeURIComponent(projectId)}`} className="mt-3 inline-flex rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white">انتقل إلى صياغة النتائج ←</Link></div></div> : null}
        </section>
      </> : null}
    </main>
  </div>;
}
