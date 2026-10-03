'use client';

import Link from 'next/link';
import { useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import ReferenceCheckReportView from '@/components/reference-check/ReferenceCheckReportView';
import { extractReferenceSection, MAX_INPUT_CHARS, MAX_REFERENCES, type ReferenceCheckReport } from '@/lib/reference-check';

type Status = 'idle' | 'reading' | 'checking';

export default function ReferenceCheckPage() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notice, setNotice] = useState('');
  const [report, setReport] = useState<ReferenceCheckReport | null>(null);

  const readPdf = async (file: File) => {
    setStatus('reading'); setError(''); setNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/academic/parse-pdf', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({})) as { text?: string; error?: string };
      if (response.status === 401) { setNeedsLogin(true); return; }
      if (!response.ok || !data.text) throw new Error('تعذرت قراءة الملف. الحد 10 ميغابايت و50 صفحة؛ للرسائل الأطول الصق قسم المراجع مباشرة.');
      const { section, detected } = extractReferenceSection(data.text);
      setText(section.trim().slice(0, MAX_INPUT_CHARS));
      setNotice(detected ? 'استخرجنا قسم المراجع من الملف. راجعه قبل الفحص واحذف ما ليس مرجعاً.' : 'لم نجد عنوان قسم للمراجع في الملف، فوضعنا النص كله. احذف ما قبل قائمة المراجع قبل الفحص.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذرت قراءة الملف.'); }
    finally { setStatus('idle'); }
  };

  const check = async () => {
    setStatus('checking'); setError(''); setReport(null);
    try {
      const response = await fetch('/api/research/reference-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await response.json().catch(() => ({})) as { report?: ReferenceCheckReport; error?: string };
      if (response.status === 401) { setNeedsLogin(true); return; }
      if (!response.ok || !data.report) throw new Error(data.error || 'تعذر إكمال الفحص. أعد المحاولة.');
      setReport(data.report);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر إكمال الفحص.'); }
    finally { setStatus('idle'); }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><div className="print:hidden"><SiteHeader /></div>
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-black sm:text-3xl">فحص المراجع قبل التسليم</h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600">الصق قائمة مراجع خطتك أو رسالتك، أو ارفع الملف. نبحث عن كل مرجع في فهرسَي Crossref وOpenAlex ونبيّن: ما وُجد وبياناته متطابقة، وما وُجد مع اختلاف في السنة أو المؤلف أو العنوان، وما يشير معرّفه (DOI) إلى عمل آخر، وما لم نعثر عليه. لا نحفظ النص الذي تفحصه.</p>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <label className="block text-sm font-bold text-slate-800" htmlFor="references">قائمة المراجع</label>
        <textarea id="references" value={text} onChange={(event) => setText(event.target.value)} rows={12} maxLength={MAX_INPUT_CHARS} dir="auto" className="w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" placeholder={'مثال:\nSmith, J., & Lee, K. (2021). Artificial intelligence in higher education governance. Journal of Higher Education Policy, 43(2), 101–118. https://doi.org/10.xxxx/xxxxx\nالعتيبي، محمد. (2020). واقع التحول الرقمي في الجامعات السعودية. مجلة العلوم التربوية، 12(3)، 45–70.'} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void check()} disabled={status !== 'idle' || text.trim().length < 20} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{status === 'checking' ? 'جارٍ الفحص… قد يستغرق دقيقة' : 'افحص المراجع'}</button>
          <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">{status === 'reading' ? 'جارٍ قراءة الملف…' : 'أو ارفع ملف PDF'}<input type="file" accept="application/pdf" className="sr-only" disabled={status !== 'idle'} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readPdf(file); }} /></label>
          <span className="text-xs text-slate-500">حتى {MAX_REFERENCES} مرجعاً في كل فحص.</span>
        </div>
        {notice && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-900">{notice}</p>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs leading-6 text-rose-800">{error}</p>}
        {needsLogin && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">الفحص متاح للمستخدمين المسجلين. <Link href="/login?redirect=/research/reference-check" className="font-bold underline">سجّل الدخول</Link> ثم أعد المحاولة.</p>}
      </section>

      {report && <>
        <ReferenceCheckReportView report={report} />
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 print:hidden">طباعة التقرير أو حفظه PDF</button>
      </>}
    </main>
  </div>;
}
