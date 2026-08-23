'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeftRight, CheckCheck, Copy, Languages } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

type Operation = 'translate' | 'proofread';
type Language = 'ar' | 'en';

export default function LanguageToolsPage() {
  const [operation, setOperation] = useState<Operation>('translate');
  const [language, setLanguage] = useState<Language>('en');
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function runTool() {
    setStatus('loading');
    setMessage('');
    setOutput('');
    try {
      const response = await fetch('/api/academic/language-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, text, targetLanguage: language }),
      });
      const data = await response.json() as { output?: string; error?: string; code?: string };
      if (!response.ok) {
        if (data.code === 'SUBSCRIPTION_REQUIRED') setMessage('هذه الأداة ضمن خطة الباحث. اشترك مرة واحدة لفتحها في حسابك طوال مدة الاشتراك.');
        else setMessage(data.error || 'تعذر تنفيذ العملية.');
        setStatus('error');
        return;
      }
      setOutput(data.output || '');
      setStatus('idle');
    } catch {
      setMessage('تعذر الاتصال بالخادم. حاول مرة أخرى.');
      setStatus('error');
    }
  }

  return <div dir="rtl" className="min-h-screen bg-slate-50 pb-20 text-slate-950"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white sm:p-10"><div className="flex items-center gap-3"><Languages className="h-7 w-7" /><h1 className="text-2xl font-black sm:text-3xl">أدوات النص الأكاديمي</h1></div><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">ترجمة الملخص بين العربية والإنجليزية، أو تدقيقه لغويًا مع الحفاظ على المعنى والمراجع والأرقام.</p></section>

    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setOperation('translate')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${operation === 'translate' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}><ArrowLeftRight className="h-4 w-4" /> ترجمة</button><button type="button" onClick={() => setOperation('proofread')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${operation === 'proofread' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}><CheckCheck className="h-4 w-4" /> تدقيق لغوي</button></div>
        <label className="mt-5 block text-sm font-black" htmlFor="language">{operation === 'translate' ? 'الترجمة إلى' : 'لغة النص'}</label><select id="language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="ar">العربية</option><option value="en">الإنجليزية</option></select>
        <label className="mt-5 block text-sm font-black" htmlFor="academic-text">النص أو الملخص</label><textarea id="academic-text" value={text} onChange={(event) => setText(event.target.value.slice(0, 12000))} placeholder="الصق الملخص هنا…" className="mt-2 min-h-72 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><div className="mt-1 text-left text-xs text-slate-400">{text.length.toLocaleString('ar')} / ١٢٬٠٠٠</div>
        <button type="button" disabled={text.trim().length < 20 || status === 'loading'} onClick={() => void runTool()} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'loading' ? 'جارٍ المعالجة…' : operation === 'translate' ? 'ترجمة الملخص' : 'تدقيق النص'}</button>
        {status === 'error' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{message}{message.includes('خطة الباحث') && <Link href="/pricing" className="mr-2 font-black text-blue-700 underline">عرض الاشتراك</Link>}</div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">النتيجة</h2>{output && <button type="button" onClick={() => void navigator.clipboard.writeText(output)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"><Copy className="h-4 w-4" /> نسخ</button>}</div>{output ? <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-8 text-emerald-950">{output}</div> : <div className="mt-4 flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm leading-7 text-slate-500">ستظهر النتيجة هنا. راجع المصطلحات المتخصصة قبل اعتماد النص النهائي.</div>}</div>
    </section>
  </main></div>;
}
