'use client';

import Link from 'next/link';
import { Download, ExternalLink, FilePlus2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import SiteHeader from '@/components/SiteHeader';
import { createGoogleFormsScript, type Questionnaire, type QuestionnaireItem, type QuestionnaireItemKind, type QuestionnaireSection } from '@/lib/google-forms-export';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';

const LIKERT = ['لا أوافق بشدة', 'لا أوافق', 'محايد', 'أوافق', 'أوافق بشدة'];
const EMPTY: Questionnaire = { title: '', description: '', consentStatement: '', instructions: '', respondentFields: [], sections: [] };
const KINDS: Array<{ value: QuestionnaireItemKind; label: string }> = [
  { value: 'likert5', label: 'مقياس ليكرت خماسي' }, { value: 'single_choice', label: 'اختيار واحد' },
  { value: 'multiple_choice', label: 'اختيارات متعددة' }, { value: 'short_text', label: 'إجابة قصيرة' }, { value: 'long_text', label: 'إجابة مطولة' },
];

type GoogleFormFeedback = {
  kind: 'success' | 'error' | 'config' | 'not-ready' | 'forbidden';
  editUrl?: string;
  responderUri?: string;
};

function googleFormsFeedbackFromLocation(): GoogleFormFeedback | null {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('googleForm');
  if (!result) return null;
  if (result === 'created') {
    const formId = params.get('formId') || '';
    const responderValue = params.get('responderUri') || '';
    const editUrl = /^[A-Za-z0-9_-]{10,}$/u.test(formId) ? `https://docs.google.com/forms/d/${encodeURIComponent(formId)}/edit` : undefined;
    let responderUri: string | undefined;
    try {
      const parsed = new URL(responderValue);
      if (parsed.protocol === 'https:' && parsed.hostname === 'docs.google.com') responderUri = parsed.toString();
    } catch { responderUri = undefined; }
    return { kind: 'success', editUrl, responderUri };
  }
  if (result === 'config') return { kind: 'config' };
  if (result === 'not-ready') return { kind: 'not-ready' };
  if (result === 'forbidden') return { kind: 'forbidden' };
  return { kind: 'error' };
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function validKind(value: unknown): value is QuestionnaireItemKind { return KINDS.some((item) => item.value === value); }
function normalizeItem(value: unknown): QuestionnaireItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const kind = validKind(item.kind) ? item.kind : 'likert5';
  return { text: text(item.text), kind, required: item.required !== false, options: kind === 'likert5' ? LIKERT : Array.isArray(item.options) ? item.options.map(text).filter(Boolean) : [] };
}
function normalizeDraft(value: Record<string, unknown>, variables: string[]): Questionnaire {
  const sections = Array.isArray(value.sections) ? value.sections.flatMap((entry): QuestionnaireSection[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const section = entry as Record<string, unknown>;
    return [{ title: text(section.title), variableName: text(section.variableName), description: text(section.description), items: Array.isArray(section.items) ? section.items.map(normalizeItem).filter((item): item is QuestionnaireItem => Boolean(item)) : [] }];
  }) : [];
  const byVariable = new Map(sections.map((section) => [section.variableName.toLocaleLowerCase('ar'), section]));
  return {
    title: text(value.title), description: text(value.description), consentStatement: text(value.consentStatement), instructions: text(value.instructions),
    respondentFields: [],
    sections: variables.map((variable) => byVariable.get(variable.toLocaleLowerCase('ar')) || { title: `محور ${variable}`, variableName: variable, description: `بنود تقيس ${variable} وفق تعريفه الإجرائي في تصميم الدراسة.`, items: [] }),
  };
}

export default function InstrumentPage() {
  const projectId = useProjectId();
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [designReady, setDesignReady] = useState(false);
  const [variables, setVariables] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [instrument, setInstrument] = useState<Questionnaire>(EMPTY);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [googleFormFeedback, setGoogleFormFeedback] = useState<GoogleFormFeedback | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const feedbackTimer = window.setTimeout(() => {
      setGoogleFormFeedback(googleFormsFeedbackFromLocation());
    }, 0);
    loadJourney(projectId).then((journey) => {
      const design = journey.outputs.design;
      setDesignReady(stageComplete('design', design));
      const names = Array.isArray(design?.variables) ? design.variables.flatMap((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? [text((entry as Record<string, unknown>).name)] : []).filter(Boolean) : [];
      setVariables(names);
      setQuestions(Array.isArray(journey.outputs.questions?.questions) ? journey.outputs.questions.questions.map(text).filter(Boolean) : []);
      if (journey.outputs.instrument) {
        setInstrument(normalizeDraft(journey.outputs.instrument, names));
        setStatus('saved');
      }
    }).catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.')).finally(() => setLoading(false));
    return () => window.clearTimeout(feedbackTimer);
  }, [projectId]);

  const issue = useMemo(() => {
    if (instrument.title.trim().length < 10) return 'اكتب عنواناً واضحاً للأداة.';
    if (instrument.consentStatement.trim().length < 30) return 'أضف نص موافقة يشرح المشاركة والخصوصية بوضوح.';
    if (instrument.instructions.trim().length < 20) return 'أضف تعليمات واضحة للمجيب.';
    if (instrument.sections.length < 2) return 'تحتاج الاستبانة محورين على الأقل.';
    const covered = new Set(instrument.sections.map((section) => section.variableName.trim().toLocaleLowerCase('ar')));
    const missing = variables.filter((variable) => !covered.has(variable.toLocaleLowerCase('ar')));
    if (missing.length) return `لم تُغطَّ المتغيرات التالية: ${missing.join('، ')}.`;
    if (instrument.sections.some((section) => section.title.trim().length < 3 || section.items.length < 3)) return 'لكل محور عنوان وثلاثة بنود على الأقل.';
    const items = instrument.sections.flatMap((section) => section.items);
    if (items.some((item) => item.text.trim().length < 12 || item.text.trim().split(/\s+/u).length < 3)) return 'كل بند يجب أن يكون جملة واضحة من ثلاث كلمات على الأقل.';
    const normalized = items.map((item) => item.text.trim().toLocaleLowerCase('ar'));
    if (new Set(normalized).size !== normalized.length) return 'احذف البنود المكررة.';
    if (items.some((item) => (item.kind === 'single_choice' || item.kind === 'multiple_choice') && item.options.filter(Boolean).length < 2)) return 'أسئلة الاختيار تحتاج خيارين على الأقل.';
    return '';
  }, [instrument, variables]);

  const updateSection = (index: number, next: QuestionnaireSection) => { setInstrument((current) => ({ ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? next : item) })); setStatus('idle'); };
  const save = async () => {
    if (!projectId || issue) return;
    setStatus('saving'); setSaveError('');
    try { await saveJourneyStage(projectId, 'instrument', instrument); setStatus('saved'); }
    catch (reason) { setSaveError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ الأداة.'); setStatus('error'); }
  };
  const downloadGoogleScript = () => {
    if (issue) return;
    const blob = new Blob([createGoogleFormsScript(instrument)], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'WAHA_Google_Form.gs'; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="instrument" lang="ar" /><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 9 · أداة الدراسة</div><h1 className="mt-4 text-3xl font-black">ابنِ استبانة مرتبطة بأسئلتك ومتغيراتك</h1><p className="mt-3 text-sm leading-7 text-slate-600">يحوّل النظام تصميمك إلى مسودة قابلة للتحرير، ثم يفحص تغطية المتغيرات. تبقى الأداة بحاجة إلى تحكيم خبراء وتجربة استطلاعية قبل التوزيع.</p></header>
    {loading ? <section className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل تصميم الدراسة…</section> : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section> : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</section> : !designReady ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">اعتمد تصميم الدراسة أولاً</h2><Link href={`/research/design?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold">مراجعة التصميم</Link></section> : <>
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7"><strong>المتغيرات المطلوب قياسها:</strong> {variables.join('، ')}<br /><strong>الأسئلة التي توجّه الأداة:</strong> {questions.length} أسئلة محفوظة.</section>
      <ResearchDraftAssistant projectId={projectId} stage="instrument" showTools={false} onDraft={(draft) => { setInstrument(normalizeDraft(draft, variables)); setStatus('idle'); }} />
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">عنوان الاستبانة<input value={instrument.title} onChange={(event) => { setInstrument((current) => ({ ...current, title: event.target.value })); setStatus('idle'); }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label><label className="text-xs font-bold">وصف مختصر<input value={instrument.description} onChange={(event) => setInstrument((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label></div>
        <label className="block text-xs font-bold">موافقة المشارك<textarea value={instrument.consentStatement} onChange={(event) => { setInstrument((current) => ({ ...current, consentStatement: event.target.value })); setStatus('idle'); }} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" placeholder="اشرح هدف المشاركة وطوعيتها وسرية البيانات…" /></label><label className="block text-xs font-bold">التعليمات<textarea value={instrument.instructions} onChange={(event) => { setInstrument((current) => ({ ...current, instructions: event.target.value })); setStatus('idle'); }} className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" /></label>
        {instrument.sections.map((section, sectionIndex) => <fieldset key={`${section.variableName}-${sectionIndex}`} className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><legend className="px-2 text-sm font-black">{section.title || `المحور ${sectionIndex + 1}`}</legend><div className="grid gap-3 sm:grid-cols-2"><input aria-label="عنوان المحور" value={section.title} onChange={(event) => updateSection(sectionIndex, { ...section, title: event.target.value })} className="rounded-xl border border-slate-300 bg-white p-3 text-sm" /><select aria-label="المتغير المقاس" value={section.variableName} onChange={(event) => updateSection(sectionIndex, { ...section, variableName: event.target.value })} className="rounded-xl border border-slate-300 bg-white p-3 text-sm">{variables.map((variable) => <option key={variable}>{variable}</option>)}</select></div>
          {section.items.map((item, itemIndex) => <div key={itemIndex} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_180px_auto]"><textarea aria-label={`البند ${itemIndex + 1}`} value={item.text} onChange={(event) => updateSection(sectionIndex, { ...section, items: section.items.map((entry, index) => index === itemIndex ? { ...entry, text: event.target.value } : entry) })} className="min-h-16 rounded-lg border border-slate-300 p-2 text-sm" /><select aria-label="نوع البند" value={item.kind} onChange={(event) => { const kind = event.target.value as QuestionnaireItemKind; updateSection(sectionIndex, { ...section, items: section.items.map((entry, index) => index === itemIndex ? { ...entry, kind, options: kind === 'likert5' ? LIKERT : entry.options } : entry) }); }} className="rounded-lg border border-slate-300 p-2 text-xs">{KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select><button type="button" aria-label="حذف البند" onClick={() => updateSection(sectionIndex, { ...section, items: section.items.filter((_, index) => index !== itemIndex) })} className="rounded-lg p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>{(item.kind === 'single_choice' || item.kind === 'multiple_choice') && <input aria-label="خيارات البند" value={item.options.join('، ')} onChange={(event) => updateSection(sectionIndex, { ...section, items: section.items.map((entry, index) => index === itemIndex ? { ...entry, options: event.target.value.split('،').map((option) => option.trim()) } : entry) })} className="rounded-lg border border-slate-300 p-2 text-xs md:col-span-2" placeholder="الخيار الأول، الخيار الثاني" />}</div>)}
          <button type="button" onClick={() => updateSection(sectionIndex, { ...section, items: [...section.items, { text: '', kind: 'likert5', required: true, options: LIKERT }] })} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700"><Plus className="h-4 w-4" />إضافة بند</button></fieldset>)}
        {issue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{issue}</p>}
        {status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{saveError}</p>}
        {googleFormFeedback?.kind === 'success' && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950"><p className="font-black">تم إنشاء الاستبانة داخل حساب Google الذي اخترته.</p><div className="mt-3 flex flex-wrap gap-3">{googleFormFeedback.editUrl && <a href={googleFormFeedback.editUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">فتح وتعديل النموذج <ExternalLink className="h-4 w-4" /></a>}{googleFormFeedback.responderUri && <a href={googleFormFeedback.responderUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 font-bold">فتح رابط المشاركين <ExternalLink className="h-4 w-4" /></a>}</div></div>}
        {googleFormFeedback?.kind === 'config' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">الربط المباشر مع Google Forms غير مفعّل بعد في إعدادات المنصة. يمكنك استخدام ملف الإنشاء الاحتياطي أدناه.</p>}
        {googleFormFeedback?.kind === 'not-ready' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">احفظ الاستبانة واجتز فحص الجودة قبل إنشاء نموذج Google.</p>}
        {googleFormFeedback?.kind === 'forbidden' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">المشروع غير موجود أو لا تملك صلاحية الوصول إليه.</p>}
        {googleFormFeedback?.kind === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">لم يكتمل إنشاء النموذج. لم يُحفظ أي رمز وصول؛ أعد المحاولة واختر حساب Google الصحيح.</p>}
        <button type="button" disabled={Boolean(issue) || status === 'saving'} onClick={() => void save()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ والفحص…' : 'اعتماد الاستبانة وفتح الأدبيات'}</button>
        {status === 'saved' && <div className="space-y-3"><div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-6 text-slate-700"><strong className="text-slate-950">الإنشاء المباشر:</strong> تختار حساب Google وتمنح إذن إنشاء نموذج واحد. النموذج يصبح ملك حسابك، ولا تحتفظ WAHA برمز Google بعد العملية.</div><div className="grid gap-3 sm:grid-cols-3"><a href={`/api/integrations/google-forms/connect?projectId=${encodeURIComponent(projectId)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 p-4 text-center text-sm font-bold text-white"><FilePlus2 className="h-4 w-4" />إنشاء Google Form في حسابي</a><button type="button" onClick={downloadGoogleScript} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800"><Download className="h-4 w-4" />تنزيل ملف احتياطي</button><Link href={`/research/literature?projectId=${encodeURIComponent(projectId)}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">انتقل إلى الأدبيات ←</Link></div></div>}
      </section></>}
  </main></div>;
}
