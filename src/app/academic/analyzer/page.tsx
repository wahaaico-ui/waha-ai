'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AcademicAnalyzerTestPage() {
  const [text, setText] = useState('أثر الذكاء الاصطناعي على التحصيل الأكاديمي لطلبة الجامعات');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/academic/analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.analysis);
      } else {
        setError(data.error || 'فشل التحليل');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 2
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Academic Input Analyzer</h1>
            <p className="text-slate-400 mt-1">محلل المدخلات الأكاديمية (استخراج الهيكل البنيوي للفكرة بدون استدعاء خارجي)</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={analyzeInput} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">النص / الفكرة البحثية المراد تحليلها</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب فكرة بحثك هنا..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 h-32 resize-none"
            />
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ تحليل هيكل المدخل...' : 'تشغيل Academic Input Analyzer 🧠'}
          </button>
        </form>

        {result && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xl font-bold text-emerald-400">نتيجة التحليل المنظمة (Structured JSON)</h3>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors border border-slate-700"
              >
                نسخ JSON 📋
              </button>
            </div>
            <pre className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-sm text-blue-300 font-mono overflow-x-auto leading-relaxed" dir="ltr">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
