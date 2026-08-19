'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ResearchIntelligenceTestPage() {
  const [topic, setTopic] = useState('Artificial Intelligence in Education');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runIntelligence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // 1. أولاً نجلب الأدبيات (Task 4)
      const resEvidence = await fetch('/api/academic/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: topic, discipline: 'Education' }),
      });
      const dataEvidence = await resEvidence.json();

      if (!dataEvidence.success || !dataEvidence.papers.length) {
        throw new Error('فشل جلب أدبيات كافية للتحليل');
      }

      // 2. ثانياً نشغل محرك ذكاء الأبحاث (Task 5)
      const resIntelligence = await fetch('/api/academic/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: dataEvidence.papers, topic }),
      });
      const dataIntelligence = await resIntelligence.json();

      if (!dataIntelligence.success) {
        throw new Error(dataIntelligence.error || 'فشل تحليل ذكاء الأبحاث');
      }

      setResult(dataIntelligence.intelligence);

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
            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 5
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Research Intelligence</h1>
            <p className="text-slate-400 mt-1">محرك ذكاء وتحليل الأبحاث (الاتجاهات، التكرار، والفجوات الاستراتيجية)</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={runIntelligence} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">الموضوع البحثي للتحليل الذكي</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="اكتب الموضوع هنا..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-2xl shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ جمع الأدبيات وتوليد التحليل الذكي...' : 'تشغيل Research Intelligence 📊'}
          </button>
        </form>

        {result && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs text-slate-400">الاتجاه العام:</span>
                <span className="ml-2 px-3 py-1 bg-cyan-500/10 text-cyan-400 font-bold text-xs rounded-full border border-cyan-500/20">
                  {result.trend}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400">حالة التكرار:</span>
                <span className={`ml-2 px-3 py-1 font-bold text-xs rounded-full border ${result.isRepetitive ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {result.isRepetitive ? 'موضوع مكرر ومكتظ' : 'موضوع حديث / ابتكاري'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-cyan-400">الملخص التحليلي:</h4>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {result.analysisSummary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-200">الفجوات البحثية المكتشفة:</h4>
                <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {result.researchGaps?.map((gap: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span> {gap}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-200">المجتمعات غير المدروسة:</h4>
                <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {result.unstudiedPopulations?.map((pop: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span> {pop}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-sm font-bold text-emerald-400">التوصيات الاستراتيجية:</h4>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {result.strategicRecommendations}
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
