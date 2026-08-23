'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AcademicBrainTestPage() {
  const [ideaText, setIdeaText] = useState('أريد أن أكتب بحثاً عن الذكاء الاصطناعي في المدارس.');
  const [discipline, setDiscipline] = useState('Education & Technology');
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const evaluateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaText.trim()) return;

    setLoading(true);
    setError('');
    setEvaluation(null);

    try {
      const res = await fetch('/api/academic/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText, discipline }),
      });

      const data = await res.json();
      if (data.success) {
        setEvaluation(data.brainEvaluation);
      } else {
        setError(data.error || 'فشل التقييم');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 md:p-10">

      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold rounded-full">
            Core Priority - WAHA Academic Brain v1
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مختبر العقل الأكاديمي (المشرف الصارم)</h1>
          <p className="text-slate-400 mt-1">اختبار قدرة WAHA على نقد الأفكار، كشف النقص، ورفض السطحية قبل المضي في البحث</p>
        </div>
      </div>

      <form onSubmit={evaluateIdea} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">فكرة الباحث الخام (جرب إدخال فكرة ضعيفة أو عامة لاختبار صرامة المشرف)</label>
          <textarea
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 focus:outline-none focus:border-red-500 h-32 resize-none font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">التخصص الأكاديمي</label>
          <input
            type="text"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-red-500"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !ideaText.trim()}
          className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-2xl shadow-lg shadow-red-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'المشرف الأكاديمي يدرس الفكرة وينقدها...' : 'تقييم الفكرة أكاديمياً 🧠'}
        </button>
      </form>

      {evaluation && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-xl font-bold text-white">قرار لجنة الإشراف الأكاديمي</h3>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                evaluation.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                evaluation.status === 'NEEDS_REFINEMENT' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                الحالة: {evaluation.status}
              </span>
              <span className="text-xs text-slate-400">مؤشر الوضوح: <strong className="text-white">{evaluation.clarityScore}%</strong></span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-red-400">التحليل والنقد الأكاديمي:</h4>
            <p className="text-xs text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed font-mono">
              {evaluation.critique}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-amber-400">العناصر الناقصة في الفكرة:</h4>
              <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {evaluation.missingElements?.map((elem: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-amber-400 font-bold">✕</span> {elem}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-cyan-400">أسئلة استكمال الفكرة المطلوبة:</h4>
              <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {evaluation.requiredQuestions?.map((q: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">?</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2 bg-slate-950 p-5 rounded-xl border border-slate-800">
            <strong className="text-xs font-bold text-emerald-400 block mb-1">توجيه المشرف المباشر:</strong>
            <p className="text-xs text-slate-200 leading-relaxed">{evaluation.supervisorFeedback}</p>
          </div>
        </div>
      )}

    </div>
  );
}
