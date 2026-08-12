'use client';

import { useState } from 'react';

export default function EvidenceTestPage() {
  const [query, setQuery] = useState('Generative AI in Higher Education');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/academic/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.evidenceLayer);
      } else {
        setError(data.error || 'فشل جلب الأدلة');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 md:p-10">
      <div className="border-b border-slate-800 pb-6">
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full">
          Task 2 - Evidence Layer & Real Papers Integration
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مختبر طبقة الأدلة الحقيقية</h1>
        <p className="text-slate-400 mt-1">جلب الأبحاث الحقيقية من OpenAlex و Semantic Scholar وتحليل جودتها وثقتها عبر العقل الأكاديمي</p>
      </div>

      <form onSubmit={fetchEvidence} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">استعلام البحث أو الموضوع الأكاديمي</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جاري استدعاء الأبحاث وتحليل الأدلة...' : 'بحث وتحليل الأدلة العلمية 📚'}
        </button>
      </form>

      {result && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-xl font-bold text-emerald-400">تحليل طبقة الأدلة</h3>
            <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-full">
              درجة ثقة الأدلة: {result.confidenceScore}%
            </span>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">ملخص جودة الأدلة:</h4>
            <p className="text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed font-mono">
              {result.evidenceQualitySummary}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-amber-400">الفجوات البحثية المكتشفة:</h4>
            <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
              {result.identifiedGaps?.map((gap: string, idx: number) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span> {gap}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-cyan-400">الأبحاث المُحللة:</h4>
            <div className="space-y-3">
              {result.synthesizedPapers?.map((paper: any, idx: number) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-white text-sm">{paper.title}</h5>
                    <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded text-[10px]">{paper.relevanceScore}</span>
                  </div>
                  <p className="text-slate-400">المؤلفون: {paper.authors} ({paper.year})</p>
                  <p className="text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800/80">
                    <strong>الخلاصة المستفادة:</strong> {paper.keyTakeaway}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
