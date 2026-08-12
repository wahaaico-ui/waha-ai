import Link from 'next/link';

export default function AcademicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white relative overflow-hidden">
      
قاعدة التدرجات الضوئية الخلفية الفاخرة (Ambient Glow)
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

شريط التنقل العلوي الفاخر (Elite Navbar)
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/academic" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-lg">W</span>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block">WAHA Academic</span>
              <span className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase block">منصة الأبحاث الذكية</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/academic"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              الرئيسية
            </Link>
            <Link
              href="/academic/workspace"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              مساحة العمل ⚡
            </Link>
            <Link
              href="/academic/dashboard"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              لوحة التحكم 💾
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/academic/workspace"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02]"
            >
              بدء مشروع جديد 🚀
            </Link>
          </div>
        </div>
      </header>

محتوى الصفحات
      <main className="relative z-10">
        {children}
      </main>

تذييل الصفحة الاحترافي (Elite Footer)
      <footer className="border-t border-slate-900 bg-slate-950/60 py-8 px-6 mt-20 relative z-10 text-center text-xs text-slate-500 space-y-2">
        <p>WAHA Smart Academic Platform © 2026 — كافة الحقوق محفوظة للنظام البحثي المحلي الآمن.</p>
        <p className="text-slate-600 font-mono">Powered by Next.js, Supabase & Gemini Intelligence Engine</p>
      </footer>
    </div>
  );
}
