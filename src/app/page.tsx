'use client';

import { useEffect, useState } from 'react';
import { BookOpenCheck, BrainCircuit, FilePenLine, Globe2, GraduationCap, Network, ShieldCheck, Sparkles } from 'lucide-react';
import Hero from './components/Hero';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const LANG_KEY = 'waha_lang';
const features = [
  { icon: BrainCircuit, ar: ['تحليل بحثي ذكي', 'تحويل فكرتك إلى قرارات بحثية منظمة.'], en: ['Intelligent research analysis', 'Turn an idea into structured research decisions.'] },
  { icon: Network, ar: ['خريطة معرفة مترابطة', 'اربط مفاهيمك بالدراسات والأسئلة ذات الصلة.'], en: ['Connected knowledge graph', 'Connect concepts, studies, and relevant questions.'] },
  { icon: FilePenLine, ar: ['بناء وثائق أكاديمية', 'أنشئ مخرجات كل مرحلة وفق بناء بحثي واضح.'], en: ['Academic document building', 'Create each stage output with a clear research structure.'] },
  { icon: BookOpenCheck, ar: ['إدارة المراجع', 'احتفظ بالمصادر المختارة وسياق استخدامها.'], en: ['Reference management', 'Keep selected sources and their research context.'] },
  { icon: GraduationCap, ar: ['وضع المشرف', 'رؤية منظمة لقرارات الباحث ومراحل مشروعه.'], en: ['Supervisor mode', 'A structured view of research decisions and progress.'] },
  { icon: Globe2, ar: ['عربي وإنجليزي', 'تجربة ثنائية اللغة تحترم لغة الباحث الأكاديمية.'], en: ['Arabic and English', 'A bilingual experience for academic researchers.'] },
];

export default function HomePage() {
  const [lang, setLang] = useState<'ar' | 'en'>(() => typeof window !== 'undefined' && localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar');
  useEffect(() => {
    const sync = (event: Event) => setLang((event as CustomEvent<'ar' | 'en'>).detail);
    window.addEventListener('waha-language-change', sync);
    return () => window.removeEventListener('waha-language-change', sync);
  }, []);
  const ar = lang === 'ar';
  const text = ar ? { features: 'كل ما تحتاجه في مكان واحد', sub: 'منصة متكاملة للباحث الجاد، لا مجموعة أدوات منفصلة.', how: 'كيف تعمل الواحة؟', howSub: 'مسار واضح من الفكرة إلى بحث متسق.', steps: ['حدّد هدفك', 'صِغ فكرتك', 'تحقق من الفجوة', 'ابنِ مشروعك'], cta: 'ابدأ رحلتك البحثية اليوم', ctaSub: 'ابدأ بفكرة؛ واحفظ رحلة بحثية مبنية على قراراتك.', button: 'ابدأ بحثك', trust: 'مصممة لحماية خصوصية الباحث وسلامة قراراته.' } : { features: 'Everything you need in one place', sub: 'A complete platform for serious researchers—not disconnected tools.', how: 'How does WAHA work?', howSub: 'A clear path from an idea to coherent research.', steps: ['Define your goal', 'Describe your idea', 'Verify the gap', 'Build your research'], cta: 'Start your research journey today', ctaSub: 'Begin with an idea and save a research journey built on your decisions.', button: 'Start your research', trust: 'Built to protect researcher privacy and decision integrity.' };
  return <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f8fafc] text-slate-900"><SiteHeader /><main className="mx-auto max-w-7xl px-4 sm:px-6"><Hero lang={lang} />
    <section id="features" className="border-t border-slate-200 py-20 sm:py-28"><div className="text-center"><h2 className="font-display text-4xl font-semibold text-[#10213c] sm:text-5xl">{text.features}</h2><p className="mt-4 text-lg text-slate-500">{text.sub}</p></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{features.map((feature) => { const Icon = feature.icon; const [title, detail] = feature[lang]; return <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-950/5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold text-[#10213c]">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{detail}</p></article>; })}</div></section>
    <section id="how-it-works" className="rounded-[2rem] bg-white px-5 py-16 ring-1 ring-slate-200 sm:px-10 sm:py-20"><div className="text-center"><h2 className="font-display text-4xl font-semibold text-[#10213c] sm:text-5xl">{text.how}</h2><p className="mt-4 text-lg text-slate-500">{text.howSub}</p></div><ol className="mt-12 grid gap-6 md:grid-cols-4">{text.steps.map((step, index) => <li key={step} className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-500/25">{index + 1}</span><h3 className="mt-4 font-bold text-[#10213c]">{step}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{ar ? 'تُفتح المرحلة التالية بعد حفظ المخرج السابق واعتماده.' : 'The next stage opens after the previous output is saved and approved.'}</p></li>)}</ol></section>
    <section className="my-20 rounded-[2rem] bg-[#2563eb] px-6 py-16 text-center text-white sm:my-28 sm:py-20"><h2 className="font-display text-4xl font-semibold sm:text-5xl">{text.cta}</h2><p className="mx-auto mt-4 max-w-2xl text-blue-100">{text.ctaSub}</p><a href="/verify-idea" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition hover:bg-blue-50"><Sparkles className="h-4 w-4" />{text.button}</a><p className="mt-7 flex justify-center gap-2 text-xs text-blue-100"><ShieldCheck className="h-4 w-4" />{text.trust}</p></section>
  </main><SiteFooter lang={lang} /></div>;
}
