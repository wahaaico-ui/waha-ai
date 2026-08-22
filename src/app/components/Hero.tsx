'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Lightbulb, Search, Sparkles, Telescope } from 'lucide-react';

type Language = 'ar' | 'en';

const JOURNEY = [
  { icon: Lightbulb, ar: { title: 'توليد الفكرة', detail: 'اكتشف الفجوة البحثية' }, en: { title: 'Idea generation', detail: 'Find the research gap' } },
  { icon: BookOpen, ar: { title: 'مراجعة الأدبيات', detail: 'امسح المراجع الحقيقية' }, en: { title: 'Literature review', detail: 'Scan real research' } },
  { icon: Telescope, ar: { title: 'التحليل العميق', detail: 'حلّل الأدلة بوضوح' }, en: { title: 'Deep analysis', detail: 'Analyse evidence clearly' } },
  { icon: Check, ar: { title: 'جاهز للنشر', detail: 'جهّز بحثك بثقة' }, en: { title: 'Ready to publish', detail: 'Prepare with confidence' } },
];

const COPY = {
  ar: { badge: 'رفيقك الأكاديمي من الفكرة إلى النشر', title: ['من الفكرة', 'إلى بحثٍ يستحق النشر'], description: 'منظومة بحثية ترافق تفكيرك في كل قرار، وتستند إلى مصادر حقيقية دون أن تكتب نيابةً عنك.', placeholder: 'ابدأ بفكرتك أو سؤال بحثك…', search: 'استكشف فكرتي', hint: 'جرّب: أثر الذكاء الاصطناعي على التعليم الجامعي', visualEyebrow: 'رحلة الباحث في الواحة', visualTitle: 'أربع محطات. سياق واحد.', visualDescription: 'كل مرحلة تبني على التي قبلها، لتصل إلى بحثٍ متسق لا مجرد نص مولّد.', live: 'قيد العمل الآن' },
  en: { badge: 'Your academic companion, from idea to publication', title: ['From an idea', 'to research worth publishing'], description: 'A research ecosystem that supports every decision with real sources, without writing in your place.', placeholder: 'Start with your idea or research question…', search: 'Explore my idea', hint: 'Try: AI’s impact on higher education', visualEyebrow: 'The WAHA research journey', visualTitle: 'Four stages. One context.', visualDescription: 'Each stage builds on the last, creating coherent research rather than generated text.', live: 'Active now' },
};

export default function Hero({ lang }: { lang: Language }) {
  const [activeStage, setActiveStage] = useState(0);
  const isRTL = lang === 'ar';
  const copy = COPY[lang];
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const timer = window.setInterval(() => setActiveStage((stage) => (stage + 1) % JOURNEY.length), 2800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden py-10 sm:py-16 lg:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute -top-36 start-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" /><div className="absolute bottom-0 end-0 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" /></div>
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:gap-16">
        <div className={isRTL ? 'lg:order-2' : ''}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{copy.badge}</div>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl xl:text-6xl"><span className="block">{copy.title[0]}</span><span className="mt-1 block bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">{copy.title[1]}</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{copy.description}</p>
          <form action="/verify-idea" className="mt-8 max-w-xl" role="search"><label className="sr-only" htmlFor="research-idea">{copy.placeholder}</label><div className="group flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 p-2 shadow-2xl shadow-black/20 transition focus-within:border-emerald-400/60 focus-within:ring-4 focus-within:ring-emerald-400/10"><Search className="ms-3 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /><input id="research-idea" name="idea" className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-white outline-none placeholder:text-slate-500" placeholder={copy.placeholder} /><button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 sm:px-5"><span className="hidden sm:inline">{copy.search}</span><Arrow className="h-4 w-4" aria-hidden="true" /></button></div><p className="mt-3 text-xs text-slate-500">{copy.hint}</p></form>
          <Link href="/verify-idea" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200">{copy.search} <Arrow className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className={`relative ${isRTL ? 'lg:order-1' : ''}`} aria-label={copy.visualTitle}>
          <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-emerald-400/15 via-transparent to-cyan-400/10 blur-xl" />
          <div className="relative rounded-[1.75rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7"><div className="mb-7 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">{copy.visualEyebrow}</p><h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">{copy.visualTitle}</h2></div><span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />{copy.live}</span></div>
            <div className="relative space-y-2"><div className="absolute bottom-8 top-8 start-6 w-px bg-slate-700 sm:start-7" aria-hidden="true"><div className="w-full bg-gradient-to-b from-emerald-300 to-teal-400 transition-all duration-700" style={{ height: `${((activeStage + 1) / JOURNEY.length) * 100}%` }} /></div>{JOURNEY.map((stage, index) => { const Icon = stage.icon; const active = index === activeStage; const complete = index < activeStage; const text = stage[lang]; return <button key={text.title} type="button" onClick={() => setActiveStage(index)} className={`relative flex w-full items-center gap-4 rounded-2xl p-3 text-start transition duration-300 sm:p-4 ${active ? 'bg-emerald-400/10 ring-1 ring-emerald-300/45 shadow-lg shadow-emerald-950/30' : 'hover:bg-white/[0.04]'}`} aria-pressed={active}><span className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border transition sm:h-14 sm:w-14 ${active ? 'border-emerald-200 bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/25' : complete ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>{active && <span className="absolute inset-0 rounded-full border border-emerald-200 animate-ping" aria-hidden="true" />}<Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className={`block text-sm font-bold sm:text-base ${active ? 'text-white' : 'text-slate-300'}`}>{text.title}</span><span className={`mt-0.5 block text-xs sm:text-sm ${active ? 'text-emerald-100/80' : 'text-slate-500'}`}>{text.detail}</span></span><span className={`font-mono text-xs ${active ? 'text-emerald-200' : 'text-slate-600'}`}>0{index + 1}</span></button>; })}</div>
            <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-slate-400">{copy.visualDescription}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
