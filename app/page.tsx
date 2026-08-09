import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center antialiased">
      <div className="max-w-2xl text-center space-y-6 px-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
          مرحباً بك في Waha AI
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto leading-relaxed">
          تم تشغيل المشروع وإصلاح كافة أخطاء النظام بنجاح. يمكنك الآن البدء في بناء موقعك.
        </p>
        <div className="pt-4">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center py-3 px-8 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all shadow-xl shadow-blue-600/20 text-sm"
          >
            الانتقال للوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}
