import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import { safeAuthRedirect } from '@/lib/auth/safe-redirect';

export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeAuthRedirect(next, '/verify-idea');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isConfirmed = Boolean(user?.email_confirmed_at);

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f8fafc] p-4 text-slate-900"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-10"><Logo variant="monogram" className="mx-auto mb-7 h-11 w-11" />{isConfirmed ? <><CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-emerald-500" /><h1 className="text-3xl font-black">تم تأكيد بريدك بنجاح</h1><p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">أهلاً بك في WAHA. أصبح حسابك جاهزاً، وسنعيدك إلى الخطوة التي بدأت منها دون إنشاء مشروع فارغ.</p><Link href={destination} className="mt-7 inline-flex rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20">متابعة رحلتي ←</Link></> : <><AlertCircle className="mx-auto mb-5 h-16 w-16 text-amber-500" /><h1 className="text-3xl font-black">لم نتمكن من التحقق من التأكيد</h1><p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">لا نعرض رسالة نجاح إلا بعد التحقق من جلسة الحساب. قد يكون الرابط منتهياً أو فُتح في متصفح مختلف.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/login" className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white">تسجيل الدخول</Link><Link href="/signup" className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700">إنشاء حساب أو إعادة الإرسال</Link></div></>}</section></main>;
}
