'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ReadinessCheckerTestPage() {
  const [text, setText] = useState('أثر الذكاء الاصطناعي'); // فكرة ناقصة لاختبار المدقق
  const [analysis, setAnalysis] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError('');
    setAnalysis(null);
    setReadiness(null);

    try {
      // 1. تحليل المدخل (Task 2)
      const resAnalysis = await fetch('/api/academic/analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const dataAnalysis = await resAnalysis.json();

      if (!dataAnalysis.success) {
        throw new Error(dataAnalysis.error || 'فشل التحليل');
      }
      setAnalysis(dataAnalysis.analysis);

      // 2. فحص الجاهزية (Task 3)
      const resReadiness = await fetch('/api/academic/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: dataAnalysis.analysis }),
      });
      const dataReadiness = await resReadiness.json();

      if (!dataReadiness.success) {
        throw new Error(dataReadiness.error || 'فشل فحص الجاهزية');
      }
      setReadiness(dataReadiness.readiness);

    } catch (err: any) {
      setError(err.message || 'حدث خطأ في النظام');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 3
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Readiness Checker</h1>
            <p className="text-slate-400 mt-1">مدقق الجاهزية (تقييم الفكرة ومنع الانتقال للبحث إن كانت ناقصة)</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={runPipeline} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">أدخل نصاً أو فكرة بحثية (جرب نصاً ناقصاً مثل: "أثر الذكاء الاصطناعي")</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب فكرة البحث هنا..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 h-28 resize-none"
            />
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ تحليل وفحص الجاهزية...' : 'فحص الجاهزية وتحليل المدخل 🔍'}
          </button>
        </form>

        {/* عرض نتيجة الفحص */}
        {readiness && (
          <div className={`border p-8 rounded-2xl shadow-2xl space-y-6 ${readiness.isReady ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-red-950/20 border-red-500/30'}`}>

            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${readiness.isReady ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  {readiness.isReady ? '🟢 الفكرة جاهزة للانتقال' : '🔴 الفكرة غير جاهزة'}
                </span>
                <h3 className="text-xl font-bold text-white mt-2">مؤشر الجاهزية: {readiness.readinessScore}%</h3>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-300">قرار مدقق الجاهزية:</h4>
              <p className={`p-4 rounded-xl text-sm font-medium ${readiness.isReady ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                {readiness.feedback}
              </p>
            </div>

            {readiness.missingCritical && readiness.missingCritical.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-300">العناصر الناقصة الحرجة:</h4>
                <ul className="space-y-1">
                  {readiness.missingCritical.map((item: string, idx: number) => (
                    <li key={idx} className="text-xs text-red-400 flex items-center gap-2">
                      <span>❌</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis && (
              <div className="pt-4 border-t border-slate-800/80">
                <h4 className="text-sm font-bold text-slate-400 mb-2">هيكل التحليل المستخرج (Task 2):</h4>
                <pre className="bg-slate-950 p-4 rounded-xl text-xs text-blue-300 font-mono overflow-x-auto" dir="ltr">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
