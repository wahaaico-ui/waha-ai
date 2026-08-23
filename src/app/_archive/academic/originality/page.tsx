'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OriginalityPage() {
  const [textToCheck, setTextToCheck] = useState('أظهرت الدراسة أن استخدام الذكاء الاصطناعي في التعليم الجامعي يساعد الطلاب كثيراً في فهم المواد الدراسية وتحسين الإنتاجية الأكاديمية بنسبة ملحوظة.');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkOriginality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textToCheck.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/academic/originality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textToCheck }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.analysis);
      } else {
        setError(data.error || 'فشل التحليل');
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
          <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
            Sprint 18 - Academic Originality & Risk Analyzer
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">محرك تحليل الأصالة ومخاطر التطابق</h1>
          <p className="text-slate-400 mt-1">تقييم نسبة الأصالة العلمية وتقديم توصيات لرفع جودة النص الأكاديمي</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={checkOriginality} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">النص الأكاديمي المراد فحصه وتقييم أصالته</label>
          <textarea
            value={textToCheck}
            onChange={(e) => setTextToCheck(e.target.value)}
            placeholder="ألصق النص هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 h-36 resize-none font-mono"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !textToCheck.trim()}
          className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ فحص وتحليل الأصالة العلمية...' : 'فحص الأصالة ومخاطر التطابق 🔍'}
        </button>
      </form>

      {result && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-xl font-bold text-amber-400">نتيجة تقييم الأصالة والمخاطر</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">مستوى الخطورة: <strong className="text-amber-300">{result.riskLevel}</strong></span>
              <span className="px-4 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-sm rounded-full">
                نسبة الأصالة: {result.originalityScore}%
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-200">العبارات التي قد تحتاج إلى تعديل أو توثيق أدق:</h4>
            <ul className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
              {result.riskPhrases?.map((phrase: string, idx: number) => (
                <li key={idx} className="text-xs text-amber-300 flex items-start gap-2">
                  <span className="font-bold">•</span> {phrase}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-200">التوصيات العلمية لتعزيز الأصالة:</h4>
            <ul className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
              {result.recommendations?.map((rec: string, idx: number) => (
                <li key={idx} className="text-xs text-emerald-400 flex items-start gap-2">
                  <span className="font-bold">✓</span> {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}
