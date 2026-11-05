'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { CheckCheck, Copy, Languages } from 'lucide-react';
import { useState } from 'react';

export default function ResearchLanguageAssistant() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const [text, setText] = useState(''); const [output, setOutput] = useState('');
  const [operation, setOperation] = useState<'proofread' | 'translate'>('proofread'); const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState('');
  const run = async () => {
    setLoading(true); setMessage(''); setOutput('');
    try {
      const response = await fetch('/api/academic/language-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, text, targetLanguage: language }) });
      const data = await response.json() as { output?: string; error?: string; code?: string };
      if (!response.ok) throw new Error(data.code === 'SUBSCRIPTION_REQUIRED' ? 'الأداة مهيأة ضمن خطة الباحث، ويمكن تفعيلها عند تشغيل الاشتراكات.' : data.error || 'تعذر معالجة النص.');
      setOutput(data.output || '');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر معالجة النص.'); }
    finally { setLoading(false); }
  };
  return <section dir={uiDirection} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Languages className="h-5 w-5 text-blue-600" /><h2 className="font-black">{ui("مراجع اللغة الأكاديمية")}</h2></div><p className="mt-2 text-xs leading-6 text-slate-600">{ui("راجع مقطعاً كتبته أو ترجمه مع الحفاظ على المعنى والأرقام والاستشهادات. النتيجة اقتراح قابل للمقارنة، وليست استبدالاً تلقائياً لنصك.")}</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setOperation('proofread')} className={`rounded-xl px-3 py-2.5 text-xs font-bold ${operation === 'proofread' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}><CheckCheck className="me-1 inline h-4 w-4" />{ui("تدقيق")}</button><button type="button" onClick={() => setOperation('translate')} className={`rounded-xl px-3 py-2.5 text-xs font-bold ${operation === 'translate' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}><Languages className="me-1 inline h-4 w-4" />{ui("ترجمة")}</button></div><select aria-label={operation === 'translate' ? ui("الترجمة إلى") : ui("لغة النص")} value={language} onChange={(event) => setLanguage(event.target.value as 'ar' | 'en')} className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"><option value="ar">{ui("العربية")}</option><option value="en">{ui("الإنجليزية")}</option></select><textarea dir="auto" value={text} onChange={(event) => setText(event.target.value.slice(0, 12000))} rows={5} placeholder={ui("ضع هنا المقطع الذي تريد مراجعته…")} className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7 outline-none focus:border-blue-500" /><button type="button" onClick={() => void run()} disabled={loading || text.trim().length < 20} className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{loading ? ui("جارٍ المعالجة…") : operation === 'proofread' ? ui("راجع المقطع") : ui("ترجم المقطع")}</button>{message && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">{ui(message)}</p>}{output && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center justify-between"><strong className="text-xs text-emerald-800">{ui("النسخة المقترحة")}</strong><button type="button" onClick={() => void navigator.clipboard.writeText(output)} aria-label={ui("نسخ النسخة المقترحة")}><Copy className="h-4 w-4 text-blue-600" /></button></div><p dir={language === 'ar' ? 'rtl' : 'ltr'} className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-800">{output}</p></div>}</section>;
}
