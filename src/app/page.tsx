'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import TaskStart from '@/components/TaskStart';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import PublicCapabilities from '@/components/PublicCapabilities';
import Link from 'next/link';
import { BookOpen, Check, FileDown, FolderOpen, Languages } from 'lucide-react';

export default function HomePage() {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

  return <div dir={uiDirection} className="min-h-screen bg-bg text-ink"><SiteHeader /><main id="waha-home-main" className="mx-auto max-w-7xl px-4 sm:px-6">
    <section aria-labelledby="home-heading" className="grid items-start gap-5 py-6 sm:gap-6 sm:py-10 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-12 lg:py-14">
      <header className="lg:py-5">
        <p className="inline-flex items-center gap-2 text-xs font-bold text-primary-dark sm:text-sm"><BookOpen aria-hidden="true" className="h-4 w-4" />{ui("الواحة للبحث والكتابة الأكاديمية")}</p>
        <h1 id="home-heading" className="mt-4 max-w-xl text-[1.65rem] font-black leading-[1.35] tracking-tight text-ink sm:text-4xl lg:text-5xl">{ui("اكتب بحثك بدليل، وافهم دراساتك واستشهاداتك.")}</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">{ui("كتابة مرتبطة بمصادرك، ومعلومات دراسات قابلة للمراجعة، وتقييم مفسّر للاستشهادات؛ مع نصوصك ومراجعك وملاحظات المشرف في مشروع مترابط بالعربية والإنجليزية.")}</p>
        <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-700">
          {['اربط كل جملة بالمقطع الذي تستند إليه.', 'استخرج هدف الدراسة ومنهجها وعينتها ونتائجها من النص المتاح.', 'راجع علاقة الاستشهاد بكلامك قبل اعتمادها.'].map((label) => <li key={label} className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-primary" />{ui(label)}</li>)}
        </ul>
        <div className="mt-7 hidden flex-wrap items-center gap-3 sm:flex">
          <Link href="/#start" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{ui("اختر مهمة وابدأ")}</Link>
          <Link href="/verify-idea" className="rounded-xl px-1 py-2.5 text-sm font-bold text-primary-dark underline-offset-4 hover:underline">{ui("لدي فكرة وأريد استكشافها")}</Link>
        </div>
        <p className="mt-5 hidden flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 sm:flex">
          <span className="inline-flex items-center gap-1.5"><Languages aria-hidden="true" className="h-3.5 w-3.5" />{ui("واجهة عربية وإنجليزية")}</span>
          <span className="inline-flex items-center gap-1.5"><FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />{ui("حفظ واسترجاع العمل")}</span>
          <span className="inline-flex items-center gap-1.5"><FileDown aria-hidden="true" className="h-3.5 w-3.5" />{ui("توثيق وتصدير")}</span>
        </p>
      </header>
      <TaskStart />
    </section>
    <PublicCapabilities />
    <section id="how-it-works" aria-labelledby="workflow-heading" className="scroll-mt-24 border-t border-line py-8 sm:py-10">
      <h2 id="workflow-heading" className="text-xl font-black">{ui("من طلب واضح إلى عمل محفوظ")}</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {[['اختر مهمتك', 'مراجع، مقارنة دراسات، ترجمة وتدقيق، ملاحظات مشرف، أو قراءة PDF.'], ['راجع النتيجة', 'افتح المصادر، قارن النص بالأصل، وراجع ملاحظاتك قبل اعتماد العمل.'], ['احفظ وتابع', 'ارجع إلى مشروعك ومراجعاته، وصدّر المخرجات المحفوظة عندما تحتاجها.']].map(([title, description], index) => <li key={title} className="rounded-2xl border border-line bg-white p-5"><span aria-hidden="true" className="mb-3 grid h-7 w-7 place-items-center rounded-full bg-primary-tint text-xs font-bold text-primary-dark">{index + 1}</span><h3 className="text-sm font-bold">{ui(title)}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{ui(description)}</p></li>)}
      </ol>
      <p className="mt-5 text-sm leading-7 text-slate-600">{ui('مصادرك ونصوصك وتعديلاتك تبقى مرتبطة بمشروعك، لتتابع العمل من حيث توقفت.')}</p>
    </section>
  </main><SiteFooter lang={uiLanguage} /></div>;
}
