'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function IdeaEnginePage() {
  const [discipline, setDiscipline] = useState('Computer Science / Education');
  const [originalIdea, setOriginalIdea] = useState('أثر الذكاء الاصطناعي على الطلاب');
  const [ideasResult, setIdeasResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discipline.trim() && !originalIdea.trim()) return;

    setLoading(true);
    setError('');
    setIdeasResult([]);

    try {
      const res = await fetch('/api/academic/idea-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discipline, originalIdea }),
      });

      const data = await res.json();
      if (data.success && data.data?.ideas) {
        setIdeasResult(data.data.ideas);
      } else {
        setError(data.error || 'فشل توليد الأفكار');
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
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 7
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Idea Engine</h1>
            <p className="text-slate-400 mt-1">مولد الأفكار البحثية الابتكارية والبديلة (توليد أفكار ذات أصالة عالية)</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={generateIdeas} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">التخصص الأكاديمي</label>
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="أدخل التخصص..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">الفكرة الأصلية (الضعيفة أو المكررة)</label>
              <input
                type="text"
                value={originalIdea}
                onChange={(e) => setOriginalIdea(e.target.value)}
                placeholder="أدخل الفكرة..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ ابتكار وتوليد الأفكار البحثية البديلة...' : 'تشغيل Idea Engine ولّيد الأفكار 💡'}
          </button>
        </form>

        {ideasResult.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-emerald-400 border-b border-slate-800 pb-3">الأفكار البحثية البديلة المبتكرة</h3>
            
            <div className="grid grid-cols-1 gap-6">
              {ideasResult.map((idea: any) => (
                <div key={idea.id} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-lg font-bold text-white leading-snug">
                      <span className="text-emerald-400 ml-2">#{idea.id}</span>
                      {idea.title}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800 text-xs">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="font-bold text-emerald-400">المشكلة البحثية:</span>
                      <p className="text-slate-300 leading-relaxed">{idea.problem}</p>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="font-bold text-emerald-400">الفجوة العلمية:</span>
                      <p className="text-slate-300 leading-relaxed">{idea.gap}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400">
                    <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <strong className="text-slate-200">المتغير المستقل:</strong> {idea.independentVariable}
                    </span>
                    <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <strong className="text-slate-200">المتغير التابع:</strong> {idea.dependentVariable}
                    </span>
                    <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <strong className="text-slate-200">المجتمع:</strong> {idea.population}
                    </span>
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
