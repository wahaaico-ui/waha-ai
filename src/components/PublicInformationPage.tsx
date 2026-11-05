'use client';

import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import styles from '@/components/PublicPage.module.css';
import { PUBLIC_INFORMATION_REVIEWED, publicInformation, type PublicInformationKind } from '@/lib/public-information';
import { useWahaLanguage } from '@/lib/use-language';

export default function PublicInformationPage({ kind }: { kind: PublicInformationKind }) {
  const { language } = useWahaLanguage();
  const ar = language === 'ar';
  const content = publicInformation[kind][language];
  return (
    <div dir={ar ? 'rtl' : 'ltr'} className={`${styles.page} min-h-screen bg-[#f8fafc] text-slate-950`}>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="max-w-3xl">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-primary-dark underline underline-offset-4">{ar ? 'الرئيسية' : 'Home'}</Link>
          <h1 className="mt-4 font-bold text-[#10213c]">{content.title}</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">{content.intro}</p>
          <p className="mt-4 text-sm text-slate-500">{ar ? 'آخر مراجعة للمعلومات:' : 'Information last reviewed:'} <time dateTime={PUBLIC_INFORMATION_REVIEWED}>{PUBLIC_INFORMATION_REVIEWED}</time></p>
        </header>
        <nav aria-label={ar ? 'محتويات الصفحة' : 'On this page'} className="my-8 flex flex-wrap gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          {content.sections.map(section => <a key={section.id} href={`#${section.id}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-primary-dark underline underline-offset-4">{section.title}</a>)}
        </nav>
        <div className="space-y-5">
          {content.sections.map(section => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 id={`${section.id}-heading`} className="text-xl font-bold text-[#10213c]">{section.title}</h2>
              {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-4 text-base leading-8 text-slate-600">{paragraph}</p>)}
              {section.action && <Link href={section.action.href} className="mt-4 inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-primary-dark underline underline-offset-4">{section.action.label}</Link>}
            </section>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-4 border-t border-slate-200 pt-6">
          <Link href={kind === 'privacy' ? '/terms' : '/privacy'} className="inline-flex min-h-11 items-center text-sm font-bold text-primary-dark underline underline-offset-4">{kind === 'privacy' ? (ar ? 'إرشادات الاستخدام البحثي' : 'Research use guidelines') : (ar ? 'بياناتك في الواحة' : 'Your data in WAHA')}</Link>
          <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm font-bold text-primary-dark underline underline-offset-4">{ar ? 'الخدمات والأسعار' : 'Services and pricing'}</Link>
        </div>
      </main>
      <SiteFooter lang={language} />
    </div>
  );
}
