'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { CircleHelp, Mail, MessagesSquare } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { useWahaLanguage } from '@/lib/use-language';
import styles from '@/components/PublicPage.module.css';
import { submitSupportTicket, SupportTicketError } from '@/lib/support-ticket-client';

const SUPPORT_EMAIL = 'support@waha.systems';

const CONTENT = {
  ar: {
    eyebrow: 'تواصل معنا',
    title: 'يسعدنا أن نسمع منك',
    intro: 'هل لديك سؤال عن الواحة، أو تحتاج مساعدة في مشروعك، أو ترغب في التعاون معنا؟ يسعدنا تواصلك.',
    emailTitle: 'البريد الرسمي',
    emailDetail: 'تواصل مع الواحة مباشرة للاستفسارات والتعاون الأكاديمي.',
    emailCta: 'إرسال رسالة',
    formTitle: 'كيف يمكننا مساعدتك؟',
    formDetail: 'شاركنا سؤالك أو طلبك. بعد استلام الرسالة سيظهر رقم مرجعي للاحتفاظ به عند المتابعة.',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    category: 'نوع الطلب',
    subject: 'عنوان مختصر',
    message: 'رسالتك',
    submit: 'إرسال الرسالة',
    submitting: 'جارٍ إرسال الرسالة…',
    categories: { technical: 'الحساب واستخدام الواحة', research: 'مساعدة في مشروع بحثي', suggestion: 'اقتراح تحسين', partnership: 'شراكة أكاديمية', billing: 'استفسار مالي', other: 'موضوع آخر' },
    successTitle: 'شكرًا لتواصلك معنا',
    ticketNumber: 'رقم طلبك',
    ticketStatus: 'وصلتنا رسالتك. احتفظ برقم طلبك عند التواصل معنا للمتابعة.',
    formError: 'لم يصلنا تأكيد استلام الرسالة. بقي نصك هنا؛ تواصل معنا بالبريد قبل إعادة الإرسال إذا لم تكن متأكدًا من وصولها.',
    rateLimited: 'وصلت عدة طلبات خلال فترة قصيرة. يرجى الانتظار قبل إرسال طلب آخر، أو التواصل معنا بالبريد.',
    rejected: 'راجع بيانات الرسالة ثم أعد إرسالها، أو تواصل معنا بالبريد.',
    privacyNote: 'نستخدم اسمك وبريدك ورسالتك لمتابعة طلبك. يكفي وصف مختصر دون مستندات سرية.',
    privacyLink: 'كيف نستخدم بياناتك؟',
    topicsTitle: 'ما الذي يمكنك مراسلتنا بشأنه؟',
    topics: ['مشكلة في تسجيل الدخول أو استعادة الحساب', 'المساعدة في استخدام أدوات البحث والكتابة', 'اقتراح لتحسين تجربة الباحث', 'تعاون مع جامعة أو جهة أكاديمية'],
    quickTitle: 'تابع رحلتك مع الواحة',
    login: 'تسجيل الدخول',
    dashboard: 'مشاريعي',
    explore: 'بدء استكشاف جديد',
  },
  en: {
    eyebrow: 'Contact',
    title: 'We would love to hear from you',
    intro: 'Have a question about WAHA, need help with your project, or want to work with us? We welcome your message.',
    emailTitle: 'Official email',
    emailDetail: 'Contact WAHA directly for enquiries and academic collaboration.',
    emailCta: 'Send an email',
    formTitle: 'How can we help?',
    formDetail: 'Tell us about your question or request. Once received, a reference number will appear for you to keep when following up.',
    name: 'Name',
    email: 'Email',
    category: 'Request type',
    subject: 'Short subject',
    message: 'Your message',
    submit: 'Send message',
    submitting: 'Sending your message…',
    categories: { technical: 'Account and using WAHA', research: 'Research project support', suggestion: 'Product suggestion', partnership: 'Academic partnership', billing: 'Billing enquiry', other: 'Other' },
    successTitle: 'Thank you for getting in touch',
    ticketNumber: 'Reference number',
    ticketStatus: 'We have received your message. Keep your reference number when contacting us to follow up.',
    formError: 'Receipt could not be confirmed. Your text is still here. If you are unsure it arrived, contact us by email before submitting again.',
    rateLimited: 'Several requests arrived within a short period. Please wait before submitting another request, or contact us by email.',
    rejected: 'Review your message details before submitting again, or contact us by email.',
    privacyNote: 'We use your name, email and message to follow up on your request. A short description is enough; leave out confidential documents.',
    privacyLink: 'How is your data used?',
    topicsTitle: 'What can you contact us about?',
    topics: ['Sign-in or account recovery issues', 'Help with using research and writing tools', 'A suggestion to improve the researcher experience', 'University or academic partnership enquiries'],
    quickTitle: 'Continue your journey with WAHA',
    login: 'Sign in',
    dashboard: 'My projects',
    explore: 'Start a new exploration',
  },
} as const;

export default function ContactPage() {
  const { text: ui } = useUiTranslation();

  const { language } = useWahaLanguage();
  const t = CONTENT[language];
  const subject = encodeURIComponent(language === 'ar' ? 'استفسار من منصة WAHA' : 'WAHA platform enquiry');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SupportTicketError['reason'] | ''>('');
  const [ticket, setTicket] = useState<{ number: string } | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setSubmitting(true);
    setError('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const number = await submitSupportTicket(values, window.location.href, controller.signal);
      if (controller.signal.aborted) return;
      setTicket({ number });
      form.reset();
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof SupportTicketError ? reason.reason : 'unconfirmed');
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`${styles.page} min-h-screen bg-[#f8fafc] text-slate-950`}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <header className="mx-auto max-w-4xl text-center"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">{t.eyebrow}</span><h1 className="mt-6 font-display text-4xl font-semibold leading-tight text-[#10213c] sm:text-6xl">{t.title}</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">{t.intro}</p></header>
        <div className={`${styles.contactColumns} mt-10`}>
          <section className="rounded-3xl border border-blue-200 bg-white p-7 shadow-xl shadow-blue-950/5 sm:p-10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><MessagesSquare className="h-6 w-6" /></span>
            <h2 className="mt-6 text-xl font-bold text-[#10213c] sm:text-2xl">{t.formTitle}</h2>
            <p className="mt-3 text-base leading-8 text-slate-600">{t.formDetail}</p>
            {ticket ? <div role="status" aria-live="polite" className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
              <h3 className="text-lg font-black">{t.successTitle}</h3>
              <p className="mt-3 text-sm">{t.ticketNumber}: <strong dir="ltr" className="inline-block">{ticket.number}</strong></p>
              <p className="mt-2 text-sm">{t.ticketStatus}</p>
              <button type="button" onClick={() => setTicket(null)} className="mt-5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold">{language === 'ar' ? 'إرسال رسالة أخرى' : 'Send another message'}</button>
            </div> : <form onSubmit={submitTicket} className={`${styles.form} mt-7`} aria-busy={submitting}>
              <label className="grid gap-2 text-sm font-bold text-slate-700">{t.name}<input name="name" readOnly={submitting} required minLength={2} maxLength={120} autoComplete="name" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">{t.email}<input name="email" type="email" readOnly={submitting} required maxLength={320} autoComplete="email" dir="ltr" className="rounded-xl border border-slate-300 px-4 py-3 text-left outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">{t.category}<select name="category" disabled={submitting} required defaultValue="technical" className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{Object.entries(t.categories).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">{t.subject}<input name="subject" readOnly={submitting} required minLength={5} maxLength={160} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">{t.message}<textarea dir="auto" name="message" readOnly={submitting} required minLength={20} maxLength={4000} rows={6} className="resize-y rounded-xl border border-slate-300 px-4 py-3 leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <input type="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
              <p className="text-sm leading-7 text-slate-600 sm:col-span-2">{t.privacyNote} <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-lg font-bold text-primary-dark underline underline-offset-4">{t.privacyLink}</Link></p>
              {error && <p role="alert" className="text-sm font-bold text-red-700 sm:col-span-2">{error === 'rate-limited' ? t.rateLimited : error === 'rejected' ? t.rejected : t.formError}</p>}
              <button type="submit" disabled={submitting} className="rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-black text-white hover:bg-[#1647c9] disabled:cursor-wait disabled:opacity-60 sm:col-span-2">{submitting ? t.submitting : t.submit}</button>
            </form>}
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><CircleHelp className="h-6 w-6" /></span><h2 className="mt-6 text-xl font-black text-[#10213c]">{t.topicsTitle}</h2><ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">{t.topics.map((topic) => <li key={topic} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" /><span>{topic}</span></li>)}</ul></section>
        </div>
        <section className="mt-6 rounded-3xl border border-blue-200 bg-[#10213c] p-6 text-white sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><h2 className="font-black">{t.emailTitle}</h2><a dir="ltr" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="mt-2 block break-all text-blue-200 underline underline-offset-4">{SUPPORT_EMAIL}</a><p className="mt-2 text-sm leading-7 text-blue-100">{t.emailDetail}</p></div><a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-black text-white hover:bg-blue-500"><Mail className="h-4 w-4" />{t.emailCta}</a></div></section>
        <section className="mt-10"><h2 className="text-center text-lg font-black text-[#10213c]">{t.quickTitle}</h2><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/login" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">{t.login}</Link><Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">{t.dashboard}</Link><Link href="/verify-idea" className="rounded-xl bg-[#1e5eff] px-5 py-3 text-sm font-bold text-white hover:bg-[#1647c9]">{t.explore}</Link></div></section>
      </main>
      <SiteFooter lang={language} />
    </div>
  );
}
