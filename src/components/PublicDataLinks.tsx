import Link from 'next/link';

/** Informational links, not a fabricated consent record or a new legal agreement. */
export default function PublicDataLinks({ language }: { language: 'ar' | 'en' }) {
  const ar = language === 'ar';
  return <nav aria-label={ar ? 'البيانات والاستخدام' : 'Data and use'} className="mt-5 flex flex-wrap justify-center gap-x-5 text-sm leading-7 text-slate-600">
    <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-lg text-primary-dark underline underline-offset-4">{ar ? 'بياناتك وخصوصيتك' : 'Your data and privacy'}</Link>
    <Link href="/terms" className="inline-flex min-h-11 items-center rounded-lg text-primary-dark underline underline-offset-4">{ar ? 'إرشادات الاستخدام البحثي' : 'Research use guidelines'}</Link>
  </nav>;
}
