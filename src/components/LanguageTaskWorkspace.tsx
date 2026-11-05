'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCheck, Copy, Languages } from 'lucide-react';
import TaskExportButtons from '@/components/TaskExportButtons';
import { useProjectId } from '@/lib/use-project-id';
import SiteHeader from '@/components/SiteHeader';
import { auditAcademicText } from '@/lib/academic-text-audit';

type Operation = 'translate' | 'proofread';
type Language = 'ar' | 'en';

export default function LanguageTaskWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

  const projectId = useProjectId();
  const [documentId, setDocumentId] = useState('');
  const [resultInput, setResultInput] = useState('');
  const [resultLanguage, setResultLanguage] = useState<Language>('ar');
  const [history, setHistory] = useState<Array<{ documentId: string; text: string; output: string; operation: Operation; targetLanguage: Language; status: string }>>([]);
  const [operation, setOperation] = useState<Operation>('translate');
  const [language, setLanguage] = useState<Language>('en');
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyRevision, setHistoryRevision] = useState(0);
  const auditIssues = useMemo(() => auditAcademicText(output || text, output ? resultLanguage : language), [output, text, resultLanguage, language]);

  useEffect(() => {
    let active = true;
    if (!projectId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    fetch('/api/academic/language-tools?projectId=' + encodeURIComponent(projectId), { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'تعذر الاسترجاع.');
      if (active) { setHistory(data.tasks || []); const requested = new URLSearchParams(window.location.search).get('documentId'); const task = data.tasks?.find((item: { documentId: string }) => item.documentId === requested) || data.tasks?.[0]; if (task) { setText(task.text); setLanguage(task.targetLanguage); setResultLanguage(task.targetLanguage); setOperation(task.operation); setOutput(task.output); setResultInput(task.text); setDocumentId(task.status === 'completed' ? task.documentId : ''); } }
      if (active) setHistoryError('');
    }).catch(() => { if (active) setHistoryError('تعذر استرجاع المهام المحفوظة. أعد المحاولة؛ لم تُحذف بياناتك.'); }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [projectId, historyRevision]);

  async function runTool(saveOnly = false) {
    setStatus('loading');
    setMessage('');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch('/api/academic/language-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, text, targetLanguage: language, ...(saveOnly ? { saveOnly: true } : {}), ...(projectId ? { projectId } : {}) }),
        signal: controller.signal,
      });
      const data = await response.json() as { output?: string; error?: string; code?: string; documentId?: string };
      if (!response.ok) {
        if (data.code === 'SUBSCRIPTION_REQUIRED') setMessage("هذه الأداة ضمن خطة الباحث. اشترك مرة واحدة لفتحها في حسابك طوال مدة الاشتراك.");
        else setMessage(data.error || 'تعذر تنفيذ العملية.');
        setStatus('error');
        return;
      }
      if (saveOnly && !data.output) {
        if (data.documentId) setHistory((items) => [{ documentId: data.documentId!, text, output: '', operation, targetLanguage: language, status: 'pending' }, ...items.filter((item) => item.documentId !== data.documentId)]);
        setMessage("حُفظ المدخل؛ لم تُشغّل خدمة الترجمة أو التدقيق."); setStatus('idle'); return;
      }
      setOutput(data.output || ''); setResultInput(text); setResultLanguage(language); setDocumentId(data.documentId || '');
      if (data.documentId) setHistory((items) => [{ documentId: data.documentId!, text, output: data.output || '', operation, targetLanguage: language, status: 'completed' }, ...items.filter((item) => item.documentId !== data.documentId)]);
      setStatus('idle');
    } catch {
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
      setStatus('error');
    } finally { window.clearTimeout(timeout); }
  }

  const Content = embedded ? 'section' : 'main';
  return <div dir={uiDirection} className={embedded ? "text-slate-950" : "min-h-screen bg-slate-50 pb-20 text-slate-950"}>{!embedded && <SiteHeader />}<Content className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white sm:p-10"><div className="flex items-center gap-3"><Languages className="h-7 w-7" /><h1 className="text-2xl font-black sm:text-3xl">{ui("أدوات النص الأكاديمي")}</h1></div><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">{ui("ترجمة الملخص بين العربية والإنجليزية، أو تدقيقه لغويًا مع الحفاظ على المعنى والمراجع والأرقام.")}</p></section>

    {message && status !== 'error' && <p role="status" className="mt-4 text-sm">{ui(message)}</p>}
    {historyError && <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{ui(historyError)}<button type="button" onClick={() => setHistoryRevision((value) => value + 1)} className="ms-3 font-bold underline">{ui("إعادة استرجاع المهام")}</button></div>}
    {history.length > 0 && <label className="mt-4 block text-sm">{ui("استرجاع مهمة محفوظة")}<select aria-label={ui("المهام اللغوية المحفوظة")} className="mt-2 w-full rounded-xl border p-3" value={documentId} onChange={(event) => { const task = history.find((item) => item.documentId === event.target.value); if (task) { setText(task.text); setOperation(task.operation); setLanguage(task.targetLanguage); setResultLanguage(task.targetLanguage); setOutput(task.output); setResultInput(task.text); setDocumentId(task.status === 'completed' ? task.documentId : ''); } }}><option value="">{ui("اختر مهمة")}</option>{history.map((task) => <option key={task.documentId} value={task.documentId}>{task.operation === 'translate' ? ui("ترجمة") : ui("تدقيق")} — {task.text.slice(0, 60)} {task.status === 'pending' ? ui("(مدخل محفوظ؛ أعد المحاولة)") : ''}</option>)}</select></label>}
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setOperation('translate')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${operation === 'translate' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}><ArrowLeftRight className="h-4 w-4" /> {ui("ترجمة")}</button><button type="button" onClick={() => setOperation('proofread')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${operation === 'proofread' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}><CheckCheck className="h-4 w-4" /> {ui("تدقيق لغوي")}</button></div>
        <label className="mt-5 block text-sm font-black" htmlFor="language">{operation === 'translate' ? ui("الترجمة إلى") : ui("لغة النص")}</label><select id="language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="ar">{ui("العربية")}</option><option value="en">{ui("الإنجليزية")}</option></select>
        <label className="mt-5 block text-sm font-black" htmlFor="academic-text">{ui("النص أو الملخص")}</label><textarea dir="auto" id="academic-text" value={text} onChange={(event) => setText(event.target.value.slice(0, 12000))} placeholder={ui("الصق الملخص هنا…")} className="mt-2 min-h-72 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><div className="mt-1 text-left text-xs text-slate-400">{text.length.toLocaleString(uiLanguage)} {ui("/ ١٢٬٠٠٠")}</div>
        <button type="button" disabled={!projectId || text.trim().length < 20 || status === 'loading'} onClick={() => void runTool()} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'loading' ? ui("جارٍ المعالجة…") : operation === 'translate' ? ui("ترجمة الملخص") : ui("تدقيق النص")}</button>
        <button type="button" disabled={!projectId || text.trim().length < 20 || status === 'loading'} onClick={() => void runTool(true)} className="mt-2 w-full rounded-xl border border-slate-300 py-3 text-sm font-bold disabled:opacity-40">{ui("حفظ المدخل دون تشغيل الأداة")}</button>
        {!projectId && <p className="mt-4 text-sm">{ui("افتح مشروعًا من")}<Link href="/" className="underline">{ui("مدخل المهام")}</Link> {ui("لحفظ المدخل والنتيجة.")}</p>}{status === 'error' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{ui(message)}{' '}{message.includes(ui("خطة الباحث")) && <Link href="/pricing" className="mr-2 font-black text-blue-700 underline">{ui("عرض الاشتراك")}</Link>}</div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">{ui("آخر نتيجة محفوظة")}</h2>{output && <button type="button" onClick={() => void navigator.clipboard.writeText(output)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"><Copy className="h-4 w-4" /> {ui("نسخ")}</button>}</div>{documentId && projectId && <TaskExportButtons projectId={projectId} task="language" documentId={documentId} />}{output && <details className="mt-3 text-sm"><summary>{ui("المدخل الذي بُنيت عليه هذه النتيجة")}</summary><p className="whitespace-pre-wrap break-words">{resultInput}</p></details>}{output ? <div dir={resultLanguage === 'ar' ? 'rtl' : 'ltr'} className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-8 text-emerald-950">{output}</div> : <div className="mt-4 flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm leading-7 text-slate-500">{ui("ستظهر النتيجة هنا. راجع المصطلحات المتخصصة قبل اعتماد النص النهائي.")}</div>}
        {(output || text) && <section aria-label={ui('فحص قواعد النص')} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7"><h3 className="font-bold">{ui('فحص قواعد النص')}</h3><p className="text-slate-600">{ui('تنبيهات قابلة للمراجعة، وليست حكمًا نحويًا نهائيًا أو تصحيحًا تلقائيًا.')}</p>{auditIssues.length ? <ul className="mt-3 list-inside list-disc space-y-2">{auditIssues.map((issue, index) => <li key={`${issue.code}-${index}`}><span>{ui(issue.message)}</span> <span dir="auto" className="break-words text-slate-600">«{issue.excerpt}»</span></li>)}</ul> : <p className="mt-3">{ui('لم تظهر مخالفات ضمن القواعد البرمجية المحدودة.')}</p>}</section>}
      </div>
    </section>
  </Content></div>;
}
