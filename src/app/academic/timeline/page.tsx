'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TimelinePage() {
  const [researchType, setResearchType] = useState('رسالة ماجستير في تقنية المعلومات (منهج تجريبي وتطويري)');
  const [durationMonths, setDurationMonths] = useState('6 أشهر');
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchType.trim()) return;

    setLoading(true);
    setError('');
    setTimelineData([]);

    try {
      const res = await fetch('/api/academic/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchType, durationMonths }),
      });

      const data = await res.json();
      if (data.success && data.timeline?.milestones) {
        setTimelineData(data.timeline.milestones);
      } else {
        setError(data.error || 'فشل توليد الجدول الزمني');
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
            Sprint 13 - Research Timeline & Milestone Planner
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مخطط الجدول الزمني ومراحل البحث</h1>
          <p className="text-slate-400 mt-1">تخطيط وتوزيع مراحل إنجاز البحث بجدول زمني دقيق ومنظم ذكياً</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateTimeline} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="block text-sm font-bold text-slate-200">طبيعة البحث أو المشروع</label>
            <input
              type="text"
              value={researchType}
              onChange={(e) => setResearchType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">المدة الزمنية الكلية</label>
            <input
              type="text"
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !researchType.trim()}
          className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ تصميم وتخطيط المراحل الزمنية...' : 'توليد الجدول الزمني ومراحل البحث ⏱️'}
        </button>
      </form>

      {timelineData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <h3 className="text-xl font-bold text-amber-400 border-b border-slate-800 pb-3">مراحل التنفيذ والإطار الزمني المقترح</h3>

          <div className="space-y-4">
            {timelineData.map((item: any) => (
              <div key={item.id} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs">
                      {item.id}
                    </span>
                    {item.phaseName}
                  </h4>
                  <span className="px-3 py-1 bg-slate-900 text-amber-400 text-xs font-semibold rounded-full border border-slate-800">
                    المدة: {item.duration}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <strong className="text-slate-400 block mb-1">المهام الرئيسية:</strong>
                    <ul className="space-y-1 text-slate-300">
                      {item.tasks?.map((t: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">•</span> {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <strong className="text-emerald-400 block mb-1">المخرجات والتسليمات (Deliverables):</strong>
                    <p className="text-slate-300 leading-relaxed">{item.deliverables}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
