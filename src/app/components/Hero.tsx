'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, BrainCircuit, Eye, FileCheck2, Lightbulb, Search, ShieldCheck, Sparkles } from 'lucide-react';

type Language = 'ar' | 'en';

const stages = [
  { icon: Lightbulb, ar: 'الفكرة والفجوة', en: 'Idea & gap', detailAr: 'نفهم الفكرة ونختبر سياقها البحثي', detailEn: 'Understand the idea and its research context' },
  { icon: Search, ar: 'الأدلة والأدبيات', en: 'Evidence', detailAr: 'نجمع الأدلة ونربطها بقراراتك', detailEn: 'Gather evidence and connect it to decisions' },
  { icon: BrainCircuit, ar: 'البناء والتحليل', en: 'Build & analyse', detailAr: 'نبني عناصر البحث ونتحقق من اتساقها', detailEn: 'Build research elements and check coherence' },
  { icon: FileCheck2, ar: 'التحضير للتقديم', en: 'Submission preparation', detailAr: 'نراجع المخرجات ونجهزها للتقديم', detailEn: 'Review outputs and prepare them for submission' },
] as const;

const copy = {
  ar: { badge: 'نظام تشغيل للبحث الأكاديمي', title: ['من الفكرة الأولى', 'إلى خطة بحث ومسودة قابلة للمراجعة'], description: 'الواحة تنظّم رحلة الباحث مرحلةً بمرحلة: تستكشف الفكرة، تربطها بالأدلة، وتقدم مراجعة أولية لعلاقات المشكلة والأهداف والأسئلة والمنهجية.', start: 'ابدأ رحلتك البحثية', demo: 'شاهد مسار العمل', journey: 'رحلتك الأكاديمية في مسار واحد', note: 'بيانات مشروعك خاصة بك، وكل مرحلة تُبنى على مخرج محفوظ ومعتمد.', gate: 'لا انتقال عشوائي', evidence: 'قرارات مدعومة بالأدلة' },
  en: { badge: 'Academic Research Operating System', title: ['From the first idea', 'to a research plan and reviewable draft'], description: 'WAHA structures the research journey stage by stage: explore the idea, connect it to evidence, and offer preliminary checks across the problem, objectives, questions, and methodology.', start: 'Start your research journey', demo: 'See the workflow', journey: 'Your academic journey in one path', note: 'Your project data remains private, and every stage builds on an approved, saved output.', gate: 'No blind progression', evidence: 'Evidence-backed decisions' },
};

export default function Hero({ lang }: { lang: Language }) {
  const t = copy[lang];
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  return <section id="waha-home-hero" className="relative isolate overflow-hidden py-14 sm:py-20 lg:py-24">
    <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_8%,rgba(30,94,255,.12),transparent_32%),radial-gradient(circle_at_15%_70%,rgba(56,189,248,.08),transparent_30%)]" />
    <BookOpen className="waha-float pointer-events-none absolute -start-8 top-16 -z-10 h-32 w-32 text-blue-600/[0.035] sm:h-44 sm:w-44" strokeWidth={1} />
    <BookOpen className="waha-float pointer-events-none absolute -end-6 bottom-10 -z-10 h-36 w-36 text-blue-600/[0.04] [animation-delay:-3s] sm:h-52 sm:w-52" strokeWidth={1} />
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(460px,.92fr)] lg:gap-16">
      <div className="text-center lg:text-start">
        <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-2 text-xs font-bold text-[#1647c9]"><Sparkles className="h-4 w-4" />{t.badge}</p>
        <h1 className="mt-7 font-display text-5xl font-semibold leading-[1.12] tracking-tight text-[#111827] sm:text-6xl lg:text-[4.25rem]"><span className="block">{t.title[0]}</span><span className="mt-2 block text-[#1e5eff]">{t.title[1]}</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg lg:mx-0">{t.description}</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"><Link href="/verify-idea" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e5eff] px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_35px_rgba(30,94,255,.24)] transition hover:-translate-y-0.5 hover:bg-[#1647c9] sm:w-auto">{t.start}<Arrow className="h-4 w-4" /></Link><a href="#how-it-works" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 sm:w-auto"><Eye className="h-4 w-4 text-slate-400" />{t.demo}</a></div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 lg:justify-start"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#1e5eff]" />{t.gate}</span><span className="inline-flex items-center gap-1.5"><Search className="h-4 w-4 text-[#1e5eff]" />{t.evidence}</span></div>
      </div>
      <div className="relative mx-auto w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,.10)] backdrop-blur sm:p-7">
        <div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-bold tracking-[.12em] text-[#1e5eff]">WAHA</p><h2 className="mt-1 text-base font-extrabold text-slate-900">{t.journey}</h2></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,.12)]" /></div>
        <div className="relative grid gap-3 sm:grid-cols-2">
          <div className="pointer-events-none absolute inset-x-8 top-[calc(50%-1.25rem)] hidden h-20 sm:block"><svg viewBox="0 0 484 80" className="h-full w-full" fill="none" aria-hidden="true"><path d="M8 40C85 0 165 80 242 40C319 0 399 80 476 40" stroke="#D8E4FF" strokeWidth="2" strokeDasharray="5 7" /></svg><span className="waha-flow-dot absolute left-0 top-0 h-3 w-3 rounded-full bg-[#1e5eff] shadow-[0_0_0_6px_rgba(30,94,255,.12)]" /></div>
          {stages.map((stage, index) => { const Icon = stage.icon; return <article key={stage.ar} className="group relative z-10 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5"><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${index === 0 ? 'waha-pulse-ring bg-[#1e5eff] text-white' : 'bg-[#eef4ff] text-[#1e5eff]'}`}><Icon className="h-5 w-5" /></span><div><span className="text-[10px] font-bold text-slate-400">0{index + 1}</span><h3 className="mt-0.5 text-sm font-extrabold text-slate-900">{stage[lang]}</h3></div></div><p className="mt-3 text-xs leading-5 text-slate-500">{lang === 'ar' ? stage.detailAr : stage.detailEn}</p></article>; })}
        </div>
        <p className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] leading-5 text-slate-400">{t.note}</p>
      </div>
    </div>
  </section>;
}
