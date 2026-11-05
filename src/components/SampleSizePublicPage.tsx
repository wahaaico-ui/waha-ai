'use client';

import Link from 'next/link';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import SampleSizeCalculator from './SampleSizeCalculator';
import { useUiTranslation } from '@/lib/use-ui-translation';

export default function SampleSizePublicPage() {
  const { language } = useUiTranslation(), ar = language === 'ar';
  return <div dir={ar ? 'rtl' : 'ltr'} lang={language}>
    <SiteHeader/>
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="mb-3 text-sm font-bold text-primary-dark">{ar ? 'أداة مجانية للجميع · دون تسجيل دخول' : 'Free for everyone · No sign-up'}</p>
      <h1 className="text-3xl font-extrabold leading-relaxed text-ink sm:text-4xl">{ar ? 'خطّط لحجم عينتك، وافهم سبب الرقم.' : 'Plan your sample size. Understand the number.'}</h1>
      <p className="mb-8 mt-4 max-w-3xl text-base leading-8 text-slate-600">{ar ? 'اختر نوع الدراسة، أدخل افتراضاتك، واحصل على حساب واضح ومخطط قابل للتنزيل ومسودة منهجية بالعربية أو الإنجليزية مع مراجعها.' : 'Choose your study type and assumptions. Get a transparent calculation, a downloadable diagram and a methodology draft in Arabic or English with references.'}</p>
      <SampleSizeCalculator language={language}/>
      <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6"><h2 className="text-xl font-bold leading-8">{ar ? 'من خطة العينة إلى مشروع بحثي مترابط' : 'From your sampling plan to a connected research project'}</h2><p className="my-3 text-sm leading-7 text-slate-600">{ar ? 'في الواحة يمكنك تنظيم المصادر والكتابة ومراجعاتك داخل مشروعك. تبقى هذه الحاسبة متاحة للجميع دون حساب.' : 'Organize sources, writing and reviews within a WAHA project. This calculator remains available to everyone without an account.'}</p><Link className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 font-bold text-white" href="/#start">{ar ? 'استكشف إمكانيات الواحة' : 'Explore WAHA capabilities'}</Link></section>
    </main>
    <SiteFooter lang={language}/>
  </div>;
}
