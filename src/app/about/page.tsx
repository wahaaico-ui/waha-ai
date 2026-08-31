'use client';

import Link from 'next/link';
import { BookOpenCheck, GitBranch, ShieldCheck, Sparkles } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { useWahaLanguage } from '@/lib/use-language';

const CONTENT = {
  ar: {
    eyebrow: 'من نحن',
    title: 'نبني رحلة بحثية مترابطة، لا مولّد نصوص منفصلة',
    intro: 'الواحة منظومة عربية للبحث الأكاديمي تساعد الباحث على تحويل ما يعرفه الآن إلى مشروع منظم: فكرة، ثم عنوان، ثم مشكلة وفجوة وأهداف وأسئلة ومنهجية وأدلة. كل مرحلة تحفظ مخرجها وتبني عليه المرحلة التالية.',
    principles: 'كيف نعمل؟',
    cards: [
      ['الترابط قبل التوليد', 'لا يكفي أن يبدو النص أكاديمياً؛ يجب أن يظل متسقاً مع قرارات المشروع السابقة وممهداً لما بعدها.'],
      ['الدليل قبل الادعاء', 'نعرض الأدلة المتاحة وحدود البحث، ولا نصف موضوعاً بأنه جديد أو غير مبحوث دون سند قابل للمراجعة.'],
      ['الباحث صاحب القرار', 'تقترح المنصة وتوضح وتفحص، بينما يبقى الاعتماد النهائي للباحث ومشرفه أو مؤسسته الأكاديمية.'],
      ['الخصوصية جزء من التصميم', 'تُقرأ المشاريع المحفوظة وتُعدّل من حساب مالكها، ولا نطلب نشر محتوى البحث ليعمل المسار.'],
    ],
    boundaries: 'ما الذي لا تدّعيه الواحة؟',
    boundariesText: 'لا تستبدل الإشراف الأكاديمي، ولا تضمن قبول بحث أو نشره، ولا تنفّذ التحليل الإحصائي نيابة عن الباحث. هدفها تنظيم القرار، كشف عدم الاتساق، وتسهيل الوصول إلى أدلة يمكن الرجوع إلى مصادرها الأصلية.',
    cta: 'اكتب ما تعرفه الآن، حتى لو لم تكن الصياغة مكتملة.',
    button: 'ابدأ الاستكشاف',
  },
  en: {
    eyebrow: 'About WAHA',
    title: 'A connected research journey, not a collection of isolated text generators',
    intro: 'WAHA is an Arabic-first academic research system that helps researchers turn what they know today into a structured project: idea, title, problem, gap, objectives, questions, methodology, and evidence. Each stage saves an output and feeds the next.',
    principles: 'How we work',
    cards: [
      ['Consistency before generation', 'Academic-sounding text is not enough; every output must remain aligned with previous project decisions and prepare the next stage.'],
      ['Evidence before claims', 'We show available evidence and search limits, and do not call a topic novel or unresearched without reviewable support.'],
      ['The researcher decides', 'The platform proposes, explains, and checks; final approval remains with the researcher and their supervisor or institution.'],
      ['Privacy by design', 'Saved projects are read and modified through their owner account, without requiring research content to be made public.'],
    ],
    boundaries: 'What WAHA does not claim',
    boundariesText: 'WAHA does not replace academic supervision, guarantee acceptance or publication, or perform statistical analysis on the researcher’s behalf. It structures decisions, detects inconsistency, and helps surface evidence that can be checked at the original source.',
    cta: 'Start with what you know, even if the phrasing is incomplete.',
    button: 'Start exploring',
  },
} as const;

const ICONS = [GitBranch, BookOpenCheck, Sparkles, ShieldCheck];

export default function AboutPage() {
  const { language } = useWahaLanguage();
  const t = CONTENT[language];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f8fafc] text-slate-950">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(37,99,235,.12),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,.08),transparent_30%)]" />
          <div className="relative mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 sm:py-28">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">{t.eyebrow}</span>
            <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-semibold leading-tight text-[#10213c] sm:text-6xl">{t.title}</h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{t.intro}</p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="text-center font-display text-3xl font-semibold text-[#10213c] sm:text-4xl">{t.principles}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {t.cards.map(([title, body], index) => {
              const Icon = ICONS[index];
              return <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Icon className="h-6 w-6" /></span><h3 className="mt-5 text-xl font-black text-[#10213c]">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{body}</p></article>;
            })}
          </div>
          <section className="mt-12 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-9"><h2 className="text-2xl font-black text-amber-950">{t.boundaries}</h2><p className="mt-4 max-w-4xl text-sm leading-8 text-amber-950/80">{t.boundariesText}</p></section>
          <section className="mt-12 rounded-3xl bg-[#10213c] px-6 py-12 text-center text-white sm:px-10"><h2 className="font-display text-3xl font-semibold">{t.cta}</h2><Link href="/verify-idea" className="mt-7 inline-flex rounded-xl bg-[#1e5eff] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-500">{t.button}</Link></section>
        </section>
      </main>
      <SiteFooter lang={language} />
    </div>
  );
}
