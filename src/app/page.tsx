import Link from 'next/link';

export default function WahaLandingPage() {
  return (
    <div className="min-h-screen bg-[#090D16] text-white font-sans selection:bg-emerald-500 selection:text-gray-950" dir="rtl">
      {/* Header */}
      <header className="border-b border-gray-800/80 bg-[#090D16]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-gray-950 text-xl shadow-lg shadow-emerald-500/20">
              W
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              WAHA AI <span className="text-emerald-400 text-xs font-normal border border-emerald-500/30 px-2 py-0.5 rounded-full mr-2">Pro</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
              تسجيل الدخول
            </Link>
            <Link href="/signup" className="text-sm bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20">
              ابدأ مجاناً
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          النظام الأكاديمي المتقدم لتحليل الفجوات البحثية
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-8">
          اكشف الفجوات البحثية بدقة <br />
          <span className="text-emerald-400">وتحليل ذكي متكامل</span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl font-light max-w-2xl mx-auto mb-12 leading-relaxed">
          منصة هندسية متطورة لإدارة أبحاثك، استخراج النتائج الاستراتيجية، وربط البيانات بكفاءة عالية.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/projects/create"
            className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/25 text-base flex items-center justify-center gap-3"
          >
            <span>انتقل إلى لوحة التحكم المباشرة</span>
            <span>&larr;</span>
          </Link>
        </div>
      </main>
    </div>
  );
}