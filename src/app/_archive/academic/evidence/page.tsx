'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function EvidenceCollectorTestPage() {
  const [query, setQuery] = useState('Artificial Intelligence in Education');
  const [discipline, setDiscipline] = useState('Education');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const collectEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/academic/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, discipline }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'فشل جمع الأدبيات');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 4
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Evidence Collector</h1>
            <p className="text-slate-400 mt-1">جامع الأدبيات متعدد المصادر (OpenAlex & Semantic Scholar)</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={collectEvidence} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-bold text-slate-200">كلمات البحث المفتاحية / الاستعلام</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="أدخل الكلمات المفتاحية..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">التخصص الأكاديمي</label>
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="التخصص..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ جمع الأدبيات من قواعد البيانات العالمية...' : 'بدء جمع الأدبيات (Evidence Collector) 📚'}
          </button>
        </form>

        {result && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">إحصائيات الجمع</h3>
                <p className="text-xs text-slate-400 mt-1">المصادر المستخدمة: {result.sourcesUsed.join(', ')}</p>
              </div>
              <span className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-sm font-bold rounded-xl">
                إجمالي الأبحاث: {result.count}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {result.papers.map((paper: any, idx: number) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 shadow-xl">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-base font-bold text-blue-400 leading-snug">{paper.title}</h4>
                    <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-full shrink-0">
                      {paper.year || 'د.ت'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">المؤلفون: {paper.authors}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
                    <span className="text-indigo-400 font-medium">المصدر: {paper.source}</span>
                    <span>الاستشهادات: {paper.citedByCount}</span>
                    {paper.doi && <span className="text-slate-300">DOI: {paper.doi}</span>}
                    {paper.isOpenAccess && <span className="text-emerald-400 font-semibold">🔓 Open Access</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
