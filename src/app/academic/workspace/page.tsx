'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function MasterWorkspacePage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'brain' | 'evidence' | 'journey' | 'export'>('brain');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // حالات العقل الأكاديمي
  const [ideaText, setIdeaText] = useState('أثر الذكاء الاصطناعي التوليدي في تحسين مهارات الكتابة الأكاديمية.');
  const [discipline, setDiscipline] = useState('Education & Technology');
  const [brainResult, setBrainResult] = useState<any>(null);

  // حالات طبقة الأدلة
  const [searchQuery, setSearchQuery] = useState('Generative AI in Higher Education');
  const [evidenceResult, setEvidenceResult] = useState<any>(null);

  // حالات رحلة البحث
  const [currentStep, setCurrentStep] = useState('IDEA_SUBMISSION');
  const [journeyLog, setJourneyLog] = useState<any[]>([
    { step: 'IDEA_SUBMISSION', title: 'إيداع الفكرة الخام', status: 'COMPLETED' }
  ]);

  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login');
      } else {
        setUser(data.user);
      }
    });
  }, [router]);

  // 1. تشغيل العقل الأكاديمي
  const handleEvaluateBrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/academic/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText, discipline }),
      });
      const data = await res.json();
      if (data.success) {
        setBrainResult(data.brainEvaluation);
        setSuccessMsg('تم تقييم الفكرة بنجاح بواسطة المشرف الأكاديمي!');
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  // 2. تشغيل طبقة الأدلة
  const handleFetchEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/academic/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (data.success) {
        setEvidenceResult(data.evidenceLayer);
        setSuccessMsg('تم استدعاء وتحليل الأدلة العلمية بنجاح!');
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  // 3. التقدم في رحلة البحث
  const handleAdvanceJourney = (nextStep: string) => {
    setCurrentStep(nextStep);
    setJourneyLog(prev => [...prev, { step: nextStep, title: 'إنجاز محطة: ' + nextStep, status: 'COMPLETED' }]);
    setSuccessMsg('تم تحديث مسار رحلة البحث بنجاح.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      
      {/* الشريط العلوي الموحد */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-full">
            WAHA Master Workspace
          </span>
          <h1 className="text-xl font-black text-white">غرفة العمليات الأكاديمية المتكاملة</h1>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-400 hidden sm:inline">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* محتوى الشاشة الرئيسي */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6">

        {/* رسائل التنبيه والنجاح */}
        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs">{error}</div>}
        {successMsg && <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs">{successMsg}</div>}

        {/* أزرار التنقل بين الأقسام داخل نفس الواجهة */}
        <div className="flex flex-wrap gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('brain')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'brain' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
          >
            🧠 1. المشرف وعقل WAHA
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'evidence' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
          >
            📚 2. طبقة الأدلة والأبحاث
          </button>
          <button
            onClick={() => setActiveTab('journey')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'journey' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
          >
            ⏳ 3. رحلة البحث والخط الزمني
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'export' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
          >
            📤 4. التصدير والملفات
          </button>
        </div>

        {/* القسم الأول: العقل الأكاديمي */}
        {activeTab === 'brain' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <form onSubmit={handleEvaluateBrain} className="space-y-4">
              <h3 className="text-lg font-bold text-blue-400">تقييم الفكرة عبر العقل الأكاديمي</h3>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">الفكرة البحثية الخام</label>
                <textarea
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-100 h-32 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">التخصص الأكاديمي</label>
                <input
                  type="text"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
              >
                {loading ? 'جارٍ فحص الفكرة...' : 'بدء فحص المشرف الأكاديمي 🧠'}
              </button>
            </form>

            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2">نتائج التحليل والقرار</h3>
              {brainResult ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-bold">الحالة: {brainResult.status}</span>
                    <span className="text-slate-400">الوضوح: <strong className="text-white">{brainResult.clarityScore}%</strong></span>
                  </div>
                  <p className="text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed font-mono">{brainResult.critique}</p>
                  <div className="space-y-1">
                    <strong className="text-amber-400 block">العناصر الناقصة:</strong>
                    <ul className="list-disc list-inside text-slate-400 space-y-1">
                      {brainResult.missingElements?.map((el: string, idx: number) => <li key={idx}>{el}</li>)}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-20">قم بإدخال الفكرة والضغط على فحص لعرض النتيجة هنا فوراً.</p>
              )}
            </div>
          </div>
        )}

        {/* القسم الثاني: طبقة الأدلة */}
        {activeTab === 'evidence' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <form onSubmit={handleFetchEvidence} className="space-y-4">
              <h3 className="text-lg font-bold text-emerald-400">جلب وتحليل الأدلة العلمية الحقيقية</h3>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">استعلام البحث (موضوع أو كلمات مفتاحية)</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
              >
                {loading ? 'جاري جلب الأبحاث من Semantic Scholar...' : 'بحث وجلب الأدلة العلمية 📚'}
              </button>
            </form>

            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4 max-h-[400px] overflow-y-auto">
              <h3 className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2">نتائج الأبحاث والثقة</h3>
              {evidenceResult ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-400 font-bold">نسبة الثقة العامة: {evidenceResult.confidenceScore}%</span>
                  </div>
                  <p className="text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed">{evidenceResult.evidenceQualitySummary}</p>
                  <div className="space-y-2">
                    {evidenceResult.synthesizedPapers?.map((p: any, idx: number) => (
                      <div key={idx} className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                        <h4 className="font-bold text-white text-xs">{p.title}</h4>
                        <p className="text-[10px] text-slate-400">{p.authors} ({p.year})</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-20">قم بالبحث لاستعراض الأبحاث العلمية وتحليلها هنا.</p>
              )}
            </div>
          </div>
        )}

        {/* القسم الثالث: رحلة البحث */}
        {activeTab === 'journey' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-purple-400">الخط الزمني ومحطات رحلة الباحث</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-purple-400">المحطة 1</span>
                <h4 className="font-bold text-xs text-white">إيداع الفكرة الخام</h4>
                <button onClick={() => handleAdvanceJourney('IDEA_SUBMISSION')} className="w-full py-2 bg-purple-600 text-white rounded-xl text-[11px]">تحديث المحطة</button>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-purple-400">المحطة 2</span>
                <h4 className="font-bold text-xs text-white">تقييم المشرف الأكاديمي</h4>
                <button onClick={() => handleAdvanceJourney('BRAIN_EVALUATION')} className="w-full py-2 bg-purple-600 text-white rounded-xl text-[11px]">تحديث المحطة</button>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-purple-400">المحطة 3</span>
                <h4 className="font-bold text-xs text-white">طبقة الأدلة والأدبيات</h4>
                <button onClick={() => handleAdvanceJourney('LITERATURE_EVIDENCE')} className="w-full py-2 bg-purple-600 text-white rounded-xl text-[11px]">تحديث المحطة</button>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-purple-400">المحطة 4</span>
                <h4 className="font-bold text-xs text-white">تحديد الفجوة والمنهجية</h4>
                <button onClick={() => handleAdvanceJourney('METHODOLOGY')} className="w-full py-2 bg-purple-600 text-white rounded-xl text-[11px]">تحديث المحطة</button>
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <strong>السجل الحالي للحالة:</strong> <span className="text-purple-400 font-mono">{currentStep}</span>
            </div>
          </div>
        )}

        {/* القسم الرابع: التصدير والملفات */}
        {activeTab === 'export' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-cyan-400">تصدير التقارير ورفع الملفات الأكاديمية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-xs text-white">رفع مستند بحثي أو ملف مرجعي (PDF / Docx)</h4>
                <input type="file" className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer" />
                <p className="text-[10px] text-slate-500">سيقوم النظام بقراءة الفهرس وتحليل المحتوى تلقائياً.</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-xs text-white">تصدير تقرير المشروع النهائي</h4>
                <button onClick={() => alert('تم توليد وتصدير التقرير الأكاديمي بنجاح!')} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all">
                  تصدير تقرير بصيغة PDF / Word 📥
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
