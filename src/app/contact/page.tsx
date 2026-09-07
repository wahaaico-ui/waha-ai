'use client';

import Link from 'next/link';
import { CircleHelp, LockKeyhole, Mail, MessagesSquare } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { useWahaLanguage } from '@/lib/use-language';

const SUPPORT_EMAIL = 'support@waha.systems';

const CONTENT = {
  ar: {
    eyebrow: 'تواصل معنا',
    title: 'أخبرنا أين توقفت، وسنوجّهك إلى المسار المناسب',
    intro: 'للاستفسارات التقنية، الشراكات الأكاديمية، أو ملاحظات تجربة البحث، استخدم قناة التواصل الرسمية أدناه.',
    emailTitle: 'البريد الرسمي',
    emailDetail: 'يفتح برنامج البريد على جهازك. اذكر الصفحة والمشكلة دون إرسال كلمة مرور أو مفتاح وصول.',
    emailCta: 'إرسال رسالة',
    topicsTitle: 'ما الذي يمكنك مراسلتنا بشأنه؟',
    topics: ['مشكلة في تسجيل الدخول أو استعادة الحساب', 'خلل في مرحلة أو نتيجة داخل مشروع بحثي', 'اقتراح لتحسين تجربة الباحث', 'تعاون مع جامعة أو جهة أكاديمية'],
    privacyTitle: 'قبل أن ترسل',
    privacy: 'لا ترسل كلمة مرور، رمز تحقق، مفتاح API، أو ملفاً بحثياً سرياً في الرسالة الأولى. أرسل وصفاً مختصراً ورابط الصفحة فقط، وسنطلب الحد الأدنى اللازم عند الحاجة.',
    quickTitle: 'روابط سريعة',
    login: 'تسجيل الدخول',
    dashboard: 'مشاريعي',
    explore: 'بدء استكشاف جديد',
  },
  en: {
    eyebrow: 'Contact',
    title: 'Tell us where you stopped, and we will point you to the right path',
    intro: 'For technical questions, academic partnerships, or research experience feedback, use the official contact channel below.',
    emailTitle: 'Official email',
    emailDetail: 'This opens your email application. Mention the page and issue without sending a password or access key.',
    emailCta: 'Send an email',
    topicsTitle: 'What can you contact us about?',
    topics: ['Sign-in or account recovery issues', 'A problem with a stage or result in a research project', 'A suggestion to improve the researcher experience', 'University or academic partnership enquiries'],
    privacyTitle: 'Before you send',
    privacy: 'Do not send a password, verification code, API key, or confidential research file in your first message. Send a brief description and the page URL only; we will request the minimum necessary information if needed.',
    quickTitle: 'Quick links',
    login: 'Sign in',
    dashboard: 'My projects',
    explore: 'Start a new exploration',
  },
} as const;

export default function ContactPage() {
  const { language } = useWahaLanguage();
  const t = CONTENT[language];
  const subject = encodeURIComponent(language === 'ar' ? 'استفسار من منصة WAHA' : 'WAHA platform enquiry');

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f8fafc] text-slate-950">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <header className="mx-auto max-w-4xl text-center"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">{t.eyebrow}</span><h1 className="mt-6 font-display text-4xl font-semibold leading-tight text-[#10213c] sm:text-6xl">{t.title}</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">{t.intro}</p></header>
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-3xl border border-blue-200 bg-[#10213c] p-7 text-white shadow-xl shadow-blue-950/10 sm:p-10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Mail className="h-6 w-6" /></span><h2 className="mt-6 text-2xl font-black">{t.emailTitle}</h2><a dir="ltr" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="mt-3 block break-all text-lg font-bold text-blue-200 underline decoration-blue-400/50 underline-offset-4">{SUPPORT_EMAIL}</a><p className="mt-4 text-sm leading-7 text-blue-100">{t.emailDetail}</p><a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"><MessagesSquare className="h-4 w-4" />{t.emailCta}</a></section>
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><CircleHelp className="h-6 w-6" /></span><h2 className="mt-6 text-xl font-black text-[#10213c]">{t.topicsTitle}</h2><ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">{t.topics.map((topic) => <li key={topic} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" /><span>{topic}</span></li>)}</ul></section>
        </div>
        <section className="mt-6 flex gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8"><LockKeyhole className="mt-1 h-6 w-6 shrink-0 text-amber-700" /><div><h2 className="font-black text-amber-950">{t.privacyTitle}</h2><p className="mt-2 text-sm leading-7 text-amber-950/80">{t.privacy}</p></div></section>
        <section className="mt-10"><h2 className="text-center text-lg font-black text-[#10213c]">{t.quickTitle}</h2><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/login" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">{t.login}</Link><Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">{t.dashboard}</Link><Link href="/verify-idea" className="rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-bold text-white hover:bg-[#1647c9]">{t.explore}</Link></div></section>
      </main>
      <SiteFooter lang={language} />
    </div>
  );
}
