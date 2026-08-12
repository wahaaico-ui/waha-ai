'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CentralDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/academic/dashboard')
      .then(res => res.json())
      .then(resData => {
        if (resData.success) {
          setData(resData.dashboard);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-10 text-center text-slate-400">جاري تحميل غرفة العمليات المركزية لـ WAHA...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 md:p-10">
      
      {/* رأس اللوحة */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-full">
            WAHA Central Hub - Workspace
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">لوحة التحكم المركزية للبحث</h1>
          <p className="text-slate-400 mt-1">مرحباً بك، {data?.researcherName} | المشروع النشط: <strong className="text-white">{data?.activeProject}</strong></p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/academic/brain-test" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-xl text-xs font-medium text-slate-200 transition-colors">
            العقل الأكاديمي 🧠
          </Link>
          <Link href="/academic/evidence-test" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-xs font-medium text-slate-200 transition-colors">
            طبقة الأدلة 📚
          </Link>
        </div>
      </div>

      {/* مؤشرات الحالة العامة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* حالة العقل الأكاديمي */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">حالة المشرف الأكاديمي</span>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full">
              {data?.brainStatus.status}
            </span>
          </div>
          <h3 className="text-2xl font-black text-white">{data?.brainStatus.clarityScore}% <span className="text-xs font-normal text-slate-400">مؤشر الوضوح</span></h3>
          <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
            {data?.brainStatus.lastCritique}
          </p>
        </div>

        {/* مؤشر طبقة الأدلة */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">طبقة الأدلة والمصادر</span>
            <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold rounded-full">
              ثقة عالية
            </span>
          </div>
          <h3 className="text-2xl font-black text-white">{data?.evidenceStats.totalPapersIndexed} <span className="text-xs font-normal text-slate-400">أبحاث مفهرسة</span></h3>
          <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between">
            <span>درجة الثقة: <strong className="text-emerald-400">{data?.evidenceStats.averageConfidence}%</strong></span>
            <span>الفجوات: <strong className="text-amber-400">{data?.evidenceStats.identifiedGapsCount}</strong></span>
          </div>
        </div>

        {/* رحلة البحث الحالية */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">المحطة الحالية للرحلة</span>
            <span className="px-2.5 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold rounded-full">
              نشط
            </span>
          </div>
          <h3 className="text-lg font-black text-white font-mono">{data?.currentJourneyStep}</h3>
          <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
            الباحث يسير وفق التسلسل الأكاديمي المعتمد دون قفزات عشوائية.
          </p>
        </div>

      </div>

      {/* الخط الزمني لمراحل البحث */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
        <h3 className="text-xl font-bold text-white border-b border-slate-800 pb-4">الخط الزمني ومحطات إنجاز البحث</h3>

        <div className="space-y-4">
          {data?.recentMilestones.map((m: any, idx: number) => (
            <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${m.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                <div>
                  <h4 className="font-bold text-white text-sm">{m.title}</h4>
                  <span className="text-slate-400 font-mono text-[10px]">{m.step}</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full font-bold ${m.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
