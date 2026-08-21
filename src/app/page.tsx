"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import SmartWelcome from '@/components/SmartWelcome';

const LANG_KEY = 'waha_lang';

const UNIVERSITIES: { ar: string; en: string }[] = [
  { ar: 'جامعة الملك عبدالله', en: 'King Abdullah University' },
  { ar: 'جامعة الملك سعود', en: 'King Saud University' },
  { ar: 'جامعة القاهرة', en: 'Cairo University' },
  { ar: 'الجامعة الأمريكية', en: 'American University' },
  { ar: 'جامعة الشارقة', en: 'University of Sharjah' },
  { ar: 'جامعة الملك فهد للبترول والمعادن', en: 'King Fahd University' },
  { ar: 'الجامعة الأردنية', en: 'The University of Jordan' },
  { ar: 'جامعة قطر', en: 'Qatar University' },
  { ar: 'جامعة الإمارات', en: 'UAE University' },
  { ar: 'الجامعة اللبنانية', en: 'Lebanese University' },
];

const COPY = {
  ar: {
    badge: 'الآن متاح للجامعات السعودية والخليجية',
    h1a: 'من الفكرة إلى النشر',
    h1b: 'بذكاء أكاديمي حقيقي',
    subtitle: 'WAHA AI يرافقك في كل خطوة من رحلتك البحثية — تحليل ذكي، بناء وثائق، وإدارة مراجع بأعلى معايير الجودة الأكاديمية.',
    ctaVerify: 'افحص فكرتك أولاً · المرحلة صفر',
    cta1: 'ابدأ بحثك مباشرةً ←',
    cta2: 'شاهد العرض التوضيحي 👁',
    trusted: 'موثوق لدى أفضل الجامعات',
    howTitle: 'كيف يعمل WAHA AI',
    steps: [
      { n: '١', t: 'اكتب فكرتك البحثية' },
      { n: '٢', t: 'احصل على تحليل أكاديمي فوري' },
      { n: '٣', t: 'ابدأ كتابة بحثك بثقة' },
    ],
  },
  en: {
    badge: 'Now available for Saudi & Gulf universities',
    h1a: 'From idea to publication',
    h1b: 'with real academic intelligence',
    subtitle: 'WAHA AI walks with you through every step of your research journey — smart analysis, document building, and reference management at the highest academic quality standards.',
    ctaVerify: 'Verify your idea first · Phase 0',
    cta1: 'Skip to research →',
    cta2: 'Watch the demo 👁',
    trusted: 'Trusted by leading universities',
    howTitle: 'How WAHA AI works',
    steps: [
      { n: '1', t: 'Write your research idea' },
      { n: '2', t: 'Get an instant academic analysis' },
      { n: '3', t: 'Start writing your research with confidence' },
    ],
  },
};

export default function WahaLandingPage() {
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
    <div className="min-h-screen bg-[#0A0F1C] text-white font-sans selection:bg-emerald-500 selection:text-gray-950" dir={dir}>
      <style>{`
        @keyframes wahaBlobA { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-6%, 6%) scale(1.12); } }
        @keyframes wahaBlobB { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%, -4%) scale(1.08); } }
      `}</style>

      <SiteHeader />
      <SmartWelcome lang={lang} />

      <main className="relative max-w-4xl mx-auto px-6 pt-32 pb-24 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/5 blur-3xl"
            style={{ animation: 'wahaBlobA 14s ease-in-out infinite' }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-[560px] h-[560px] rounded-full bg-gradient-to-tr from-blue-500/15 to-emerald-500/5 blur-3xl"
            style={{ animation: 'wahaBlobB 18s ease-in-out infinite' }}
          />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-8">
          <span>✨</span>
          {t.badge}
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.15] mb-6">
          <span className="text-white">{t.h1a}</span>
          <br />
          <span className="bg-gradient-to-l from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            {t.h1b}
          </span>
        </h1>

        <p className="text-gray-400 text-lg font-light max-w-2xl mx-auto mb-10 leading-relaxed">
          {t.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/verify-idea"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-l from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/30 text-base ring-2 ring-emerald-400/40"
          >
            {t.ctaVerify}
          </Link>
          <Link
            href="/research"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-l from-blue-500 to-teal-400 hover:from-blue-400 hover:to-teal-300 text-gray-950 font-bold rounded-2xl transition-all shadow-xl shadow-teal-500/20 text-base"
          >
            {t.cta1}
          </Link>
          <a
            href="#demo"
            className="w-full sm:w-auto px-8 py-4 border border-white/15 hover:border-white/30 text-white font-bold rounded-2xl transition-all text-base"
          >
            {t.cta2}
          </a>
        </div>
      </main>

      <section id="universities" className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <p className="text-gray-500 text-xs font-semibold mb-6">{t.trusted}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {UNIVERSITIES.map((u) => (
            <span key={u.ar} className="text-gray-400 text-sm font-medium">
              {lang === 'ar' ? u.ar : u.en}
            </span>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-28">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-14">{t.howTitle}</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {t.steps.map((s) => (
            <div key={s.n} className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-black text-gray-950 text-sm">
                {s.n}
              </div>
              <p className="text-white text-sm font-bold leading-relaxed">{s.t}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
