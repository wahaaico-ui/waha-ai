'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import SiteHeader from '@/components/SiteHeader';
import GoogleFormsExportPanel from '@/components/GoogleFormsExportPanel';
import { createGoogleFormsScript, type Questionnaire, type QuestionnaireItem, type QuestionnaireItemKind, type QuestionnaireSection } from '@/lib/google-forms-export';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { collectionGuidanceFor, instrumentLabel, isStudyInstrumentType, recommendStudyInstrument, STUDY_INSTRUMENT_TYPES, type StudyInstrumentType } from '@/lib/research-instrument';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';
import { useJourneyAutosave } from '@/lib/use-journey-autosave';

const LIKERT = ['لا أوافق بشدة', 'لا أوافق', 'محايد', 'أوافق', 'أوافق بشدة'];
const EMPTY: Questionnaire = { instrumentType: 'questionnaire', title: '', description: '', consentStatement: '', instructions: '', respondentFields: [], sections: [], collectionGuidance: [] };
const KINDS: Array<{ value: QuestionnaireItemKind; label: string }> = [
  { value: 'likert5', label: 'مقياس ليكرت خماسي' }, { value: 'single_choice', label: 'اختيار واحد' },
  { value: 'multiple_choice', label: 'اختيارات متعددة' }, { value: 'short_text', label: 'إجابة قصيرة' }, { value: 'long_text', label: 'إجابة مطولة' },
];

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function validKind(value: unknown): value is QuestionnaireItemKind { return KINDS.some((item) => item.value === value); }
function normalizeItem(value: unknown): QuestionnaireItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const kind = validKind(item.kind) ? item.kind : 'likert5';
  return { text: text(item.text), kind, required: item.required !== false, options: kind === 'likert5' ? LIKERT : Array.isArray(item.options) ? item.options.map(text).filter(Boolean) : [] };
}
function normalizeDraft(value: Record<string, unknown>, variables: string[], selectedType: StudyInstrumentType): Questionnaire {
  const sections = Array.isArray(value.sections) ? value.sections.flatMap((entry): QuestionnaireSection[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const section = entry as Record<string, unknown>;
    return [{ title: text(section.title), variableName: text(section.variableName), description: text(section.description), items: Array.isArray(section.items) ? section.items.map(normalizeItem).filter((item): item is QuestionnaireItem => Boolean(item)) : [] }];
  }) : [];
  const byVariable = new Map(sections.map((section) => [section.variableName.toLocaleLowerCase('ar'), section]));
  return {
    instrumentType: isStudyInstrumentType(value.instrumentType) ? value.instrumentType : selectedType,
    title: text(value.title), description: text(value.description), consentStatement: text(value.consentStatement), instructions: text(value.instructions),
    respondentFields: [],
    sections: variables.map((variable) => byVariable.get(variable.toLocaleLowerCase('ar')) || { title: `محور ${variable}`, variableName: variable, description: `بنود تقيس ${variable} وفق تعريفه الإجرائي في تصميم الدراسة.`, items: [] }),
    collectionGuidance: collectionGuidanceFor(selectedType),
  };
}

export default function InstrumentPage() {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

  const projectId = useProjectId();
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [designReady, setDesignReady] = useState(false);
  const [variables, setVariables] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [approach, setApproach] = useState('');
  const [methodologyInstrument, setMethodologyInstrument] = useState('');
  const [instrumentType, setInstrumentType] = useState<StudyInstrumentType>('questionnaire');
  const [instrument, setInstrument] = useState<Questionnaire>(EMPTY);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId).then((journey) => {
      const design = journey.outputs.design;
      setDesignReady(stageComplete('design', design));
      const names = Array.isArray(design?.variables) ? design.variables.flatMap((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? [text((entry as Record<string, unknown>).name)] : []).filter(Boolean) : [];
      setVariables(names);
      setQuestions(Array.isArray(journey.outputs.questions?.questions) ? journey.outputs.questions.questions.map(text).filter(Boolean) : []);
      const savedApproach = text(journey.outputs.methodology?.approach);
      const savedMethodologyInstrument = text(journey.outputs.methodology?.instrument);
      setApproach(savedApproach);
      setMethodologyInstrument(savedMethodologyInstrument);
      const recommended = recommendStudyInstrument({ approach: savedApproach, methodologyInstrument: savedMethodologyInstrument, questions: journey.outputs.questions?.questions });
      const savedInstrument = journey.drafts.instrument?.content ?? journey.outputs.instrument;
      if (savedInstrument) {
        const savedType = isStudyInstrumentType(savedInstrument.instrumentType) ? savedInstrument.instrumentType : 'questionnaire';
        setInstrumentType(savedType);
        setInstrument(normalizeDraft(savedInstrument, names, savedType));
        setStatus(journey.drafts.instrument ? 'idle' : 'saved');
      } else {
        setInstrumentType(recommended.type);
        setInstrument((current) => ({ ...current, instrumentType: recommended.type, collectionGuidance: recommended.guidance }));
      }
    }).catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.')).finally(() => setLoading(false));
  }, [projectId]);

  const recommendation = useMemo(() => recommendStudyInstrument({ approach, methodologyInstrument, questions }), [approach, methodologyInstrument, questions]);
  const itemCount = useMemo(() => instrument.sections.reduce((total, section) => total + section.items.length, 0), [instrument.sections]);
  const coveredVariableCount = useMemo(() => {
    const covered = new Set(instrument.sections.map((section) => section.variableName.trim().toLocaleLowerCase('ar')).filter(Boolean));
    return variables.filter((variable) => covered.has(variable.toLocaleLowerCase('ar'))).length;
  }, [instrument.sections, variables]);

  const issue = useMemo(() => {
    if (instrument.title.trim().length < 10) return 'اكتب عنواناً واضحاً للأداة.';
    if (instrument.consentStatement.trim().length < 30) return 'أضف نص موافقة يشرح المشاركة والخصوصية بوضوح.';
    if (instrument.instructions.trim().length < 20) return 'أضف تعليمات واضحة للمجيب.';
    const minimumSections = 1;
    const minimumItems = instrumentType === 'questionnaire' ? 3 : 2;
    if (instrument.sections.length < minimumSections) return `تحتاج ${ui(instrumentLabel(instrumentType))} إلى ${minimumSections === 1 ? 'محور واحد على الأقل' : 'محورين على الأقل'}.`;
    const covered = new Set(instrument.sections.map((section) => section.variableName.trim().toLocaleLowerCase('ar')));
    const missing = variables.filter((variable) => !covered.has(variable.toLocaleLowerCase('ar')));
    if (missing.length) return `لم تُغطَّ المتغيرات التالية: ${missing.join('، ')}.`;
    if (instrument.sections.some((section) => section.title.trim().length < 3 || section.items.length < minimumItems)) return `لكل محور عنوان و${minimumItems} ${minimumItems === 2 ? 'بندين' : 'بنود'} على الأقل.`;
    const items = instrument.sections.flatMap((section) => section.items);
    if (instrumentType === 'interview' && items.some((item) => item.kind !== 'long_text')) return 'أسئلة المقابلة يجب أن تكون مفتوحة بإجابة مطولة.';
    if (instrumentType === 'observation' && !items.some((item) => item.kind === 'single_choice')) return 'بطاقة الملاحظة تحتاج مؤشراً واحداً على الأقل بخيارات رصد واضحة.';
    if (instrumentType === 'test_scale' && items.some((item) => item.kind !== 'long_text')) return 'خطة المقياس المقنّن توثّق الاختيار والترخيص والخصائص ولا تنشئ بنود قياس جديدة.';
    if (items.some((item) => item.text.trim().length < 12 || item.text.trim().split(/\s+/u).length < 3)) return 'كل بند يجب أن يكون جملة واضحة من ثلاث كلمات على الأقل.';
    const normalized = items.map((item) => item.text.trim().toLocaleLowerCase('ar'));
    if (new Set(normalized).size !== normalized.length) return 'احذف البنود المكررة.';
    if (items.some((item) => (item.kind === 'single_choice' || item.kind === 'multiple_choice') && item.options.filter(Boolean).length < 2)) return 'أسئلة الاختيار تحتاج خيارين على الأقل.';
    return '';
  }, [instrument, instrumentType, variables, ui]);
  useJourneyAutosave({
    projectId,
    stage: 'instrument',
    content: { ...instrument, instrumentType, collectionGuidance: collectionGuidanceFor(instrumentType) },
    enabled: Boolean(projectId && !loading && designReady),
  });

  const chooseInstrumentType = (nextType: StudyInstrumentType) => {
    setInstrumentType(nextType);
    setInstrument((current) => ({ ...current, instrumentType: nextType, collectionGuidance: collectionGuidanceFor(nextType) }));
    setStatus('idle');
  };

  const updateSection = (index: number, next: QuestionnaireSection) => { setInstrument((current) => ({ ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? next : item) })); setStatus('idle'); };
  const save = async () => {
    if (!projectId || issue) return;
    setStatus('saving'); setSaveError('');
    try { await saveJourneyStage(projectId, 'instrument', { ...instrument, instrumentType, collectionGuidance: collectionGuidanceFor(instrumentType) }); setStatus('saved'); }
    catch (reason) { setSaveError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ الأداة.'); setStatus('error'); }
  };
  const downloadGoogleScript = () => {
    if (issue) return;
    const blob = new Blob([createGoogleFormsScript(instrument)], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'WAHA_Google_Form.gs'; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div dir={uiDirection} className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="instrument" lang={uiLanguage} /><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{ui("تحويل التصميم إلى أداة عملية")}</div><h1 className="mt-4 text-3xl font-black">{ui("ابنِ الأداة المناسبة لجمع أدلتك")}</h1><p className="mt-3 text-sm leading-7 text-slate-600">{ui("نقرأ المنهج والأسئلة ونقترح الأداة الأنسب مع سبب الاختيار، ثم نبني مسودة قابلة للتحرير والمراجعة. جمع البيانات والموافقات والتطبيق الفعلي تبقى مسؤولية الباحث.")}</p></header>
    {loading ? <section className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">{ui("جارٍ تحميل تصميم الدراسة…")}</section> : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">{ui("سجّل الدخول للمتابعة من مشروعك")}</h2><p className="mt-3 text-sm leading-7">{ui("سنربط الأداة بأسئلتك ومتغيراتك ونحفظها داخل المشروع.")}</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("تسجيل الدخول")}</Link></section> : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{ui(loadError)}</section> : !designReady ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">{ui("أكمل خريطة الدراسة أولاً")}</h2><p className="mt-3 text-sm leading-7">{ui("نحتاج المتغيرات أو المفاهيم ومجتمع الدراسة والعينة كي نبني أداة تغطي بحثك فعلاً.")}</p><Link href={`/research/design?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold">{ui("إكمال خريطة الدراسة")}</Link></section> : <>
      <details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7"><summary className="cursor-pointer font-black text-emerald-950">{ui("عرض ما يجب أن تغطيه الأداة")}</summary><div className="mt-3"><strong>{ui("المتغيرات أو المفاهيم:")}</strong> {variables.join(ui("،"))}<br /><strong>{ui("الأسئلة الموجِّهة:")}</strong> {questions.length} {ui("أسئلة محفوظة.")}</div></details>
      <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6"><div className="flex items-start gap-3"><ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-blue-700" /><div><h2 className="font-black text-slate-950">{ui("توصية WAHA:")}{' '}{ui(recommendation.label)}</h2><p className="mt-2 text-sm leading-7 text-slate-700">{recommendation.reason}</p></div></div><label className="block text-xs font-bold text-slate-800">{ui("الأداة التي ستبنيها الآن")}<select value={instrumentType} onChange={(event) => chooseInstrumentType(event.target.value as StudyInstrumentType)} className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm">{STUDY_INSTRUMENT_TYPES.map((type) => <option key={type} value={type}>{ui(instrumentLabel(type))}{type === recommendation.type ? ui("— موصى بها") : ''}</option>)}</select></label>{instrumentType !== recommendation.type && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">{ui("اخترت أداة غير التوصية الآلية. راجع مبرر الاختيار مع المشرف وتأكد من اتساقها مع المنهج والأسئلة.")}</p>}</section>
      <ResearchDraftAssistant projectId={projectId} stage="instrument" showTools={false} draftOptions={{ instrumentType }} onDraft={(draft) => { setInstrument(normalizeDraft(draft, variables, instrumentType)); setStatus('idle'); }} />
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">{ui("عنوان")}{' '}{ui(instrumentLabel(instrumentType))}<input value={instrument.title} onChange={(event) => { setInstrument((current) => ({ ...current, title: event.target.value })); setStatus('idle'); }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label><label className="text-xs font-bold">{ui("وصف مختصر")}<input value={instrument.description} onChange={(event) => { setInstrument((current) => ({ ...current, description: event.target.value })); setStatus('idle'); }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label></div>
        <label className="block text-xs font-bold">{ui("موافقة المشارك")}<textarea dir="auto" value={instrument.consentStatement} onChange={(event) => { setInstrument((current) => ({ ...current, consentStatement: event.target.value })); setStatus('idle'); }} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" placeholder={ui("اشرح هدف المشاركة وطوعيتها وسرية البيانات…")} /></label><label className="block text-xs font-bold">{ui("التعليمات")}<textarea dir="auto" value={instrument.instructions} onChange={(event) => { setInstrument((current) => ({ ...current, instructions: event.target.value })); setStatus('idle'); }} className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" /></label>
        {instrument.sections.map((section, sectionIndex) => <fieldset key={`${section.variableName}-${sectionIndex}`} className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><legend className="px-2 text-sm font-black">{section.title || ui("المحور {0}", [sectionIndex + 1])}</legend><div className="grid gap-3 sm:grid-cols-2"><input aria-label={ui("عنوان المحور")} value={section.title} onChange={(event) => updateSection(sectionIndex, { ...section, title: event.target.value })} className="rounded-xl border border-slate-300 bg-white p-3 text-sm" /><select aria-label={ui("المتغير المقاس")} value={section.variableName} onChange={(event) => updateSection(sectionIndex, { ...section, variableName: event.target.value })} className="rounded-xl border border-slate-300 bg-white p-3 text-sm">{variables.map((variable) => <option key={variable}>{variable}</option>)}</select></div>
          {section.items.map((item, itemIndex) => <div key={itemIndex} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_180px_auto]"><textarea dir="auto" aria-label={ui("البند {0}", [itemIndex + 1])} value={item.text} onChange={(event) => updateSection(sectionIndex, { ...section, items: section.items.map((entry, index) => index === itemIndex ? { ...entry, text: event.target.value } : entry) })} className="min-h-16 rounded-lg border border-slate-300 p-2 text-sm" /><select aria-label={ui("نوع البند")} value={item.kind} onChange={(event) => { const kind = event.target.value as QuestionnaireItemKind; updateSection(sectionIndex, { ...section, items: section.items.map((entry, index) => index === itemIndex ? { ...entry, kind, options: kind === 'likert5' ? LIKERT : entry.options } : entry) }); }} className="rounded-lg border border-slate-300 p-2 text-xs">{KINDS.map((kind) => <option key={kind.value} value={kind.value}>{ui(kind.label)}</option>)}</select><button type="button" aria-label={ui("حذف البند")} onClick={() => updateSection(sectionIndex, { ...section, items: section.items.filter((_, index) => index !== itemIndex) })} className="rounded-lg p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>{(item.kind === 'single_choice' || item.kind === 'multiple_choice') && <input aria-label={ui("خيارات البند")} value={item.options.join('، ')} onChange={(event) => updateSection(sectionIndex, { ...section, items: section.items.map((entry, index) => index === itemIndex ? { ...entry, options: event.target.value.split('،').map((option) => option.trim()) } : entry) })} className="rounded-lg border border-slate-300 p-2 text-xs md:col-span-2" placeholder={ui("الخيار الأول، الخيار الثاني")} />}</div>)}
          <button type="button" onClick={() => updateSection(sectionIndex, { ...section, items: [...section.items, { text: '', kind: instrumentType === 'interview' ? 'long_text' : 'likert5', required: true, options: instrumentType === 'interview' ? [] : LIKERT }] })} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700"><Plus className="h-4 w-4" />{ui("إضافة بند")}</button></fieldset>)}
        <aside aria-live="polite" className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black text-blue-950">{ui("الأداة التي أصبحت لديك")}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${issue ? 'bg-white text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>{issue ? ui("قيد المراجعة") : ui("جاهزة للحفظ")}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs font-bold text-blue-700">{ui("النوع")}</dt><dd className="mt-1 font-black text-blue-950">{ui(instrumentLabel(instrumentType))}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("المحاور")}</dt><dd className="mt-1 font-black text-blue-950">{instrument.sections.length}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("البنود أو الأسئلة")}</dt><dd className="mt-1 font-black text-blue-950">{itemCount}</dd></div><div><dt className="text-xs font-bold text-blue-700">{ui("تغطية التصميم")}</dt><dd className="mt-1 font-black text-blue-950">{coveredVariableCount} {ui("من")}{' '}{variables.length}</dd></div></dl>{instrument.title.trim() ? <p className="mt-4 border-t border-blue-200 pt-4 text-sm font-bold leading-7 text-blue-950">{instrument.title.trim()}</p> : null}</aside>
        <details className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><summary className="cursor-pointer font-black">{ui("إرشادات التطبيق الآمن والجيد")}</summary><p className="mt-3 text-xs leading-6 text-slate-600">{ui("هذه إرشادات تنفيذية فقط؛ جمع البيانات ومسؤولية الموافقات وجودة التطبيق تبقى على الباحث ومؤسسته.")}</p><ol className="mt-4 space-y-2 text-sm leading-7 text-slate-700">{collectionGuidanceFor(instrumentType).map((item, index) => <li key={item} className="flex gap-3"><span className="font-black text-blue-700">{index + 1}.</span><span>{item}</span></li>)}</ol></details>
        {issue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{ui(issue)}</p>}
        {status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{ui(saveError)}</p>}
        <button type="button" disabled={Boolean(issue) || status === 'saving'} onClick={() => void save()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? ui("جارٍ الحفظ والفحص…") : ui("احفظ {0} وافحص تغطيتها", [instrumentLabel(instrumentType)])}</button>
        {status === 'saved' && <div className="space-y-3">{instrumentType === 'questionnaire' && <GoogleFormsExportPanel projectId={projectId} onDownload={downloadGoogleScript} />}<Link href={`/research/literature?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">{ui("الأداة محفوظة وتغطي تصميمك. ابدأ جمع وتنظيم الأدبيات ←")}</Link></div>}
      </section></>}
  </main></div>;
}
