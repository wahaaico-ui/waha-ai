'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TitleEnginePage() {
  const [idea, setIdea] = useState('أثر الذكاء الاصطناعي على التحصيل الأكاديمي لطلبة الجامعات');
  const [discipline, setDiscipline] = useState('Education & Technology');
  const [variables, setVariables] = useState('المستقل: الذكاء الاصطناعي | التابع: التحصيل الأكاديمي');
  const [titlesResult, setTitlesResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateTitles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() && !discipline.trim()) return;

    setLoading(true);
    setError('');
    setTitlesResult([]);

    try {
      const res = await fetch('/api/academic/title-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, discipline, variables }),
      });

      const data = await res.json();
      if (data.success && data.data?.titles) {
        setTitlesResult(data.data.titles);
      } else {
        setError(data.error || 'فشل توليد العناوين');
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

        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="px-3 py-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 8
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Title Engine</h1>
            <p className="text-slate-400 mt-1">محرك صياغة وبناء العناوين الأكاديمية الاحترافية والرصينة</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={generateTitles} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">الفكرة البحثية الأساسية</label>
              <input
                type="text"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="أدخل الفكرة..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">التخصص الأكاديمي</label>
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="أدخل التخصص..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">المتغيرات أو تفاصيل إضافية</label>
            <input
              type="text"
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              placeholder="المتغيرات المستقلة والتابعة..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-pink-500"
            />
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-2xl shadow-lg shadow-pink-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ صياغة واختيار أفضل العناوين الأكاديمية...' : 'تشغيل Title Engine وبناء العناوين 🏷️'}
          </button>
        </form>

        {titlesResult.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-pink-400 border-b border-slate-800 pb-3">العناوين الأكاديمية المقترحة</h3>

            <div className="grid grid-cols-1 gap-6">
              {titlesResult.map((item: any) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-lg font-bold text-white leading-snug">
                      <span className="text-pink-400 ml-2">#{item.id}</span>
                      {item.title}
                    </h4>
                    <button
                      onClick={() => navigator.clipboard.writeText(item.title)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors border border-slate-700 shrink-0"
                    >
                      نسخ العنوان 📋
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800 text-xs">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="font-bold text-pink-400">النمط البحثي:</span>
                      <p className="text-slate-300">{item.style}</p>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="font-bold text-pink-400">المبرر الأكاديمي:</span>
                      <p className="text-slate-300 leading-relaxed">{item.rationale}</p>
                    </div>
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
