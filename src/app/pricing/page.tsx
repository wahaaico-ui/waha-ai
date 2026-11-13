'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock3, Calculator } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { useWahaLanguage } from '@/lib/use-language';

type Plan = { id: string; name: string; price: string; period: string; description: string; features: string[]; cta: string; href: string; available: boolean };

const PLANS: Record<'ar' | 'en', Plan[]> = {
  ar: [
    { id: 'free', name: 'مجاني', price: '$0', period: '', description: 'ابدأ بمصادرك وكتابتك ومراجعاتك في مشروع مترابط.', available: true, features: ['البحث في المصادر وحفظ المراجع', 'مساحة كتابة مرتبطة بمقاطع المصادر', 'حفظ الكتابة والعودة إلى آخر عمل محفوظ', 'تنظيم ملاحظات المشرف ومتابعة معالجتها', 'تصدير المحتوى المحفوظ ومراجعه، وعليه عبارة «أُعد بمساعدة الواحة»'], cta: 'ابدأ الكتابة مجانًا', href: '/?task=writing#start' },
    { id: 'pro', name: 'Pro', price: '$20', period: '/شهريًا', description: 'باقة مخطط لها لتوسيع استخدام الباحث الفردي.', available: false, features: ['ملفات مصدّرة بلا عبارة الواحة', 'خيارات استخدام أوسع للمساعدة البحثية', 'خيارات إضافية لتنظيم العمل والتصدير', 'تفاصيل الاستخدام والدعم تُعلن عند الإتاحة'], cta: 'استفسر عن Pro', href: '/contact' },
    { id: 'expert', name: 'Expert', price: '$60', period: '/شهريًا', description: 'باقة مخطط لها لمن يتابع عدة أعمال بحثية.', available: false, features: ['ملفات مصدّرة بلا عبارة الواحة', 'خيارات أوسع لمتابعة عدة أبحاث', 'مراجعات وتقارير أكثر تفصيلًا', 'تفاصيل الاستخدام والدعم تُعلن عند الإتاحة'], cta: 'استفسر عن Expert', href: '/contact' },
    { id: 'institutional', name: 'مؤسسي', price: 'يُحدّد لاحقًا', period: '', description: 'نناقش احتياجات الجامعة أو المؤسسة قبل إعداد عرض مناسب.', available: false, features: ['لوحة المؤسسة وإدارة الفرق ضمن خطة التطوير', 'التكاملات المخصصة تخضع لدراسة الاحتياج', 'الخدمات المؤسسية غير مفعلة حاليًا'], cta: 'ناقش احتياج مؤسستك', href: '/contact' },
  ],
  en: [
    { id: 'free', name: 'Free', price: '$0', period: '', description: 'Bring your sources, writing, and reviews into one connected project.', available: true, features: ['Search academic sources and save references', 'Write with links to source passages', 'Save writing and resume your latest saved work', 'Organize supervisor feedback and track revisions', 'Export saved content and its references, marked “Prepared with WAHA”'], cta: 'Start writing for free', href: '/?task=writing#start' },
    { id: 'pro', name: 'Pro', price: '$20', period: '/month', description: 'A planned package for researchers who need more capacity.', available: false, features: ['Exported files without the WAHA mark', 'Broader research-assistance usage options', 'Additional organization and export options', 'Usage and support details will be announced at launch'], cta: 'Ask about Pro', href: '/contact' },
    { id: 'expert', name: 'Expert', price: '$60', period: '/month', description: 'A planned package for people managing several research projects.', available: false, features: ['Exported files without the WAHA mark', 'Broader options for managing several studies', 'More detailed reviews and reports', 'Usage and support details will be announced at launch'], cta: 'Ask about Expert', href: '/contact' },
    { id: 'institutional', name: 'Institutional', price: 'To be confirmed', period: '', description: 'Discuss your university or organization’s needs before a tailored proposal.', available: false, features: ['Institutional dashboards and team management are planned', 'Custom integrations require a needs assessment', 'Institutional services are not active yet'], cta: 'Discuss your organization’s needs', href: '/contact' },
  ],
};

const COPY = {
  ar: { eyebrow: 'مساحة لبحثك وخطط لنموّه', title: 'ابدأ مجانًا، واختر ما يناسب عملك', subtitle: 'المساحة المجانية متاحة الآن. باقات Pro وExpert والمؤسسات قيد الإعداد؛ التواصل بشأنها للاستفسار ولا ينشئ اشتراكًا.', available: 'متاح الآن', planned: 'قيد الإعداد', priceLabel: 'السعر المخطط', plannedNote: 'هذه مزايا مخطط لها. الاشتراك غير متاح حاليًا، وتُعلن التفاصيل النهائية عند الإتاحة.', freeNote: 'ابدأ دون بطاقة دفع. تتضح متطلبات كل أداة ومدخلاتها عند فتحها.', calculatorTitle: 'تحتاج إلى حساب حجم العينة فقط؟', calculatorDescription: 'حاسبة مجانية مع مبرر الحساب والمراجع ومخطط قابل للتنزيل، دون تسجيل دخول.', calculatorAction: 'افتح حاسبة حجم العينة', guideAction: 'تعرّف على طريقة استخدام الواحة', subscribe: 'اشترك الآن', subscribing: 'جارٍ فتح صفحة الدفع…', subscribeError: 'تعذر فتح صفحة الدفع الآن. أعد المحاولة بعد قليل.', markNote: 'عن العبارة: ملف PDF المجاني يُفتح ويُطبع وتُنسخ نصوصه، ويمنع التعديل في برامج القراءة المعتادة فتبقى العبارة. يستطيع برنامج متخصص إزالة هذا المنع، وملف Word قابل للتحرير بطبيعته، فلا نعد بحماية لا تُكسر.' },
  en: { eyebrow: 'Room for your research, plans for its growth', title: 'Start free and find what fits your work', subtitle: 'The free workspace is available now. Pro, Expert, and institutional packages are in development; contacting us about them is an inquiry, not a subscription.', available: 'Available now', planned: 'In development', priceLabel: 'Planned price', plannedNote: 'These features are planned. Subscriptions are not available yet; final details will be announced at launch.', freeNote: 'Start without a payment card. Each tool explains its input requirements when you open it.', calculatorTitle: 'Only need a sample size calculation?', calculatorDescription: 'Use the free calculator with a calculation rationale, references, and a downloadable diagram. No sign-up.', calculatorAction: 'Open the sample size calculator', guideAction: 'See how WAHA works', subscribe: 'Subscribe now', subscribing: 'Opening the payment page…', subscribeError: 'The payment page could not be opened. Try again shortly.', markNote: 'About the mark: a free PDF opens, prints and allows copying text, but refuses editing in standard readers, so the mark stays. Specialised software can remove this restriction, and a Word file is editable by nature, so we do not promise protection that cannot be broken.' },
};

export default function PricingPage() {
  const { language: lang } = useWahaLanguage();
  const t = COPY[lang];
  // Plans open for online subscription; empty until the owner adds Stripe keys and prices.
  const router = useRouter();
  const [purchasable, setPurchasable] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/billing/status', { cache: 'no-store' }).then(response => response.json()).then((data: { plans?: string[] }) => { if (active) setPurchasable(data.plans ?? []); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const plans = PLANS[lang].map(plan => (purchasable.includes(plan.id) ? { ...plan, available: true, cta: t.subscribe } : plan));
  async function subscribe(plan: string) {
    setBusy(plan); setError('');
    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) });
      if (response.status === 401) { router.push(`/login?redirect=${encodeURIComponent('/pricing')}`); return; }
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error();
      // The Stripe checkout page is on another site.
      window.location.assign(data.url);
    } catch { setError(t.subscribeError); setBusy(''); }
  }

  return <div className="min-h-screen bg-[#f8fafc] text-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <SiteHeader />
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-extrabold text-blue-600">{t.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black leading-relaxed tracking-tight text-[#10213c] sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{t.subtitle}</p>
        <p className="mt-4 text-sm leading-7 text-slate-600">{t.freeNote}</p>
      </header>
      <section className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => <article key={plan.id} aria-labelledby={`plan-${plan.id}-title`} className={`relative flex min-w-0 rounded-3xl bg-white p-6 shadow-sm ${plan.available ? 'border-2 border-blue-500 shadow-xl shadow-blue-950/10' : 'border border-slate-200'}`}>
          <div className="flex w-full flex-col">
            <p className={`mb-4 self-start rounded-full px-3 py-1 text-xs font-bold leading-6 ${plan.available ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{plan.available ? t.available : t.planned}</p>
            <h2 id={`plan-${plan.id}-title`} className="text-xl font-black leading-8 text-[#10213c]">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{plan.description}</p>
            <div className="mt-5 border-b border-slate-100 pb-5">{!plan.available && plan.id !== 'institutional' && <p className="mb-1 text-xs leading-6 text-slate-500">{t.priceLabel}</p>}<p className="break-words leading-relaxed"><span className="text-3xl font-black text-[#10213c]">{plan.price}</span><span className="text-sm text-slate-600">{plan.period}</span></p></div>
            <ul className="my-6 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm leading-7 text-slate-600">{plan.available ? <Check aria-hidden="true" className="mt-1.5 h-4 w-4 shrink-0 text-blue-600" /> : <Clock3 aria-hidden="true" className="mt-1.5 h-4 w-4 shrink-0 text-slate-400" />}<span className="min-w-0 break-words">{feature}</span></li>)}</ul>
            {!plan.available && <p id={`plan-${plan.id}-status`} className="mb-4 text-sm leading-7 text-slate-600">{t.plannedNote}</p>}
            {purchasable.includes(plan.id) ? <button type="button" disabled={Boolean(busy)} onClick={() => void subscribe(plan.id)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold leading-7 text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:opacity-60">{busy === plan.id ? t.subscribing : plan.cta}</button>
            : <Link href={plan.href} aria-describedby={plan.available ? undefined : `plan-${plan.id}-status`} className={`inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-bold leading-7 transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${plan.available ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700'}`}>{plan.cta}</Link>}
          </div>
        </article>)}
      </section>
      {error && <p role="alert" className="mx-auto mt-6 max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-800">{error}</p>}
      <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-7 text-slate-600">{t.markNote}</p>
      <aside className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-7">
        <Calculator aria-hidden="true" className="mb-3 h-6 w-6 text-blue-600" />
        <h2 className="text-lg font-bold leading-8 text-[#10213c]">{t.calculatorTitle}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{t.calculatorDescription}</p>
        <Link href="/tools/sample-size" className="mt-3 inline-flex min-h-11 items-center rounded-lg py-2 text-sm font-bold leading-7 text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">{t.calculatorAction}</Link>
      </aside>
      <p className="mt-7 text-center"><Link href="/guide" className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold leading-7 text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">{t.guideAction}</Link></p>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
