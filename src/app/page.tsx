'use client';

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

const PHASES = [
  {
    id: 1,
    ar: { title: 'الفكرة', sub: 'توليد الفكرة وتحديد الفجوة البحثية' },
    en: { title: 'Idea', sub: 'Generate idea & identify research gap' },
    icon: '💡',
  },
  {
    id: 2,
    ar: { title: 'المراجع', sub: 'مسح الأدبيات والأوراق تلقائياً' },
    en: { title: 'Literature', sub: 'Auto-scan papers & literature' },
    icon: '📚',
  },
  {
    id: 3,
    ar: { title: 'التحليل', sub: 'تحليل عميق بذكاء أكاديمي' },
    en: { title: 'Analysis', sub: 'Deep analysis with academic AI' },
    icon: '🔬',
  },
  {
    id: 4,
    ar: { title: 'النشر', sub: 'صياغة وتجهيز البحث للنشر' },
    en: { title: 'Publication', sub: 'Draft & prepare for publication' },
    icon: '🎓',
  },
];

const COPY = {
  ar: {
    badge: 'الآن متاح للجامعات السعودية والخليجية',
    h1a: 'من الفكرة إلى النشر',
    h1b: 'نرافقك، لا نستبدلك',
    subtitle: 'منظومة أكاديمية ذكية ترافق الباحث العربي في كل مرحلة من رحلته البحثية، بأمانة معرفية ومصادر حقيقية.',
    cta: 'ابدأ رحلتك البحثية',
    ctaSub: 'مجاناً · بلا بطاقة',
    trusted: 'موثوق لدى أفضل الجامعات',
    journeyTitle: 'رحلتك البحثية معنا',
    journeySub: 'أربع مراحل، منظومة واحدة',
  },
  en: {
    badge: 'Now available for Saudi and Gulf universities',
    h1a: 'From idea to publication',
    h1b: 'We accompany, not replace',
    subtitle: 'An intelligent academic ecosystem that accompanies the Arab researcher through every stage of their research journey, with academic integrity and real sources.',
    cta: 'Start your research journey',
    ctaSub: 'Free · No card required',
    trusted: 'Trusted by top universities',
    journeyTitle: 'Your research journey',
    journeySub: 'Four stages, one ecosystem',
  },
};

export default function HomePage() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
    if (stored === 'ar' || stored === 'en') setLang(stored);
  }, []);

  // Auto-rotate through phases every 2.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((prev) => (prev + 1) % PHASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const t = COPY[lang];
  const isRTL = lang === 'ar';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-b from-[#090D16] via-[#0B1220] to-[#0D1428] text-white">
      <SiteHeader />
      <SmartWelcome lang={lang} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 lg:pt-16 pb-16">
        {/* BADGE */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs sm:text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {t.badge}
          </div>
        </div>

        {/* MAIN HEADLINE */}
        <div className="text-center mb-10 sm:mb-14 lg:mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4 sm:mb-6">
            <span className="block text-white">{t.h1a}</span>
            <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              {t.h1b}
            </span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed px-2">
            {t.subtitle}
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 mb-16 sm:mb-20 lg:mb-24">
          <Link
            href="/verify-idea"
            className="group relative inline-flex items-center gap-3 px-8 sm:px-10 py-3.5 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-2xl transition-all shadow-2xl shadow-emerald-500/30 text-base sm:text-lg"
          >
            <span>{t.cta}</span>
            <span className="text-xl transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">{isRTL ? '←' : '→'}</span>
          </Link>
          <span className="text-xs sm:text-sm text-gray-500">{t.ctaSub}</span>
        </div>

        {/* JOURNEY VISUAL — 4 PHASES */}
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">
              {t.journeyTitle}
            </h2>
            <p className="text-sm sm:text-base text-gray-400">{t.journeySub}</p>
          </div>

          {/* PHASES CONTAINER */}
          <div className="relative bg-gradient-to-br from-slate-900/50 to-emerald-950/20 border border-emerald-500/15 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 backdrop-blur">
            {/* CONNECTING LINE — visible only on md+ */}
            <div className="hidden md:block absolute top-1/2 left-8 right-8 h-0.5 -translate-y-8">
              <div className="relative h-full bg-slate-700/50 rounded-full">
                <div
                  className="absolute top-0 h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                  style={{
                    width: `${((activePhase + 1) / PHASES.length) * 100}%`,
                    [isRTL ? 'right' : 'left']: 0,
                  }}
                ></div>
              </div>
            </div>

            {/* PHASES GRID — 1 col on mobile, 2 on tablet, 4 on desktop */}
            <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
              {PHASES.map((phase, idx) => {
                const isActive = idx === activePhase;
                const isPast = idx < activePhase;
                const l = lang === 'ar' ? phase.ar : phase.en;

                return (
                  <div
                    key={phase.id}
                    className={`relative flex flex-col items-center text-center p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-500 ${
                      isActive
                        ? 'bg-emerald-500/15 border-2 border-emerald-500/60 scale-105 shadow-lg shadow-emerald-500/20'
                        : isPast
                        ? 'bg-slate-800/40 border border-emerald-500/20'
                        : 'bg-slate-900/30 border border-slate-700/50'
                    }`}
                  >
                    {/* PULSE RING on active */}
                    {isActive && (
                      <span className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-xl sm:rounded-2xl border-2 border-emerald-400/50 animate-ping"></span>
                    )}

                    {/* ICON */}
                    <div
                      className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-2xl sm:text-3xl mb-3 transition-all ${
                        isActive
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40'
                          : isPast
                          ? 'bg-emerald-500/30'
                          : 'bg-slate-800'
                      }`}
                    >
                      {phase.icon}
                    </div>

                    {/* PHASE NUMBER */}
                    <div className={`text-xs font-mono mb-1 ${isActive ? 'text-emerald-300' : 'text-slate-500'}`}>
                      0{phase.id}
                    </div>

                    {/* TITLE */}
                    <h3
                      className={`text-sm sm:text-base font-bold mb-1 transition-colors ${
                        isActive ? 'text-white' : isPast ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {l.title}
                    </h3>

                    {/* SUBTITLE */}
                    <p
                      className={`text-xs sm:text-[13px] leading-relaxed transition-colors ${
                        isActive ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {l.sub}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* UNIVERSITIES */}
        <section className="mt-16 sm:mt-20 lg:mt-24 text-center">
          <p className="text-gray-500 text-xs sm:text-sm font-semibold mb-6 sm:mb-8">{t.trusted}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 lg:gap-x-10 gap-y-3 sm:gap-y-4">
            {UNIVERSITIES.map((u) => (
              <span key={u.ar} className="text-gray-500 text-xs sm:text-sm font-medium">
                {lang === 'ar' ? u.ar : u.en}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
