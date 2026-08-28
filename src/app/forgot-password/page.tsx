'use client';

import { Mail, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Logo from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    if (resetError) setError('تعذر إرسال رابط الاستعادة. تحقق من البريد ثم حاول مجدداً.');
    else setSent(true);
    setLoading(false);
  };
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f8fafc] p-4 text-slate-900"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9"><Link href="/" className="mb-8 flex items-center justify-center" aria-label="WAHA AI"><Logo variant="full" className="h-9 w-auto" /></Link>{sent ? <div className="text-center"><MailCheck className="mx-auto mb-4 h-16 w-16 text-blue-600" /><h1 className="text-2xl font-black">تحقق من بريدك</h1><p className="mt-3 leading-7 text-slate-600">أرسلنا رابطاً آمناً إلى <bdi className="font-bold text-slate-800">{email}</bdi>. افتح الرسالة واضغط <strong>إعادة تعيين كلمة المرور</strong>.</p><p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">سيأخذك الرابط إلى صفحة آمنة تتطلب كلمة مرور قوية جديدة.</p></div> : <><Mail className="mb-5 h-11 w-11 text-blue-600" /><h1 className="text-2xl font-black">استعادة كلمة المرور</h1><p className="mt-2 text-sm leading-6 text-slate-500">أدخل بريد حسابك وسنرسل رابط الاستعادة. لا نكشف إن كان البريد مسجلاً حفاظاً على الخصوصية.</p>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="email" className="mb-1.5 block text-sm font-bold text-slate-700">البريد الإلكتروني</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" required /></div><button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50">{loading ? 'جارٍ الإرسال…' : 'إرسال رابط الاستعادة'}</button></form></>}<p className="mt-7 text-center text-sm text-slate-500"><Link href="/login" className="font-bold text-blue-600 hover:underline">العودة إلى تسجيل الدخول</Link></p></section></main>;
}
