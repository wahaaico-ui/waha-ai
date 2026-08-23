'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ResearchGapsPage() {
  const [domain, setDomain] = useState('');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateGapsReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setLoading(true);
    setError('');
    setReport('');

    try {
      const res = await fetch('/api/academic/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      const data = await res.json();
      if (data.success) {
        setReport(data.report);
      } else {
        setError(data.error || 'فشل توليد تقرير الفجوات');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ترويسة الصفحة */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">محلل الفجوات البحثية (Research Gaps)</h1>
            <p className="text-slate-400 mt-1">اكتشف الثغرات المعرفية والفرص البحثية المتاحة في تخصصك بدعم من الذكاء الاصطناعي.</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للبحث
          </Link>
        </div>

        {/* نموذج الإدخال */}
        <form onSubmit={generateGapsReport} className="flex gap-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="أدخل التخصص أو المجال البحثي (مثال: الذكاء الاصطناعي في التعليم الطبي)..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            {loading ? 'جارٍ التحليل...' : 'كشف الفجوات'}
          </button>
        </form>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">{error}</div>}

        {/* عرض التقرير */}
        {report && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-blue-400 border-b border-slate-800 pb-3">تقرير الفجوات البحثية المعرفية</h3>
            <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
              {report}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
