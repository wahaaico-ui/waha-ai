"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

const LANG_KEY = 'waha_lang';

const PLANS = {
  ar: [
    {
      name: 'مجاني',
      price: '0',
      period: '',
      description: 'للتجربة والاستكشاف',
      features: [
        '3 تحليلات مجانية',
        'تحليل أكاديمي أساسي',
        'عناوين بحثية مقترحة',
        'أبحاث ذات صلة',
      ],
      cta: 'ابدأ مجاناً',
      href: '/research',
      highlighted: false,
    },
    {
      name: 'باحث',
      price: '$9',
      period: '/شهرياً',
      description: 'للباحثين الجادّين',
      features: [
        'تحليلات غير محدودة',
        'كل مميزات الخطة المجانية',
        'حفظ سجل كامل للتحليلات',
        'تصدير التقارير PDF',
        'دعم ذو أولوية',
      ],
      cta: 'اشترك الآن',
      href: '/signup',
      highlighted: true,
    },
    {
      name: 'مؤسسي',
      price: 'تواصل معنا',
      period: '',
      description: 'للجامعات والمؤسسات البحثية',
      features: [
        'حسابات غير محدودة لطلابك',
        'لوحة تحكم إدارية',
        'تكامل مع أنظمة الجامعة',
        'دعم مخصص وتدريب',
      ],
      cta: 'تواصل معنا',
      href: 'mailto:sales@waha-ai.com',
      highlighted: false,
    },
  ],
  en: [
    {
      name: 'Free',
      price: '0',
      period: '',
      description: 'To try it out',
      features: [
        '3 free analyses',
        'Basic academic analysis',
        'Suggested research titles',
        'Related papers',
      ],
      cta: 'Start free',
      href: '/research',
      highlighted: false,
    },
    {
      name: 'Researcher',
      price: '$9',
      period: '/month',
      description: 'For serious researchers',
      features: [
        'Unlimited analyses',
        'Everything in Free',
        'Full analysis history',
        'PDF report export',
        'Priority support',
      ],
      cta: 'Subscribe now',
      href: '/signup',
      highlighted: true,
    },
    {
      name: 'Institutional',
      price: 'Contact us',
      period: '',
      description: 'For universities & research institutions',
      features: [
        'Unlimited accounts for students',
        'Admin dashboard',
        'University system integration',
        'Dedicated support & training',
      ],
      cta: 'Contact us',
      href: 'mailto:sales@waha-ai.com',
      highlighted: false,
    },
  ],
};

const COPY = {
  ar: { title: 'خطط الاشتراك', subtitle: 'اختر الخطة التي تناسب رحلتك البحثية' },
  en: { title: 'Pricing Plans', subtitle: 'Choose the plan that fits your research journey' },
};

export default function PricingPage() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'ar' || stored === 'en') setLang(stored);
  }, []);

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const t = COPY[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white font-sans pb-20" dir={dir}>
      <SiteHeader lang={lang} onToggleLang={toggleLang} />

      <main className="max-w-5xl mx-auto px-6 pt-16 text-center">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">{t.title}</h1>
        <p className="text-gray-400 text-lg mb-14">{t.subtitle}</p>

        <div className="grid md:grid-cols-3 gap-6 text-right" dir={dir}>
          {PLANS[lang].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 flex flex-col ${
                plan.highlighted
                  ? 'bg-white/[0.05] border-2 border-teal-400/60 shadow-2xl shadow-teal-500/10'
                  : 'bg-white/[0.03] border border-white/10'
              }`}
            >
              <h2 className="text-xl font-black text-white mb-1">{plan.name}</h2>
              <p className="text-gray-500 text-xs mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-3xl font-black text-white">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-teal-400 shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`text-center px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-l from-blue-500 to-teal-400 hover:from-blue-400 hover:to-teal-300 text-gray-950'
                    : 'border border-white/15 hover:border-white/30 text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
