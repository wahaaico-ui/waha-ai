'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, BrainCircuit, ClipboardList, Eye, FileCheck2, Lightbulb, Search, Sparkles } from 'lucide-react';

type Language = 'ar' | 'en';

const stages = [
  { icon: Lightbulb, ar: 'الفكرة', en: 'Idea', tone: 'blue' },
  { icon: ClipboardList, ar: 'المشكلة', en: 'Problem', tone: 'blue' },
  { icon: BrainCircuit, ar: 'الأسئلة', en: 'Questions', tone: 'blue' },
  { icon: Search, ar: 'الأدلة', en: 'Evidence', tone: 'sky' },
  { icon: BookOpen, ar: 'المنهجية', en: 'Methodology', tone: 'amber' },
  { icon: FileCheck2, ar: 'بحث جاهز', en: 'Ready', tone: 'emerald' },
] as const;

const copy = {
  ar: { badge: 'الآن متاح للباحثين في الجامعات العربية', title: ['من الفكرة إلى النشر', 'بذكاء أكاديمي حقيقي'], description: 'الواحة ترافقك في كل خطوة من رحلتك البحثية — تحليل ذكي، أدلة موثقة، وبناء بحث متسق وفق معايير الجودة الأكاديمية.', start: 'ابدأ بحثك الآن', demo: 'شاهد كيف تعمل', journey: 'رحلة البحث مع الواحة', note: 'لا ندّعي قبول النشر أو كتابة البحث بدلاً عنك؛ ننظم قراراتك ونوضح أسبابها.' },
  en: { badge: 'Now available for Arab university researchers', title: ['From idea to publication', 'with real academic intelligence'], description: 'WAHA guides every step of your research journey with intelligent analysis, traceable evidence, and a coherent academic structure.', start: 'Start your research', demo: 'See how it works', journey: 'Research journey with WAHA', note: 'We do not promise publication or write research in your place; we organise decisions and explain them.' },
};

const toneClasses = { blue: 'border-blue-200 bg-blue-50 text-blue-600', sky: 'border-sky-200 bg-sky-50 text-sky-600', amber: 'border-amber-200 bg-amber-50 text-amber-600', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600' };

export default function Hero({ lang }: { lang: Language }) {
  const t = copy[lang];
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  return <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28">
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,.12),transparent_57%)]" />
    <div className="mx-auto max-w-5xl text-center"><p className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700"><Sparkles className="h-4 w-4" />{t.badge}</p><h1 className="mt-8 font-display text-5xl font-semibold leading-[1.1] tracking-tight text-[#10213c] sm:text-6xl lg:text-7xl"><span className="block">{t.title[0]}</span><span className="mt-1 block text-[#2563eb]">{t.title[1]}</span></h1><p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{t.description}</p><div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href="/verify-idea" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 sm:w-auto">{t.start}<Arrow className="h-4 w-4" /></Link><a href="#how-it-works" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 sm:w-auto"><Eye className="h-4 w-4 text-slate-400" />{t.demo}</a></div><p className="mx-auto mt-5 max-w-2xl text-xs leading-6 text-slate-400">{t.note}</p></div>
    <div className="mx-auto mt-14 max-w-6xl rounded-[2rem] border border-slate-200 bg-slate-50/80 p-5 shadow-sm sm:p-8"><p className="text-center text-xs font-bold tracking-[.16em] text-slate-400">{t.journey}</p><ol className="mt-7 grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-6 sm:gap-3">{stages.map((stage, index) => { const Icon = stage.icon; return <li key={stage.ar} className="relative text-center">{index > 0 && <span className="absolute end-[calc(50%+2.25rem)] top-6 hidden h-px w-8 bg-slate-200 sm:block" />}<span className={`mx-auto grid h-12 w-12 place-items-center rounded-xl border shadow-sm ${toneClasses[stage.tone]}`}><Icon className="h-5 w-5" /></span><span className="mt-3 block text-xs font-bold text-slate-700">{stage[lang]}</span></li>; })}</ol></div>
  </section>;
}
