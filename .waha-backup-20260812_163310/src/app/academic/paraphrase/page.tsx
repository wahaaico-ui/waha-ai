'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ParaphrasePage() {
  const [textToRewrite, setTextToRewrite] = useState('أظهرت الدراسة أن استخدام الذكاء الاصطناعي في الجامعات يساعد الطلاب كثيراً في فهم المواد الدراسية، ولذلك يجب على الجامعات أن تعتمد هذه التقنيات بشكل أكبر لتحسين النتائج التعليمية.');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const handleParaphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textToRewrite.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/academic/paraphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textToRewrite }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.paraphrasedResult);
      } else {
        setError(data.error || 'فشل التوليد');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-10">
      
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-semibold rounded-full">
            Sprint 16 - Academic Paraphrase & Tone Enhancer
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">محرك إعادة الصياغة وتحسين الرصانة</h1>
          <p className="text-slate-400 mt-1">إعادة صياغة النصوص البحثية بثلاثة مستويات أكاديمية متقدمة ودقيقة</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={handleParaphrase} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">النص أو الفقرة المراد إعادة صياغتها وتحسينها</label>
          <textarea
            value={textToRewrite}
            onChange={(e) => setTextToRewrite(e.target.value)}
            placeholder="اكتب النص هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 h-36 resize-none font-mono"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !textToRewrite.trim()}
          className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-2xl shadow-lg shadow-teal-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ إعادة الصياغة ورفع الرصانة الأكاديمية...' : 'إعادة الصياغة الأكاديمية الاحترافية ✒️'}
        </button>
      </form>

      {result && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-teal-400 border-b border-slate-800 pb-3">خيارات إعادة الصياغة المعتمدة</h3>

          <div className="grid grid-cols-1 gap-6">
            
            {/* الرصانة الصارمة */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 bg-teal-500/10 text-teal-400 rounded-full border border-teal-500/20">
                  1. الرصانة الأكاديمية الصارمة (Strict Academic)
                </span>
                <button
                  onClick={() => copyToClipboard(result.strictAcademic, 'strict')}
                  className="text-xs text-teal-400 hover:underline"
                >
                  {copied === 'strict' ? 'تم النسخ ✓' : 'نسخ النص'}
                </button>
              </div>
              <p className="text-xs text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed font-mono">
                {result.strictAcademic}
              </p>
            </div>

            {/* الاختصار والوضوح */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                  2. الاختصار والوضوح (Concise & Clear)
                </span>
                <button
                  onClick={() => copyToClipboard(result.conciseClear, 'concise')}
                  className="text-xs text-blue-400 hover:underline"
                >
                  {copied === 'concise' ? 'تم النسخ ✓' : 'نسخ النص'}
                </button>
              </div>
              <p className="text-xs text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed font-mono">
                {result.conciseClear}
              </p>
            </div>

            {/* النبرة النقدية */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
                  3. النبرة النقدية والتحليلية (Critical & Analytical)
                </span>
                <button
                  onClick={() => copyToClipboard(result.criticalAnalytical, 'critical')}
                  className="text-xs text-purple-400 hover:underline"
                >
                  {copied === 'critical' ? 'تم النسخ ✓' : 'نسخ النص'}
                </button>
              </div>
              <p className="text-xs text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed font-mono">
                {result.criticalAnalytical}
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
