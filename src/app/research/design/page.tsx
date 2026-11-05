'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import SiteHeader from '@/components/SiteHeader';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';
import { useJourneyAutosave } from '@/lib/use-journey-autosave';
import SampleSizeCalculator from '@/components/SampleSizeCalculator';
import { appendSampleSizeNote } from '@/lib/sample-size';

type VariableRole = 'independent' | 'dependent' | 'predictor' | 'outcome' | 'control' | 'concept';
type Variable = { name: string; role: VariableRole; operationalDefinition: string };
type StudyDesign = {
  variables: Variable[];
  population: { description: string; location: string; timeframe: string };
  sample: { strategy: string; inclusionCriteria: string; sizeRationale: string };
};

const EMPTY_DESIGN: StudyDesign = {
  variables: [{ name: '', role: 'concept', operationalDefinition: '' }],
  population: { description: '', location: '', timeframe: '' },
  sample: { strategy: '', inclusionCriteria: '', sizeRationale: '' },
};

const ROLES: Array<{ value: VariableRole; label: string }> = [
  { value: 'independent', label: 'مستقل' }, { value: 'dependent', label: 'تابع' },
  { value: 'predictor', label: 'متنبئ' }, { value: 'outcome', label: 'ناتج' },
  { value: 'control', label: 'ضابط' }, { value: 'concept', label: 'مفهوم/محور نوعي' },
];

function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function validRole(value: unknown): value is VariableRole { return ROLES.some((role) => role.value === value); }

export default function StudyDesignPage() {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

  const projectId = useProjectId();
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [methodReady, setMethodReady] = useState(false);
  const [approach, setApproach] = useState('');
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [design, setDesign] = useState<StudyDesign>(EMPTY_DESIGN);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId).then((journey) => {
      const methodology = journey.outputs.methodology;
      setMethodReady(stageComplete('methodology', methodology));
      setApproach(text(methodology?.approach));
      const hypothesisOutput = journey.outputs.hypotheses;
      setHypotheses(Array.isArray(hypothesisOutput?.hypotheses) ? hypothesisOutput.hypotheses.filter((item): item is string => typeof item === 'string') : []);
      const saved = journey.drafts.design?.content ?? journey.outputs.design;
      if (saved) {
        const savedVariables = Array.isArray(saved.variables) ? saved.variables.flatMap((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
          const value = item as Record<string, unknown>;
          return [{ name: text(value.name), role: validRole(value.role) ? value.role : 'concept', operationalDefinition: text(value.operationalDefinition) }];
        }) : [];
        const population = saved.population && typeof saved.population === 'object' && !Array.isArray(saved.population) ? saved.population as Record<string, unknown> : {};
        const sample = saved.sample && typeof saved.sample === 'object' && !Array.isArray(saved.sample) ? saved.sample as Record<string, unknown> : {};
        setDesign({
          variables: savedVariables.length ? savedVariables : EMPTY_DESIGN.variables,
          population: { description: text(population.description), location: text(population.location), timeframe: text(population.timeframe) },
          sample: { strategy: text(sample.strategy), inclusionCriteria: text(sample.inclusionCriteria), sizeRationale: text(sample.sizeRationale) },
        });
      } else if (methodology) {
        setDesign((current) => ({
          ...current,
          population: { ...current.population, description: text(methodology.population) },
          sample: { ...current.sample, strategy: text(methodology.sample) },
        }));
      }
    }).catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.')).finally(() => setLoading(false));
  }, [projectId]);

  const quantitative = approach === 'quantitative' || approach === 'mixed';
  const approachLabel = ({ quantitative: 'كمي', qualitative: 'نوعي', mixed: 'مختلط', descriptive: 'وصفي/تحليلي' } as Record<string, string>)[approach] || approach;
  const filledVariables = design.variables.filter((item) => item.name.trim() || item.operationalDefinition.trim());
  const issue = useMemo(() => {
    const variables = design.variables.filter((item) => item.name.trim() || item.operationalDefinition.trim());
    if (!variables.length) return 'أضف متغيراً أو مفهوماً واحداً على الأقل.';
    if (variables.some((item) => item.name.trim().length < 3 || item.operationalDefinition.trim().length < 20)) return 'لكل متغير اسم واضح وتعريف إجرائي من 20 حرفاً على الأقل.';
    if (quantitative && variables.length < 2) return 'التصميم الكمي أو المختلط يحتاج متغيرين على الأقل.';
    if (quantitative && !variables.some((item) => item.role === 'independent' || item.role === 'predictor')) return 'حدّد متغيراً مستقلاً أو متنبئاً.';
    if (quantitative && !variables.some((item) => item.role === 'dependent' || item.role === 'outcome')) return 'حدّد متغيراً تابعاً أو ناتجاً.';
    if (design.population.description.trim().length < 20) return 'صف مجتمع الدراسة بدقة أكبر.';
    if (design.sample.strategy.trim().length < 15 || design.sample.inclusionCriteria.trim().length < 20 || design.sample.sizeRationale.trim().length < 20) return 'أكمل استراتيجية العينة ومعايير الاشتمال ومبرر الحجم.';
    return '';
  }, [design, quantitative]);
  useJourneyAutosave({
    projectId,
    stage: 'design',
    content: design as unknown as Record<string, unknown>,
    enabled: Boolean(projectId && !loading && methodReady),
  });

  const updateVariable = <K extends keyof Variable,>(index: number, field: K, value: Variable[K]) => {
    setDesign((current) => ({ ...current, variables: current.variables.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
    setStatus('idle');
  };
  const save = async () => {
    if (!projectId || issue) return;
    setStatus('saving'); setSaveError('');
    try {
      await saveJourneyStage(projectId, 'design', {
        variables: design.variables.map((item) => ({ ...item, name: item.name.trim(), operationalDefinition: item.operationalDefinition.trim() })),
        population: Object.fromEntries(Object.entries(design.population).map(([key, value]) => [key, value.trim()])),
        sample: Object.fromEntries(Object.entries(design.sample).map(([key, value]) => [key, value.trim()])),
      });
      setStatus('saved');
    } catch (reason) {
      setSaveError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ تصميم الدراسة.');
      setStatus('error');
    }
  };

  return <div dir={uiDirection} className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="design" lang={uiLanguage} /><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{ui("بناء خريطة تنفيذ الدراسة")}</div><h1 className="mt-4 text-3xl font-black">{ui("حوّل خطتك إلى دراسة يمكن تنفيذها")}</h1><p className="mt-3 text-sm leading-7 text-slate-600">{ui("حدّد ما ستقيسه أو تفهمه، ومن تشملهم الدراسة، وكيف ستختار الحالات. سنعرض الخريطة أمامك ونتحقق من ترابطها من دون اختلاق حجم عينة أو نتائج.")}</p></header>
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ui("جارٍ تحميل المنهجية…")}</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">{ui("سجّل الدخول للمتابعة من مشروعك")}</h2><p className="mt-3 text-sm leading-7">{ui("سنحفظ تصميمك ونربطه بخطة الإجابة المعتمدة.")}</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("تسجيل الدخول")}</Link></section>
    : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{ui(loadError)}</section>
    : !methodReady ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">{ui("أكمل خطة الإجابة أولاً")}</h2><p className="mt-3 text-sm leading-7">{ui("نحتاج المنهج ومجتمع الدراسة والعينة المبدئية كي نبني تصميماً مترابطاً.")}</p><Link href={`/research/methodology?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold">{ui("إكمال خطة الإجابة")}</Link></section>
    : <><details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-950"><summary className="cursor-pointer font-black">{ui("عرض الأساس المعتمد لهذا التصميم")}</summary><div className="mt-3"><strong>{ui("المنهج:")}</strong> {approachLabel}<br /><strong>{ui("الفرضيات:")}</strong> {hypotheses.length ? ui("{0} فرضيات محفوظة يجب أن يغطيها التصميم", [hypotheses.length]) : ui("لا توجد فرضيات اختبارية؛ سيُنظّم التصميم المفاهيم أو المحاور النوعية.")}</div></details>
      <details className="rounded-2xl border border-blue-200 bg-white p-5"><summary className="cursor-pointer font-bold text-blue-700">{uiLanguage === 'ar' ? 'حاسبة حجم العينة ومبرر الحساب' : 'Sample size calculator and rationale'}</summary><div className="mt-5"><SampleSizeCalculator language={uiLanguage} onApply={(note) => { setDesign(current => ({ ...current, sample: { ...current.sample, sizeRationale: appendSampleSizeNote(current.sample.sizeRationale, note) } })); setStatus('idle'); }}/></div></details>
      <ResearchDraftAssistant projectId={projectId} stage="design" showTools={false} onDraft={(draft) => {
        const variables = Array.isArray(draft.variables) ? draft.variables.flatMap((item) => { if (!item || typeof item !== 'object' || Array.isArray(item)) return []; const value = item as Record<string, unknown>; return [{ name: text(value.name), role: validRole(value.role) ? value.role : 'concept', operationalDefinition: text(value.operationalDefinition) }]; }) : [];
        const population = draft.population && typeof draft.population === 'object' && !Array.isArray(draft.population) ? draft.population as Record<string, unknown> : {};
        const sample = draft.sample && typeof draft.sample === 'object' && !Array.isArray(draft.sample) ? draft.sample as Record<string, unknown> : {};
        setDesign({ variables: variables.length ? variables : design.variables, population: { description: text(population.description) || design.population.description, location: text(population.location), timeframe: text(population.timeframe) }, sample: { strategy: text(sample.strategy) || design.sample.strategy, inclusionCriteria: text(sample.inclusionCriteria), sizeRationale: text(sample.sizeRationale) } }); setStatus('idle');
      }} />
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><div><h2 className="font-black">{ui("ما الذي ستقيسه أو تفهمه؟")}</h2><p className="mt-1 text-xs text-slate-500">{ui("عرّف كل متغير أو مفهوم كما سيظهر فعلياً داخل دراستك.")}</p></div><button type="button" onClick={() => { setDesign((current) => ({ ...current, variables: [...current.variables, { name: '', role: quantitative ? 'control' : 'concept', operationalDefinition: '' }] })); setStatus('idle'); }} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Plus className="h-4 w-4" />{ui("إضافة عنصر")}</button></div>
        {design.variables.map((variable, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_180px_2fr_auto]"><input aria-label={ui("اسم المتغير {0}", [index + 1])} value={variable.name} onChange={(event) => updateVariable(index, 'name', event.target.value)} className="rounded-xl border border-slate-300 bg-white p-3 text-sm" placeholder={ui("اسم المتغير أو المفهوم")} /><select aria-label={ui("دور المتغير {0}", [index + 1])} value={variable.role} onChange={(event) => updateVariable(index, 'role', event.target.value as VariableRole)} className="rounded-xl border border-slate-300 bg-white p-3 text-sm">{ROLES.map((role) => <option key={role.value} value={role.value}>{ui(role.label)}</option>)}</select><textarea dir="auto" aria-label={ui("التعريف الإجرائي {0}", [index + 1])} value={variable.operationalDefinition} onChange={(event) => updateVariable(index, 'operationalDefinition', event.target.value)} className="min-h-20 rounded-xl border border-slate-300 bg-white p-3 text-sm leading-7" placeholder={ui("كيف سيُعرّف أو يُلاحظ أو يُقاس داخل هذه الدراسة؟")} /><button type="button" aria-label={ui("حذف المتغير {0}", [index + 1])} disabled={design.variables.length === 1} onClick={() => { setDesign((current) => ({ ...current, variables: current.variables.filter((_, itemIndex) => itemIndex !== index) })); setStatus('idle'); }} className="self-center rounded-lg p-2 text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}
        <div className="grid gap-5 md:grid-cols-2"><fieldset className="space-y-3 rounded-xl border border-slate-200 p-4"><legend className="px-2 text-sm font-black">{ui("مجتمع الدراسة")}</legend>{([['description', ui("وصف المجتمع"), ui("الفئة المستهدفة بدقة")], ['location', ui("المكان/السياق"), ui("الدولة أو المؤسسة أو البيئة")], ['timeframe', ui("الإطار الزمني"), ui("الفترة التي تغطيها الدراسة")]] as const).map(([field, label, placeholder]) => <label key={field} className="block text-xs font-bold">{ui(label)}<textarea dir="auto" value={design.population[field]} onChange={(event) => { setDesign((current) => ({ ...current, population: { ...current.population, [field]: event.target.value } })); setStatus('idle'); }} className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" placeholder={placeholder} /></label>)}</fieldset><fieldset className="space-y-3 rounded-xl border border-slate-200 p-4"><legend className="px-2 text-sm font-black">{ui("العينة")}</legend>{([['strategy', ui("استراتيجية الاختيار"), ui("عشوائية، طبقية، قصدية... ولماذا")], ['inclusionCriteria', ui("معايير الاشتمال"), ui("من يُقبل ضمن العينة ومن يُستبعد؟")], ['sizeRationale', ui("مبرر الحجم"), ui("تحليل قدرة، تشبع بيانات، أو مبرر منهجي دون رقم مختلق")]] as const).map(([field, label, placeholder]) => <label key={field} className="block text-xs font-bold">{ui(label)}<textarea dir="auto" value={design.sample[field]} onChange={(event) => { setDesign((current) => ({ ...current, sample: { ...current.sample, [field]: event.target.value } })); setStatus('idle'); }} className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" placeholder={placeholder} /></label>)}</fieldset></div>
        <aside aria-live="polite" className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-black text-blue-950">{ui("خريطة دراستك الآن")}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${issue ? 'bg-white text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>{issue ? ui("قيد البناء") : ui("جاهزة للحفظ")}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold text-blue-700">{ui("طريقة الدراسة")}</dt><dd className="mt-1 font-black text-blue-950">{approachLabel}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("ما ستدرسه")}</dt><dd className="mt-1 leading-6 text-blue-950">{filledVariables.length ? filledVariables.map((item) => item.name.trim()).filter(Boolean).join(ui("،")) : ui("لم تُضف المتغيرات أو المفاهيم بعد")}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("نطاق الدراسة")}</dt><dd className="mt-1 leading-6 text-blue-950">{[design.population.description, design.population.location, design.population.timeframe].map((value) => value.trim()).filter(Boolean).join(' · ') || ui("لم يكتمل وصف المجتمع والمكان والزمن")}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("طريقة اختيار الحالات")}</dt><dd className="mt-1 leading-6 text-blue-950">{design.sample.strategy.trim() || ui("لم تُحدّد بعد")}</dd></div></dl></aside>
        {issue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{ui("حتى تصبح الخريطة قابلة للحفظ:")}{' '}{ui(issue)}</p>}{status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{ui(saveError)}</p>}<button type="button" disabled={Boolean(issue) || status === 'saving'} onClick={() => void save()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? ui("جارٍ الحفظ…") : ui("احفظ خريطة الدراسة")}</button>{status === 'saved' && <Link href={`/research/instrument?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">{ui("خريطة الدراسة محفوظة. ابنِ أداة جمع البيانات المناسبة ←")}</Link>}</section></>}
  </main></div>;
}
