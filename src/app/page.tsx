'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/waha/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحليل');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white" dir="rtl">
      {/* Navbar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 font-black text-2xl tracking-tight text-slate-900">
              <span className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-blue-600/30">W</span>
              WAHA AI
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="#features" className="hover:text-blue-600 transition-colors">المميزات</a>
              <a href="#how" className="hover:text-blue-600 transition-colors">كيف يعمل</a>
              <a href="#universities" className="hover:text-blue-600 transition-colors">الجامعات</a>
              <a href="#pricing" className="hover:text-blue-600 transition-colors">الأسعار</a>
              <a href="#faq" className="hover:text-blue-600 transition-colors">الأسئلة الشائعة</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2">English</button>
            <button className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2">تسجيل الدخول</button>
            <a href="#start" className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-blue-600/20">
              ابدأ الآن
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Right Text Content */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              نظام التشغيل الأكاديمي
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
              ابداً رحلتك البحثية <span className="text-blue-600">بثقة.</span>
            </h1>
            
            <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
              من الفكرة الأولى وحتى التقرير النهائي... WAHA يساعدك على التفكير، التنظيم، والتحليل الأكاديمي بطريقة احترافية.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#start" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25 text-sm">
                <span>ابداً مشروعاً جديداً</span>
                <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </a>
              <button className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-6 py-3.5 rounded-xl transition-all text-sm shadow-sm">
                <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                <span>شاهد العرض</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-6 pt-8 border-t border-slate-200/80">
              <div>
                <div className="text-xl font-bold text-slate-900 flex items-center gap-1">★ 4.9</div>
                <div className="text-xs text-slate-500 mt-0.5">تقييم</div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">+38,000</div>
                <div className="text-xs text-slate-500 mt-0.5">مشروع بحثي</div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">+12,000</div>
                <div className="text-xs text-slate-500 mt-0.5">باحث</div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">+40</div>
                <div className="text-xs text-slate-500 mt-0.5">جامعة</div>
              </div>
            </div>
          </div>

          {/* Left Interactive Mockup Card */}
          <div className="lg:col-span-6" id="start">
            <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xl p-6 lg:p-8 backdrop-blur-xl relative">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <span className="text-xs font-bold text-slate-400 tracking-wider">WAHA AI · Research Entry</span>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">اكتب فكرة بحثك هنا...</label>
                  <textarea
                    rows={3}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="مثال: أثر دراسة أثر الذكاء الاصطناعي على جودة اتخاذ القرار في المنظمات الحكومية."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all resize-none shadow-inner"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm disabled:opacity-50"
                >
                  {loading ? 'جارٍ الفحص والتحقق الأكاديمي...' : 'تحليل الفكرة'}
                </button>
              </form>

              {/* Progress Meters */}
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>وضوح الموضوع</span>
                  <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full w-3/4 rounded-full"></div></div>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>حدة البحث</span>
                  <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full w-2/3 rounded-full"></div></div>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>قابلية التطبيق</span>
                  <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-full rounded-full"></div></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Results Section if available */}
      {result && (
        <section className="max-w-7xl mx-auto px-6 pb-20">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
            <h3 className="text-xl font-bold text-slate-900">نتيجة الفحص والتحقق (عبر OpenAlex)</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{result.gapAnalysis}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.papers.map((p: any, i: number) => (
                <div key={i} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{p.title}</h4>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>السنة: {p.year}</span>
                    <span>الاستشهادات: {p.citedByCount}</span>
                    <span className="text-blue-600 font-mono">DOI: {p.doi}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Error display */}
      {error && (
        <section className="max-w-7xl mx-auto px-6 pb-10">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm">
            <strong>تنبيه أكاديمي:</strong> {error}
          </div>
        </section>
      )}

      {/* Trust Footer */}
      <section className="border-t border-slate-200 bg-white py-12" id="universities">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">موثوق به من أفضل الجامعات والمؤسسات</p>
          <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-12 text-slate-500 font-bold text-sm">
            <span className="px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">جامعة قطر</span>
            <span className="px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">جامعة الكويت</span>
            <span className="px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">جامعة الشارقة</span>
            <span className="px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">جامعة القاهرة</span>
            <span className="px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">جامعة الإمارات</span>
            <span className="px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">جامعة الملك عبدالعزيز</span>
          </div>
        </div>
      </section>
    </div>
  );
}
