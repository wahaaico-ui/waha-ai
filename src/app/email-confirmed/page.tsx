import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function EmailConfirmedPage() {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f8fafc] p-4 text-slate-900"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-10"><span className="mx-auto mb-7 grid h-11 w-11 place-items-center rounded-xl bg-blue-600 font-bold text-white">W</span><CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-emerald-500" /><h1 className="text-3xl font-black">تم تأكيد بريدك بنجاح</h1><p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">أهلاً بك في WAHA. أصبح حسابك جاهزاً لبدء رحلة بحثية منظمة من الفكرة إلى النشر.</p><Link href="/projects/create" className="mt-7 inline-flex rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20">ابدأ بحثك الآن ←</Link></section></main>;
}
