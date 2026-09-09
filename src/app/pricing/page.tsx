'use client';

import Link from 'next/link';
import { Check, Clock3, ShieldCheck } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { useWahaLanguage } from '@/lib/use-language';

type Plan = { name: string; price: string; period: string; description: string; features: string[]; cta: string; href?: string; available: boolean; highlighted?: boolean };

const PLANS: Record<'ar' | 'en', Plan[]> = {
  ar: [
    { name: 'مجاني', price: '$0', period: '', description: 'لبدء التجربة وفهم المسار البحثي', available: true, features: ['مشروع بحثي واحد نشط', '3 عمليات مساعدة ذكية شهرياً', 'استكشاف الفكرة والعنوان والمشكلة', 'حفظ المشروع والعودة إليه', 'البحث في المصادر الأكاديمية', 'تصدير محدود بعلامة WAHA'], cta: 'ابدأ مجاناً', href: '/verify-idea' },
    { name: 'Pro', price: '$20', period: '/شهرياً', description: 'للباحث الذي يريد إكمال رحلته باحتراف', available: false, highlighted: true, features: ['5 مشروعات نشطة', '150 عملية مساعدة ذكية شهرياً', 'الرحلة الكاملة من الفكرة إلى النشر', 'بناء الاستبانة أو المقابلة أو أداة الدراسة', 'تصدير PDF وWord دون علامة', 'Zotero وGoogle Forms', 'ترجمة وتدقيق أكاديمي', 'سجل النسخ والإرسال إلى البريد', 'دعم خلال 24–48 ساعة'], cta: 'قريباً — لن يتم تحصيل أي مبلغ' },
    { name: 'Expert', price: '$60', period: '/شهرياً', description: 'للمشرفين والاستشاريين ومكاتب البحث', available: false, features: ['20 مشروعاً نشطاً', '500 عملية مساعدة ذكية شهرياً', 'كل مزايا Pro', 'إدارة عدة أبحاث', 'تقارير اتساق وجودة موسعة', 'قوالب وتصدير موسع', 'أولوية في المعالجة', 'دعم خلال يوم عمل'], cta: 'قريباً — لن يتم تحصيل أي مبلغ' },
    { name: 'مؤسسي', price: 'حسب الاستخدام', period: '', description: 'للجامعات والمؤسسات البحثية', available: true, features: ['خطط تبدأ من 25 مستخدماً', 'لوحة تحكم إدارية', 'صلاحيات وإدارة فرق', 'تكامل مع أنظمة المؤسسة', 'تدريب ودعم مخصص', 'عرض سعر واضح حسب عدد المستخدمين'], cta: 'تواصل معنا', href: '/contact' },
  ],
  en: [
    { name: 'Free', price: '$0', period: '', description: 'Start exploring the research workflow', available: true, features: ['1 active research project', '3 AI assists per month', 'Idea, title, and problem exploration', 'Save and resume the project', 'Academic source discovery', 'Limited export with WAHA branding'], cta: 'Start free', href: '/verify-idea' },
    { name: 'Pro', price: '$20', period: '/month', description: 'For researchers completing a full journey', available: false, highlighted: true, features: ['5 active projects', '150 AI assists per month', 'Complete idea-to-publication journey', 'Questionnaire, interview, and instrument drafting', 'Unbranded PDF and Word export', 'Zotero and Google Forms', 'Academic translation and proofreading', 'Version history and email delivery', 'Support within 24–48 hours'], cta: 'Coming soon — no charge' },
    { name: 'Expert', price: '$60', period: '/month', description: 'For supervisors and research consultants', available: false, features: ['20 active projects', '500 AI assists per month', 'Everything in Pro', 'Multi-project management', 'Extended coherence and quality reports', 'Advanced templates and exports', 'Priority processing', 'Support within one business day'], cta: 'Coming soon — no charge' },
    { name: 'Institutional', price: 'Usage based', period: '', description: 'For universities and research institutions', available: true, features: ['Plans from 25 users', 'Administrative dashboard', 'Team roles and permissions', 'Institutional integrations', 'Dedicated training and support', 'Transparent quote by user count'], cta: 'Contact us', href: '/contact' },
  ],
};

const COPY = {
  ar: { eyebrow: 'أسعار واضحة بلا التزام', title: 'اختر المساحة المناسبة لبحثك', subtitle: 'الخطة المجانية متاحة الآن. الخطط المدفوعة معروضة للتعريف فقط ولن يتم تحصيل أي مبلغ حتى تفعيل الدفع رسمياً.', secure: 'لا توجد بوابة دفع مفعلة حالياً', annual: 'سيُتاح لاحقاً اشتراك سنوي مخفّض لـ Pro وExpert.' },
  en: { eyebrow: 'Clear pricing, no commitment', title: 'Choose the right space for your research', subtitle: 'The Free plan is available now. Paid plans are shown for information only, and no payment will be collected until billing is officially enabled.', secure: 'No payment gateway is currently active', annual: 'Discounted annual billing for Pro and Expert will be available later.' },
};

export default function PricingPage() {
  const { language: lang } = useWahaLanguage();
  const t = COPY[lang];

  return <div className="min-h-screen bg-[#f8fafc] pb-20 text-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <SiteHeader />
    <main className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 sm:pt-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-extrabold text-blue-600">{t.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[#10213c] sm:text-5xl">{t.title}</h1>
        <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{t.subtitle}</p>
        <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" />{t.secure}</p>
      </header>
      <section className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLANS[lang].map((plan) => <article key={plan.name} className={`relative flex rounded-3xl bg-white p-6 shadow-sm ${plan.highlighted ? 'border-2 border-blue-500 shadow-xl shadow-blue-950/10' : 'border border-slate-200'}`}>
          {plan.highlighted && <span className="absolute -top-3 start-5 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">{lang === 'ar' ? 'الأكثر ملاءمة للباحث' : 'Best for researchers'}</span>}
          <div className="flex w-full flex-col">
            <h2 className="text-xl font-black text-[#10213c]">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{plan.description}</p>
            <div className="mt-5 border-b border-slate-100 pb-5"><span className="text-3xl font-black text-[#10213c]">{plan.price}</span><span className="text-sm text-slate-500">{plan.period}</span></div>
            <ul className="my-6 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-600"><Check className="mt-1 h-4 w-4 shrink-0 text-blue-600" /><span>{feature}</span></li>)}</ul>
            {plan.available && plan.href ? <Link href={plan.href} className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700">{plan.cta}</Link> : <span aria-disabled="true" className="inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-500"><Clock3 className="h-4 w-4" />{plan.cta}</span>}
          </div>
        </article>)}
      </section>
      <p className="mt-8 text-center text-sm text-slate-500">{t.annual}</p>
    </main>
  </div>;
}
