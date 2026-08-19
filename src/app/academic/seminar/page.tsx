'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SeminarBuilderPage() {
  const [title, setTitle] = useState('أثر الذكاء الاصطناعي التوليدي على كفاءة البحث العلمي لطلبة الدراسات العليا');
  const [discipline, setDiscipline] = useState('Computer Science & Education');
  const [variables, setVariables] = useState('المستقل: الذكاء الاصطناعي التوليدي | التابع: كفاءة البحث العلمي');
  const [seminarResult, setSeminarResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateSeminar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');
    setSeminarResult(null);

    try {
      const res = await fetch('/api/academic/seminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, discipline, variables }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setSeminarResult(data.data);
      } else {
        setError(data.error || 'فشل توليد السيمينار');
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
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
              Sprint 1 - TASK 9 (ختام Sprint 1)
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Seminar & Proposal Builder</h1>
            <p className="text-slate-400 mt-1">مُولد السيمينار، المقترح البحثي، ومحاكاة أسئلة لجنة المناقشة</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للرئيسية
          </Link>
        </div>

        <form onSubmit={generateSeminar} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">العنوان الأكاديمي المعتمد</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="أدخل العنوان..."
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
                placeholder="التخصص..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">المتغيرات أو التفاصيل</label>
              <input
                type="text"
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder="المتغيرات..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ بناء المقترح والسيمينار ومحاكاة المناقشة...' : 'تشغيل Seminar Builder 🎓'}
          </button>
        </form>

        {seminarResult && (
          <div className="space-y-8">

            {/* Executive Summary */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-lg font-bold text-amber-400">الملخص التنفيذي لمقترح البحث</h3>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {seminarResult.executiveSummary}
              </p>
            </div>

            {/* Questions & Hypotheses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
                <h4 className="text-sm font-bold text-amber-400">أسئلة البحث:</h4>
                <ul className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {seminarResult.researchQuestions?.map((q: string, i: number) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span> {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
                <h4 className="text-sm font-bold text-emerald-400">الفرضيات:</h4>
                <ul className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {seminarResult.hypotheses?.map((h: string, i: number) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span> {h}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Seminar Slides Outline */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
              <h3 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-3">هيكل شرائح عرض السيمينار</h3>
              <div className="grid grid-cols-1 gap-4">
                {seminarResult.seminarSlides?.map((slide: any) => (
                  <div key={slide.slideNumber} className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">شريحة #{slide.slideNumber}</span>
                      <h4 className="text-sm font-bold text-white">{slide.title}</h4>
                    </div>
                    <ul className="space-y-1 pt-2 border-t border-slate-800/80">
                      {slide.bulletPoints?.map((bp: string, idx: number) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-slate-500">-</span> {bp}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Defense Simulation */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
              <h3 className="text-lg font-bold text-purple-400 border-b border-slate-800 pb-3">محاكاة أسئلة لجنة المناقشة والدفاع</h3>
              <div className="space-y-4">
                {seminarResult.defenseQuestions?.map((def: any, idx: number) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-6 rounded-xl space-y-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-purple-400">سؤال المحكم #{idx + 1}</span>
                      <p className="text-sm font-bold text-white">{def.question}</p>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-slate-800">
                      <span className="text-xs font-bold text-emerald-400">الإجابة النموذجية المقترحة:</span>
                      <p className="text-xs text-slate-300 leading-relaxed">{def.sampleAnswer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
