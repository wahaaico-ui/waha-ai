'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DecisionEngineTestPage() {
  const [topic, setTopic] = useState('أثر الذكاء الاصطناعي على التحصيل الأكاديمي لطلبة الجامعات في فلسطين');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runDecisionPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // 1. Analyzer
      const resAna = await fetch('/api/academic/analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: topic }),
      });
      const dataAna = await resAna.json();
      if (!dataAna.success) throw new Error('فشل التحليل');

      // 2. Readiness
      const resRead = await fetch('/api/academic/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: dataAna.analysis }),
      });
      const dataRead = await resRead.json();
      if (!dataRead.success) throw new Error('فشل فحص الجاهزية');

      // 3. Evidence
      const resEv = await fetch('/api/academic/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: topic, discipline: dataAna.analysis.discipline }),
      });
      const dataEv = await resEv.json();

      // 4. Intelligence
      const resIntel = await fetch('/api/academic/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: dataEv.papers || [], topic }),
      });
      const dataIntel = await resIntel.json();

      // 5. Decision Engine (Task 6)
      const resDec = await fetch('/api/academic/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: dataAna.analysis,
          readiness: dataRead.readiness,
          intelligence: dataIntel.intelligence || {}
        }),
      });
      const dataDec = await resDec.json();
      if (!dataDec.success) throw new Error(dataDec.error || 'فشل توليد القرار');

      setResult(dataDec.decisionResult);

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
            <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 6
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Decision Engine</h1>
            <p className="text-slate-400 mt-1">محرك القرار الأكاديمي الحاسم (ابدأ، عدل، وسع، ضيق، غيّر، أو لا تبدأ)</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={runDecisionPipeline} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">فكرة البحث أو العنوان للتقييم النهائي</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="أدخل فكرة البحث..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 h-28 resize-none"
            />
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ تنفيذ السلسلة وتحليل القرار الاستراتيجي...' : 'تشغيل Decision Engine 🎯'}
          </button>
        </form>

        {result && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs text-slate-400">القرار الاستراتيجي النهائي:</span>
                <h3 className="text-2xl font-extrabold text-purple-400 mt-1">
                  {result.decisionArabic} <span className="text-sm text-slate-400 font-normal">({result.decision})</span>
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-200">التبرير الأكاديمي:</h4>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {result.rationale}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-purple-400">الخطوات العملية المقترحة:</h4>
              <ul className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {result.actionableSteps?.map((step: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-purple-400 font-bold">✓</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
