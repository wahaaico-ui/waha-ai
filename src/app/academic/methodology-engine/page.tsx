'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MethodologyEnginePage() {
  const [title, setTitle] = useState('أثر الذكاء الاصطناعي التوليدي على كفاءة البحث العلمي لطلبة الدراسات العليا');
  const [discipline, setDiscipline] = useState('Education & Computer Science');
  const [variables, setVariables] = useState('المستقل: استخدام الذكاء الاصطناعي | التابع: كفاءة البحث العلمي');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateMethodology = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/academic/methodology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, discipline, variables }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.methodology);
      } else {
        setError(data.error || 'فشل التوليد');
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
            Sprint 9 - Research Methodology Engine
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">موصي المنهجية ومجتمع الدراسة</h1>
          <p className="text-slate-400 mt-1">تحديد المنهج العلمي، العينة، أدوات القياس، والأساليب الإحصائية المناسبة بدقة</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateMethodology} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">العنوان أو الفكرة البحثية</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">التخصص الأكاديمي</label>
            <input
              type="text"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">المتغيرات أو التفاصيل</label>
            <input
              type="text"
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ توصية وتصميم المنهجية البحثية...' : 'توصية الخطة المنهجية علمياً 📐'}
        </button>
      </form>

      {result && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <h3 className="text-xl font-bold text-amber-400 border-b border-slate-800 pb-3">الخطة المنهجية المقترحة</h3>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">1. المنهج البحثي والتبرير:</h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-amber-400 block">{result.researchDesign?.type}</span>
              <p className="text-xs text-slate-300 leading-relaxed">{result.researchDesign?.rationale}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">2. مجتمع وعينة الدراسة:</h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-emerald-400 block">المجتمع: {result.populationAndSampling?.targetPopulation}</span>
              <p className="text-xs text-slate-300 leading-relaxed">العينة والأسلوب: {result.populationAndSampling?.samplingMethod}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-cyan-400">أدوات جمع البيانات:</h4>
              <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {result.instruments?.map((inst: string, i: number) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span> {inst}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-purple-400">الأساليب الإحصائية:</h4>
              <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {result.statisticalMethods?.map((stat: string, i: number) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-purple-400 font-bold">•</span> {stat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
