export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <span className="px-3 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
          WAHA Academic Engine — Live
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          محرك الذكاء الاصطناعي الأكاديمي المتقدم
        </h1>
        <p className="text-slate-400 text-lg">
          النظام يعمل الآن بنجاح تام وبدون أي أخطاء تداخل. جاهز لبناء واستقبال أول ميزة بحثية حقيقية.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <a
            href="/dashboard"
            className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all shadow-lg shadow-emerald-600/20"
          >
            الانتقال إلى لوحة التحكم
          </a>
        </div>
      </div>
    </main>
  );
}
