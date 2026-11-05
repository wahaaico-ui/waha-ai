'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ResearchEvidenceSidebar from '@/components/ResearchEvidenceSidebar';
import { useProjectId } from '@/lib/use-project-id';

export default function ResearchSourcesPage() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const projectId = useProjectId();
  const query = `?projectId=${encodeURIComponent(projectId)}`;
  return <div dir={uiDirection} className="min-h-screen bg-slate-50 pb-20 text-slate-950">
    <SiteHeader />
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-black">{ui("البحث والمصادر")}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{ui("ابحث عن مصادر أكاديمية، وراجع بياناتها، ثم احفظ ما يناسب بحثك في مكتبة المشروع. اكتشاف المصدر لا يعني تأكيد ادعاءاته.")}</p>
      </header>
      {projectId ? <>
        <nav aria-label={ui("مساحات المشروع")} className="flex flex-wrap gap-3 text-sm">
          <Link href={`/research/library${query}`} className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-white px-4 py-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{ui("افتح مراجعك المحفوظة")}</Link>
          <Link href={`/research/tasks${query}&task=writing`} className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-white px-4 py-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{ui("اكتب بمراجعك")}</Link>
        </nav>
        <ResearchEvidenceSidebar key={projectId} projectId={projectId} />
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><p>{ui("بعد حفظ المراجع، افتح مكتبة المشروع لمراجعتها. يمكنك بعدها الكتابة بمقاطعها أو اختيارها لمقارنة الدراسات.")}</p><Link href={`/research/library${query}`} className="mt-2 inline-flex min-h-11 items-center font-bold text-blue-700 underline underline-offset-4">{ui("انتقل إلى مكتبة المشروع")}</Link></div>
      </> : <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-black text-amber-950">{ui("افتح البحث من مشروعك")}</h2>
        <p className="mt-2 text-sm leading-7 text-amber-900">{ui("اختر مشروعاً حتى ترتبط نتائج البحث والمصادر المحفوظة به.")}</p>
        <Link href="/dashboard" className="mt-4 inline-flex rounded-lg px-3 py-2 font-bold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">{ui("اختيار المشروع")}</Link>
      </section>}
    </main>
  </div>;
}
