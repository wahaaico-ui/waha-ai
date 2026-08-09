import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <span className="bg-blue-600 text-white w-12 h-12 rounded-2xl inline-flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-600/30 mb-4">W</span>
          <h1 className="text-2xl font-black tracking-tight">تسجيل الدخول إلى WAHA</h1>
          <p className="text-slate-400 text-sm mt-1">نظام التشغيل الأكاديمي السيادي</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">البريد الإلكتروني الأكاديمي</label>
            <input type="email" placeholder="name@university.edu" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">كلمة المرور</label>
            <input type="password" placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
          
          <Link href="/dashboard" className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm">
            دخول لوحة التحكم
          </Link>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          ليس لديك حساب؟ <Link href="/" className="text-blue-400 hover:underline">ابدأ فكرة بحثية جديدة</Link>
        </div>
      </div>
    </div>
  );
}
