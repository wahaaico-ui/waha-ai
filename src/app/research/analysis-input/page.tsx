'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
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
import { useJourneyAutosave } from '@/lib/use-journey-autosave';

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
  const saved = journey.drafts.analysis_input?.content ?? journey.outputs.analysis_input;
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
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

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
  useJourneyAutosave({
    projectId,
    stage: 'analysis_input',
    content: form as unknown as Record<string, unknown>,
    enabled: Boolean(projectId && !loading && journey),
  });

  const validationIssue = useMemo(() => journey
    ? externalAnalysisConsistencyIssue(payload, journey.outputs.questions, journey.outputs.hypotheses, journey.outputs.methodology)
    : 'جارٍ تحميل أسئلة المشروع.', [journey, payload]);
  const literatureAnalysisComplete = Boolean(journey && stageComplete('analysis', journey.outputs.analysis));
  const completedFindings = useMemo(() => form.findings.filter((finding) => finding.findingSummary.trim().length >= 25 && finding.evidenceSummary.trim().length >= 20).length, [form.findings]);
  const analysisKindLabel = ({ quantitative: 'كمي', qualitative: 'نوعي', mixed: 'مختلط' } as Record<ExternalAnalysisKind, string>)[form.analysisKind];

  function markEdited() {
    setStatus('idle');
    setError('');
  }

  function updateFinding(index: number, field: 'findingSummary' | 'evidenceSummary', value: string) {
    markEdited();
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

  return <div dir={uiDirection} className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950">
    <SiteHeader />
    <JourneyProgress current="analysis_input" lang={uiLanguage} />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{ui("ربط التحليل بأسئلة البحث")}</div>
        <h1 className="mt-4 text-3xl font-black">{ui("أدخل ما أظهره تحليلك الفعلي")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{ui("بعد إنهاء التحليل في برنامجك أو مع مختص، أدخل ملخصاً مجهول الهوية لكل سؤال. WAHA لا يجمع بياناتك ولا ينفذ التحليل الإحصائي، بل يتحقق من اكتمال الربط قبل مساعدتك في صياغة النتائج.")}</p>
      </header>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ui("جارٍ تحميل الأسئلة والمنهجية المعتمدة…")}</section>
      : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("سجّل الدخول للمتابعة من مشروعك")}</h2><p className="mt-3 text-sm leading-7 text-amber-900">{ui("سنربط ملخص التحليل بأسئلتك المحفوظة من دون طلب ملف البيانات.")}</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("تسجيل الدخول")}</Link></section>
      : error && !journey ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{ui(error)}</section>
      : !literatureAnalysisComplete ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("أكمل صورة الأدبيات أولاً")}</h2><p className="mt-3 text-sm leading-7 text-amber-900">{ui("بهذا نبقي ما تقوله الدراسات السابقة منفصلاً بوضوح عما أظهرته بياناتك الفعلية.")}</p><Link href={`/research/analysis?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">{ui("إكمال تحليل الأدبيات")}</Link></section>
      : journey ? <>
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-950">
          <strong>{ui("حد الخصوصية:")}</strong> {ui("لا ترفع ملف البيانات، إجابات المشاركين، الأسماء، أرقام الهواتف، البريد، أو أرقام الهوية. أدخل نتائج مجمعة فقط مثل الاتجاه العام، المتوسطات، العلاقات، الثيمات أو الاقتباسات المنزوعة الهوية.")}</section>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
          <label className="space-y-2 text-sm font-bold">{ui("نوع التحليل")}<select value={form.analysisKind} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, analysisKind: event.target.value as ExternalAnalysisKind })); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">
              <option value="quantitative">{ui("كمي")}</option><option value="qualitative">{ui("نوعي")}</option><option value="mixed">{ui("مختلط")}</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-bold">{ui("من نفّذ التحليل؟")}<select value={form.analyzedBy} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, analyzedBy: event.target.value as AnalystRole })); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">
              <option value="researcher">{ui("الباحث")}</option><option value="statistical_specialist">{ui("مختص إحصائي/تحليلي")}</option><option value="research_team">{ui("فريق البحث")}</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-bold">{ui("الأداة أو طريقة التحليل")}<input value={form.softwareOrMethod} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, softwareOrMethod: event.target.value })); }} maxLength={300} placeholder={ui("مثال: SPSS وتحليل الانحدار المتعدد")} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="space-y-2 text-sm font-bold">{ui("ما الذي شمله التحليل؟ — بلا بيانات خام")}<input value={form.sampleAnalyzed} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, sampleAnalyzed: event.target.value })); }} maxLength={500} placeholder={ui("مثال: 214 استجابة صالحة بعد استبعاد الاستجابات غير المكتملة")} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="space-y-2 text-sm font-bold sm:col-span-2">{ui("ملخص إجراءات التحليل")}<textarea dir="auto" value={form.procedureSummary} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, procedureSummary: event.target.value })); }} maxLength={1500} rows={4} placeholder={ui("اذكر الاختبارات أو خطوات الترميز ومعيار اتخاذ القرار دون لصق المخرجات الخام.")} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
        </section>

        <section className="space-y-4">
          <div><h2 className="text-xl font-black">{ui("مخرج مقابل كل سؤال")}</h2><p className="mt-1 text-sm leading-7 text-slate-600">{ui("الأسئلة والفرضيات مقفلة كما اعتمدتها سابقاً؛ اكتب فقط ما أظهره تحليلك والدليل الملخص الذي يدعمه.")}</p></div>
          {form.findings.map((finding, index) => <article key={finding.questionIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">{ui("السؤال")}{' '}{index + 1}</p><p className="mt-2 text-sm font-bold leading-7 text-blue-950">{finding.questionText}</p>{finding.hypothesisText ? <p className="mt-2 border-t border-blue-200 pt-2 text-xs leading-6 text-blue-800"><strong>{ui("الفرضية المقابلة:")}</strong> {finding.hypothesisText}</p> : null}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">{ui("خلاصة ما ظهر")}<textarea dir="auto" value={finding.findingSummary} onChange={(event) => updateFinding(index, 'findingSummary', event.target.value)} maxLength={1200} rows={4} placeholder={ui("اكتب النتيجة كما ظهرت، بلا تفسير زائد أو استنتاج غير مدعوم.")} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              </label>
              <label className="space-y-2 text-sm font-bold">{ui("الدليل التحليلي الملخص")}<textarea dir="auto" value={finding.evidenceSummary} onChange={(event) => updateFinding(index, 'evidenceSummary', event.target.value)} maxLength={1200} rows={4} placeholder={ui("مثال كمي: قيمة الاختبار واتجاه العلاقة. مثال نوعي: الثيمة وعدد/نمط تكرارها.")} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              </label>
            </div>
          </article>)}
        </section>

        <aside aria-live="polite" className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black text-blue-950">{ui("ملخص ما أدخلته")}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${validationIssue ? 'bg-white text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>{validationIssue ? ui("قيد الاستكمال") : ui("جاهز للحفظ")}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs font-bold text-blue-700">{ui("نوع التحليل")}</dt><dd className="mt-1 font-black text-blue-950">{analysisKindLabel}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("الأسئلة المرتبطة")}</dt><dd className="mt-1 font-black text-blue-950">{completedFindings} {ui("من")}{' '}{form.findings.length}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("حماية البيانات")}</dt><dd className="mt-1 font-black text-blue-950">{form.noRawDataConfirmed && form.noPersonalDataConfirmed ? ui("تم تأكيد الخصوصية") : ui("بانتظار التأكيد")}</dd></div></dl></aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="space-y-2 text-sm font-bold">{ui("حدود التحليل")}<textarea dir="auto" value={form.limitations} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, limitations: event.target.value })); }} maxLength={1000} rows={3} placeholder={ui("اذكر ما يحد تفسير النتائج: حجم العينة، الاستجابة، الافتراضات، أو حدود الأداة.")} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
            <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" checked={form.noRawDataConfirmed} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, noRawDataConfirmed: event.target.checked })); }} className="mt-1 h-4 w-4" /><span>{ui("أؤكد أنني لم أرفع بيانات خام أو إجابات المشاركين.")}</span></label>
            <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" checked={form.noPersonalDataConfirmed} onChange={(event) => { markEdited(); setForm((current) => ({ ...current, noPersonalDataConfirmed: event.target.checked })); }} className="mt-1 h-4 w-4" /><span>{ui("أؤكد أن النص لا يتضمن اسماً أو بريداً أو هاتفاً أو أي معرّف شخصي.")}</span></label>
          </div>
          {validationIssue ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{ui(validationIssue)}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{ui(error)}</p> : null}
          <button type="button" onClick={() => void save()} disabled={Boolean(validationIssue) || status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? ui("جارٍ التحقق والحفظ…") : ui("احفظ ملخص التحليل واربطه بالأسئلة")}</button>
          {status === 'saved' && !validationIssue ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900"><strong>{ui("تم الحفظ والتحقق.")}</strong> {ui("أصبحت الأسئلة والفرضيات مرتبطة بمخرجات التحليل.")}<div><Link href={`/research/results?projectId=${encodeURIComponent(projectId)}`} className="mt-3 inline-flex rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white">{ui("انتقل إلى صياغة النتائج ←")}</Link></div></div> : null}
        </section>
      </> : null}
    </main>
  </div>;
}
