'use client';

import Link from 'next/link';
import { BookOpenCheck, Layers3, MessageSquareText, UsersRound } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import styles from '@/components/PublicPage.module.css';
import { useWahaLanguage } from '@/lib/use-language';

const CONTENT = {
  ar: {
    eyebrow: 'من نحن',
    title: 'الواحة: مساحة تجمع عمل الباحث',
    intro: 'نساعد الباحث على جمع مراجعه، والعمل على نصه، ومتابعة ملاحظات المشرف في مشروع واحد. هدفنا أن تكون الخطوة التالية واضحة، وأن يبقى العمل الذي أنجزه محفوظًا وقابلًا للمراجعة.',
    story: 'كيف بدأت الفكرة؟',
    storyText: 'بدأت الواحة من فكرة محمد اللوح. يحتاج الباحث إلى مساحة تجمع أدواته وتفاصيل مشروعه وتساعده على تحويل الأفكار والمصادر إلى عمل يستطيع متابعته وتطويره. من هذا الاحتياج نبني تجربة تربط البحث والكتابة والمراجعة بالعربية والإنجليزية.',
    founderLabel: 'صاحب فكرة الواحة',
    approach: 'كيف نطوّر الواحة؟',
    approachText: 'نجمع بين تطوير البرمجيات، وتصميم تجربة المستخدم، ومتطلبات العمل البحثي. نراجع تسلسل المهام ونختبر مخرجاتها، لنقدّم أدوات تساعد الباحث في عمله اليومي.',
    team: 'رؤيتنا للفريق',
    teamText: 'يخطط مؤسس الواحة لتكوين فريق يجمع مطورين وخبراء في تجربة المستخدم والبحث العلمي، للعمل على تجربة تساعد الباحث من تنظيم مصادره إلى مراجعة مسودته.',
    principles: 'ما الذي يوجّه تجربتك؟',
    cards: [
      ['عمل مترابط', 'مراجعك، مسوداتك وتعديلاتك مرتبطة بمشروعك، لتتابع العمل من حيث توقفت.'],
      ['مصادر يمكن الرجوع إليها', 'احتفظ بالدراسات وروابطها الأصلية، واختر المستخلصات التي تحتاج إلى قراءتها ومقارنتها.'],
      ['مراجعة واضحة', 'اعمل على النص الأصلي والتعديل، ونظّم ملاحظات المشرف وردودك وحالة كل ملاحظة.'],
      ['قرارك في كل خطوة', 'راجع المصادر والمخرجات، وطبّق دليل جامعتك وملاحظات مشرفك قبل اعتماد العمل.'],
    ],
    cta: 'ابدأ بالمهمة التي تحتاجها اليوم',
    ctaText: 'ابحث عن مراجع، راجع نصًا، أو نظّم ملاحظات المشرف. يمكنك أيضًا استكشاف فكرة بحثية جديدة.',
    button: 'اختر مهمتك',
    capabilities: 'تعرّف على إمكانيات الواحة',
    contact: 'تواصل معنا',
  },
  en: {
    eyebrow: 'About WAHA',
    title: 'WAHA: a workspace for your research',
    intro: 'We help researchers bring their references, writing, and supervisor feedback into one project. Our goal is to make the next step clear and keep completed work saved and ready to review.',
    story: 'Where the idea began',
    storyText: 'WAHA began with an idea from Mohammed Y ALLouh: researchers need a workspace that brings their tools and project details together, helping them turn ideas and sources into work they can continue and improve. This need shapes our approach to research, writing, and review in Arabic and English.',
    founderLabel: 'The idea behind WAHA',
    approach: 'How we develop WAHA',
    approachText: 'Our approach brings together software development, user experience design, and the needs of research work. We review task sequences and test their outputs to build tools that support researchers in their daily work.',
    team: 'Our vision for the team',
    teamText: 'WAHA’s founder plans to build a team of developers and experts in user experience and research, working on a connected experience from organising sources to reviewing a draft.',
    principles: 'What guides your experience',
    cards: [
      ['Connected work', 'Keep references, drafts, and revisions linked to your project so you can pick up where you left off.'],
      ['Sources you can revisit', 'Save studies and their original links, then select the abstracts you need to read and compare.'],
      ['Clear revisions', 'Work with the original and revised text, and organise supervisor notes, responses, and the status of each comment.'],
      ['You decide at every step', 'Review sources and outputs, and apply your university guide and supervisor feedback before accepting your work.'],
    ],
    cta: 'Start with the task you need today',
    ctaText: 'Find references, review a passage, or organise supervisor feedback. You can also explore a new research idea.',
    button: 'Choose your task',
    capabilities: 'Explore WAHA capabilities',
    contact: 'Contact us',
  },
} as const;

const ICONS = [Layers3, BookOpenCheck, MessageSquareText, UsersRound];

export default function AboutPage() {
  const { language } = useWahaLanguage();
  const t = CONTENT[language];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`${styles.page} min-h-screen bg-bg text-ink`}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold text-primary-dark">{t.eyebrow}</p>
          <h1 className="mt-4 font-bold text-[#10213c]">{t.title}</h1>
          <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{t.intro}</p>
        </header>
        <section aria-labelledby="waha-story" className="mt-12 grid gap-8 rounded-3xl border border-line bg-white p-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:p-9">
          <div className="min-w-0">
            <h2 id="waha-story" className="text-2xl font-bold text-[#10213c]">{t.story}</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{t.storyText}</p>
          </div>
          <div className="min-w-0 self-center rounded-2xl bg-primary-tint p-6">
            <p className="text-sm text-primary-dark">{t.founderLabel}</p>
            <p dir={language === 'ar' ? 'rtl' : 'ltr'} className="mt-2 break-words text-xl font-bold text-[#10213c]">{language === 'ar' ? 'محمد اللوح' : 'Mohammed Y ALLouh'}</p>
          </div>
        </section>
        <section className="mt-9 max-w-3xl">
          <h2 className="text-2xl font-bold text-[#10213c]">{t.approach}</h2>
          <p className="mt-3 text-base leading-8 text-slate-600">{t.approachText}</p>
          <h3 className="mt-6 text-lg font-bold text-[#10213c]">{t.team}</h3>
          <p className="mt-3 text-base leading-8 text-slate-600">{t.teamText}</p>
        </section>
        <section aria-labelledby="waha-principles" className="mt-12">
          <h2 id="waha-principles" className="text-2xl font-bold text-[#10213c]">{t.principles}</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {t.cards.map(([title, body], index) => {
              const Icon = ICONS[index];
              return <article key={title} className="min-w-0 rounded-2xl border border-line bg-white p-6"><Icon aria-hidden="true" className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg font-bold text-[#10213c]">{title}</h3><p className="mt-3 text-base leading-8 text-slate-600">{body}</p></article>;
            })}
          </div>
        </section>
        <section className="mt-12 rounded-3xl bg-[#10213c] px-6 py-10 text-white sm:px-9">
          <h2 className="text-2xl font-bold">{t.cta}</h2>
          <p className="mt-3 max-w-2xl text-base leading-8 text-blue-100">{t.ctaText}</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/#start" className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary-dark">{t.button}</Link>
            <Link href="/#features" className="rounded-xl border border-white/30 px-5 py-3 text-sm font-bold hover:bg-white/10">{t.capabilities}</Link>
            <Link href="/contact" className="rounded-xl px-4 py-3 text-sm font-bold underline underline-offset-4">{t.contact}</Link>
          </div>
        </section>
      </main>
      <SiteFooter lang={language} />
    </div>
  );
}
