'use client';

import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import styles from '@/components/PublicPage.module.css';
import { researchEntryTasks, type ResearchEntryTask } from '@/lib/research-entry-tasks';
import { useUiTranslation } from '@/lib/use-ui-translation';

const CONTENT = {
  ar: {
    title: 'ابدأ بما تحتاجه في بحثك اليوم',
    intro: 'يمكنك العمل على مهمة واحدة أو متابعة مشروع كامل. اختر المهمة، أضف موضوعك أو نصك، ثم راجع العمل واحفظه داخل مشروعك.',
    input: 'ماذا تضيف؟',
    output: 'ماذا تحصل عليه؟',
    steps: [
      ['اختر المهمة', 'ابدأ من الخدمة التي تحتاجها، ثم سجّل الدخول للاحتفاظ بعملك.'],
      ['اعمل داخل مشروعك', 'اختر مشروعًا موجودًا أو ابدأ مشروعًا جديدًا، وأضف المراجع والنصوص التي ستعمل عليها.'],
      ['راجع واحفظ وتابع', 'راجع المصادر والمخرجات، واحفظ عملك لتعود إليه أو تصدّره عندما تحتاجه.'],
    ],
    tasks: {
      writing: ['اكتب مسودتك وافتح مرجعًا أو ملفًا محفوظًا في مشروعك.', 'حدد جملة واربطها بمقطع المصدر. استخرج معلومات الدراسة، وراجع كل معلومة ومقطعها قبل إضافتها إلى المسودة. احفظ الكتابة، ثم قيّم علاقة الاستشهاد بالجملة وراجع التفسير قبل اعتماد الاقتراح. تحفظ الكتابة والمراجعات وتصدّرها مع مشروعك.'],
      sources: ['اكتب موضوع البحث أو السؤال الذي تبحث له عن مصادر.', 'افتح نتائج البحث، وراجع الروابط وبيانات الدراسات، ثم احفظ ما يناسب موضوعك في المكتبة.'],
      compare: ['حدد الموضوع، ثم اختر الدراسات المحفوظة التي تريد مقارنتها.', 'راجع مقارنة المستخلصات ومحاور الاتفاق والاختلاف مع إحالات إلى المصادر المختارة.'],
      language: ['الصق نصك، ثم اختر الترجمة أو التدقيق واللغة المطلوبة.', 'راجع النص الناتج بجانب الأصل، وتأكد من المصطلحات والأرقام والإحالات قبل حفظه أو تصديره.'],
      supervisor: ['أضف النص الأصلي وملاحظات المشرف.', 'عدّل نصك، واكتب ردك على كل ملاحظة، وحدد ما عالجته. احفظ المراجعة وصدّرها للمتابعة.'],
      files: ['ارفع ملف PDF نصيًا داخل مساحة الملفات.', 'اقرأ النص المستخرج وراجعه، واحتفظ به في مشروعك للعودة إليه.'],
    },
    ideaTitle: 'لديك فكرة ولم تبدأ مشروعًا؟',
    ideaText: 'ابدأ باستكشاف موضوعك وتنظيم اتجاه البحث، ثم انتقل إلى العمل على مشروعك.',
    ideaAction: 'استكشف فكرتك',
    continueTitle: 'هل بدأت العمل من قبل؟',
    continueText: 'افتح مشاريعك المحفوظة واختر المشروع الذي تريد متابعته.',
    continueAction: 'افتح مشاريعي',
    help: 'تحتاج إلى مساعدة؟ تواصل معنا',
  },
  en: {
    title: 'Start with what your research needs today',
    intro: 'Work on one task or continue a full project. Choose a task, add your topic or text, then review and save your work within your project.',
    input: 'What do you add?',
    output: 'What do you get?',
    steps: [
      ['Choose a task', 'Start with the service you need, then sign in to keep your work.'],
      ['Work within your project', 'Choose an existing project or start a new one, and add the references and text you want to work with.'],
      ['Review, save and continue', 'Review sources and outputs, then save your work to return to it or export it when needed.'],
    ],
    tasks: {
      writing: ['Write your draft and open a saved project reference or file.', 'Link a sentence to its source passage. Extract study information and review each item with its passage before adding it to the draft. Save your writing, then assess how a citation relates to its sentence and review the explanation before accepting a suggestion. Save and export the writing and reviews with your project.'],
      sources: ['Enter the topic or question you need sources for.', 'Open search results, check study details and original links, then save relevant sources to your library.'],
      compare: ['Specify your topic, then select the saved studies you want to compare.', 'Review a comparison of the abstracts, shared themes and differences, with references to your selected sources.'],
      language: ['Paste your text, then choose translation or proofreading and the language you need.', 'Review the output alongside the original. Check terminology, numbers and citations before saving or exporting.'],
      supervisor: ['Add the original text and your supervisor’s comments.', 'Revise your text, respond to each comment and mark what you have addressed. Save and export the review for follow-up.'],
      files: ['Upload a text-based PDF within the file workspace.', 'Read and review the extracted text, and keep it in your project to return to later.'],
    },
    ideaTitle: 'Have an idea but no project yet?',
    ideaText: 'Explore your topic and organise your research direction, then move on to your project.',
    ideaAction: 'Explore your idea',
    continueTitle: 'Already started?',
    continueText: 'Open your saved projects and choose the one you want to continue.',
    continueAction: 'Open my projects',
    help: 'Need help? Contact us',
  },
} as const;

export default function GuidePage() {
  const { language, direction, text: ui } = useUiTranslation();
  const t = CONTENT[language];
  return (
    <div dir={direction} className={`${styles.page} min-h-screen bg-bg text-ink`}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <BookOpen aria-hidden="true" className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-5 font-bold text-[#10213c]">{t.title}</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">{t.intro}</p>
        </header>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {t.steps.map(([title, detail], index) => (
            <li key={title} className="min-w-0 rounded-2xl border border-line bg-white p-6">
              <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-primary-tint font-bold text-primary-dark">{index + 1}</span>
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-base leading-8 text-slate-600">{detail}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {Object.entries(researchEntryTasks).map(([key, task]) => {
            const [input, output] = t.tasks[key as ResearchEntryTask];
            return (
              <section key={key} className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-6 sm:p-8">
                <h2 className="text-xl font-bold text-[#10213c]">{ui(task.label)}</h2>
                <dl className="mb-6 mt-5 space-y-4 text-base leading-8">
                  <div><dt className="font-bold">{t.input}</dt><dd className="mt-1 text-slate-600">{input}</dd></div>
                  <div><dt className="font-bold">{t.output}</dt><dd className="mt-1 text-slate-600">{output}</dd></div>
                </dl>
                <a href={`/?task=${key}#start`} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{ui(task.action)}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
              </section>
            );
          })}
          <section className="min-w-0 rounded-2xl bg-[#10213c] p-6 text-white sm:p-8">
            <h2 className="text-xl font-bold">{t.ideaTitle}</h2>
            <p className="mt-4 text-base leading-8 text-blue-100">{t.ideaText}</p>
            <Link href="/verify-idea" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 py-3 text-sm font-bold hover:bg-primary-dark">{t.ideaAction}</Link>
          </section>
        </div>
        <section className="mt-10 rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-[#10213c]">{t.continueTitle}</h2>
          <p className="mt-3 text-base leading-8 text-slate-600">{t.continueText}</p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link href="/dashboard" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-dark">{t.continueAction}</Link>
            <Link href="/contact" className="rounded-xl px-4 py-3 text-sm font-bold text-primary-dark underline underline-offset-4">{t.help}</Link>
          </div>
        </section>
      </main>
      <SiteFooter lang={language} />
    </div>
  );
}
