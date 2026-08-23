'use client';

import { useState } from 'react';

export default function JourneyTrackerPage() {
  const [researcherId] = useState('researcher_demo_01');
  const [currentStep, setCurrentStep] = useState('IDEA_SUBMISSION');
  const [idea, setIdea] = useState('أثر الذكاء الاصطناعي التوليدي في تحسين مهارات الكتابة الأكاديمية لطلبة الدراسات العليا');
  const [journeyLog, setJourneyLog] = useState<any[]>([
    { step: 'IDEA_SUBMISSION', title: 'إيداع الفكرة الخام', status: 'COMPLETED', details: idea }
  ]);
  const [loading, setLoading] = useState(false);

  const advanceJourney = async (nextStepName: string, data: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/academic/journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researcherId, currentStep: nextStepName, stepData: data }),
      });
      const resData = await res.json();
      if (resData.success) {
        setCurrentStep(resData.journeyState.nextAllowedStep);
        setJourneyLog(prev => [...prev, { step: nextStepName, title: 'إنجاز محطة: ' + nextStepName, status: 'COMPLETED', details: JSON.stringify(data) }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 md:p-10">
      <div className="border-b border-slate-800 pb-6">
        <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold rounded-full">
          Mission 3 - Memory & Research Journey Timeline
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">الخط الزمني لرحلة البحث الأكاديمي</h1>
        <p className="text-slate-400 mt-1">تتبع مسار الباحث خطوة بخطوة بذاكرة مستمرة تمنع التخبط وتضمن نضج العمل</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <h3 className="text-lg font-bold text-purple-400">حالة الباحث الحالية: <span className="text-white font-mono">{currentStep}</span></h3>

        <div className="space-y-4">
          <div className="border-r-2 border-purple-500 pr-4 space-y-6">
            {journeyLog.map((log, idx) => (
              <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 relative">
                <span className="absolute -right-[23px] top-4 w-3 h-3 bg-purple-500 rounded-full border-2 border-slate-900"></span>
                <span className="text-[10px] font-bold text-purple-400 uppercase">{log.step}</span>
                <h4 className="font-bold text-white text-sm">{log.title}</h4>
                <p className="text-xs text-slate-400 font-mono">{log.details}</p>
              </div>
            ))}
          </div>
        </div>

        {currentStep === 'IDEA_SUBMISSION' && (
          <button
            onClick={() => advanceJourney('IDEA_SUBMISSION', { ideaText: idea })}
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all"
          >
            الانتقال لتقييم العقل الأكاديمي ➔
          </button>
        )}

        {currentStep === 'BRAIN_EVALUATION' && (
          <button
            onClick={() => advanceJourney('BRAIN_EVALUATION', { status: 'APPROVED', note: 'اجتاز الفحص بنجاح' })}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all"
          >
            اعتماد الفكرة والانتقال لطبقة الأدلة (Evidence Layer) ➔
          </button>
        )}
      </div>
    </div>
  );
}
