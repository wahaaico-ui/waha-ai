'use client';

import Link from 'next/link';
import { ArrowUpRight, BookSearch, Calculator, FileText, Languages, Lightbulb, MessageSquareText, Search, PenLine } from 'lucide-react';
import { researchEntryTasks, type ResearchEntryTask } from '@/lib/research-entry-tasks';
import { useUiTranslation } from '@/lib/use-ui-translation';

const icons = { writing: PenLine, sources: Search, compare: BookSearch, language: Languages, supervisor: MessageSquareText, files: FileText };

export default function PublicCapabilities() {
  const { text: ui, language } = useUiTranslation();
  const ar = language === 'ar';
  return (
    <section id="features" aria-labelledby="capabilities-heading" className="scroll-mt-24 border-t border-line py-10 sm:py-14">
      <h2 id="capabilities-heading" className="text-2xl font-bold leading-relaxed text-ink sm:text-3xl">{ui('إمكانيات الواحة')}</h2>
      <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">{ui('اختر ما تحتاجه الآن. لكل مهمة مساحة عمل ومدخلات ونتيجة يمكنك مراجعتها وحفظها.')}</p>
      <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <article className="flex min-w-0 flex-col rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <Calculator aria-hidden="true" className="h-6 w-6 text-primary" />
          <h3 className="mt-4 text-lg font-bold leading-8">{ar ? 'حاسبة حجم العينة المجانية' : 'Free sample size calculator'}</h3>
          <p className="mb-5 mt-2 text-sm leading-7 text-slate-600">{ar ? 'خطّط للاستبيان أو اختبار الفرضية، ونزّل مخطط العينة ومسودة مبرر الحساب بمراجعها. دون تسجيل دخول.' : 'Plan a survey or hypothesis test. Download a sampling diagram and a calculation draft with references. No sign-up.'}</p>
          <Link href="/tools/sample-size" className="mt-auto inline-flex min-h-11 items-center gap-2 self-start rounded-lg py-2 text-sm font-bold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{ar ? 'احسب حجم عينتك' : 'Calculate your sample size'}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </article>
        {Object.entries(researchEntryTasks).map(([key, task]) => {
          const Icon = icons[key as ResearchEntryTask];
          return (
            <article key={key} className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-6">
              <Icon aria-hidden="true" className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-bold leading-8">{ui(task.label)}</h3>
              <p className="mb-5 mt-2 text-sm leading-7 text-slate-600">{ui(task.description)}</p>
              <a href={`/?task=${key}#start`} className="mt-auto inline-flex min-h-11 items-center gap-2 self-start rounded-lg py-2 text-sm font-bold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{ui(task.action)}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
            </article>
          );
        })}
        <article className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-6">
          <Lightbulb aria-hidden="true" className="h-6 w-6 text-primary" />
          <h3 className="mt-4 text-lg font-bold leading-8">{ui('استكشاف فكرة بحثية')}</h3>
          <p className="mb-5 mt-2 text-sm leading-7 text-slate-600">{ui('ابدأ من موضوعك واهتماماتك، ونظّم اتجاه البحث قبل الانتقال إلى مشروعك.')}</p>
          <Link href="/verify-idea" className="mt-auto inline-flex min-h-11 items-center gap-2 self-start rounded-lg py-2 text-sm font-bold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{ui('استكشف فكرتك')}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </article>
      </div>
    </section>
  );
}
