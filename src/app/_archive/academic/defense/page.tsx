'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DefensePage() {
  const [researchDetails, setResearchDetails] = useState('مشروع بحثي بعنوان: أثر الذكاء الاصطناعي التوليدي في تحسين كفاءة البحث العلمي، اعتمد على المنهج التجريبي وعينة من 50 طالباً للدراسات العليا.');
  const [defenseData, setDefenseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateDefenseQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchDetails.trim()) return;

    setLoading(true);
    setError('');
    setDefenseData([]);

    try {
      const res = await fetch('/api/academic/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchDetails }),
      });

      const data = await res.json();
      if (data.success && data.defenseData?.defenseQuestions) {
        setDefenseData(data.defenseData.defenseQuestions);
      } else {
        setError(data.error || 'فشل توليد الأسئلة');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-10">

      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xs font-semibold rounded-full">
            Sprint 20 - Research Defense & Viva Voce Simulator
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">محاكي أسئلة المناقشة والدفاع (Viva Voce)</h1>
          <p className="text-slate-400 mt-1">توقع أقوى أسئلة لجنة المناقشة وتدرب على الإجابة النموذجية بثقة تامة</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateDefenseQuestions} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">ملخص أو تفاصيل مشروعك البحثي للمناقشة</label>
          <textarea
            value={researchDetails}
            onChange={(e) => setResearchDetails(e.target.value)}
            placeholder="اكتب ملخص البحث هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 h-32 resize-none"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !researchDetails.trim()}
          className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-2xl shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ توليد أسئلة لجنة المناقشة الافتراضية...' : 'محاكاة أسئلة المناقشة والدفاع 🎓'}
        </button>
      </form>

      {defenseData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <h3 className="text-xl font-bold text-pink-400 border-b border-slate-800 pb-4">أسئلة لجنة المناقشة والدفاع المقترحة</h3>

          <div className="space-y-6">
            {defenseData.map((item: any, idx: number) => (
              <div key={idx} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-3 py-1 bg-pink-500/10 text-pink-400 rounded-full border border-pink-500/20">
                    السؤال {idx + 1} ({item.category})
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white leading-relaxed">{item.question}</h4>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1">
                  <strong className="text-xs font-bold text-emerald-400 block">الإجابة النموذجية والتوجيه الدفاعي:</strong>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.suggestedDefense}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
