'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
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
    formTitle: 'سجّل بلاغاً قابلاً للمتابعة',
    formDetail: 'ستحصل فوراً على رقم متابعة وحالة البلاغ وموعد المراجعة الأولية خلال 72 ساعة.',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    category: 'نوع الطلب',
    subject: 'عنوان مختصر',
    message: 'اشرح ما حدث والخطوات التي سبقت المشكلة',
    submit: 'تسجيل البلاغ',
    submitting: 'جارٍ تسجيل البلاغ…',
    categories: { technical: 'مشكلة تقنية أو حساب', research: 'خلل في الرحلة البحثية', suggestion: 'اقتراح تحسين', partnership: 'شراكة أكاديمية', billing: 'استفسار مالي', other: 'موضوع آخر' },
    successTitle: 'تم استلام بلاغك',
    ticketNumber: 'رقم المتابعة',
    ticketStatus: 'الحالة: مستلم',
    reviewDue: 'المراجعة الأولية قبل',
    formError: 'تعذر تسجيل البلاغ. راجع الحقول أو استخدم البريد الرسمي مؤقتاً.',
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
    formTitle: 'Create a trackable support request',
    formDetail: 'You will immediately receive a reference number, status, and a first-review deadline within 72 hours.',
    name: 'Name',
    email: 'Email',
    category: 'Request type',
    subject: 'Short subject',
    message: 'Describe what happened and the steps before the issue',
    submit: 'Create request',
    submitting: 'Creating request…',
    categories: { technical: 'Technical or account issue', research: 'Research journey issue', suggestion: 'Product suggestion', partnership: 'Academic partnership', billing: 'Billing enquiry', other: 'Other' },
    successTitle: 'Your request was received',
    ticketNumber: 'Reference number',
    ticketStatus: 'Status: received',
    reviewDue: 'First review by',
    formError: 'The request could not be created. Review the fields or use the official email temporarily.',
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState<{ number: string; reviewDueAt: string } | null>(null);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, pageUrl: window.location.href }),
      });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== 'object' || !(data as { ticket?: unknown }).ticket) throw new Error('SUPPORT_REQUEST_FAILED');
      const received = (data as { ticket: { number?: unknown; reviewDueAt?: unknown } }).ticket;
      if (typeof received.number !== 'string' || typeof received.reviewDueAt !== 'string') throw new Error('SUPPORT_RESPONSE_INVALID');
      setTicket({ number: received.number, reviewDueAt: received.reviewDueAt });
      form.reset();
    } catch {
      setError(t.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f8fafc] text-slate-950">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <header className="mx-auto max-w-4xl text-center"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">{t.eyebrow}</span><h1 className="mt-6 font-display text-4xl font-semibold leading-tight text-[#10213c] sm:text-6xl">{t.title}</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">{t.intro}</p></header>
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-3xl border border-blue-200 bg-white p-7 shadow-xl shadow-blue-950/5 sm:p-10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><MessagesSquare className="h-6 w-6" /></span>
            <h2 className="mt-6 text-2xl font-black text-[#10213c]">{t.formTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{t.formDetail}</p>
            {ticket ? <div role="status" aria-live="polite" className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
              <h3 className="text-lg font-black">{t.successTitle}</h3>
              <p className="mt-3 text-sm">{t.ticketNumber}: <strong dir="ltr" className="inline-block">{ticket.number}</strong></p>
              <p className="mt-2 text-sm">{t.ticketStatus}</p>
              <p className="mt-2 text-sm">{t.reviewDue}: {new Date(ticket.reviewDueAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              <button type="button" onClick={() => setTicket(null)} className="mt-5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold">{language === 'ar' ? 'تسجيل بلاغ آخر' : 'Create another request'}</button>
            </div> : <form onSubmit={submitTicket} className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">{t.name}<input name="name" required minLength={2} maxLength={120} autoComplete="name" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">{t.email}<input name="email" type="email" required maxLength={320} autoComplete="email" dir="ltr" className="rounded-xl border border-slate-300 px-4 py-3 text-left outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">{t.category}<select name="category" required defaultValue="technical" className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{Object.entries(t.categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">{t.subject}<input name="subject" required minLength={5} maxLength={160} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">{t.message}<textarea name="message" required minLength={20} maxLength={4000} rows={6} className="resize-y rounded-xl border border-slate-300 px-4 py-3 leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
              {error && <p role="alert" className="text-sm font-bold text-red-700 sm:col-span-2">{error}</p>}
              <button disabled={submitting} className="rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-black text-white hover:bg-[#1647c9] disabled:cursor-wait disabled:opacity-60 sm:col-span-2">{submitting ? t.submitting : t.submit}</button>
            </form>}
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><CircleHelp className="h-6 w-6" /></span><h2 className="mt-6 text-xl font-black text-[#10213c]">{t.topicsTitle}</h2><ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">{t.topics.map((topic) => <li key={topic} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" /><span>{topic}</span></li>)}</ul></section>
        </div>
        <section className="mt-6 rounded-3xl border border-blue-200 bg-[#10213c] p-6 text-white sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><h2 className="font-black">{t.emailTitle}</h2><a dir="ltr" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="mt-2 block break-all text-blue-200 underline underline-offset-4">{SUPPORT_EMAIL}</a><p className="mt-2 text-sm leading-7 text-blue-100">{t.emailDetail}</p></div><a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-black text-white hover:bg-blue-500"><Mail className="h-4 w-4" />{t.emailCta}</a></div></section>
        <section className="mt-6 flex gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8"><LockKeyhole className="mt-1 h-6 w-6 shrink-0 text-amber-700" /><div><h2 className="font-black text-amber-950">{t.privacyTitle}</h2><p className="mt-2 text-sm leading-7 text-amber-950/80">{t.privacy}</p></div></section>
        <section className="mt-10"><h2 className="text-center text-lg font-black text-[#10213c]">{t.quickTitle}</h2><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/login" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">{t.login}</Link><Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">{t.dashboard}</Link><Link href="/verify-idea" className="rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-bold text-white hover:bg-[#1647c9]">{t.explore}</Link></div></section>
      </main>
      <SiteFooter lang={language} />
    </div>
  );
}
