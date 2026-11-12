'use client';

import Link from 'next/link';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { CareerView } from '@/components/CareerWorkspace';
import type { Career } from '@/lib/scholarly-career';
import type { ShareSection } from '@/lib/career-share';

/** A shared career as visitors see it; null when OpenAlex could not be reached. */
export default function SharedCareer({ career, sections }: { career: Career | null; sections: ShareSection[] }) {
  const { text: ui } = useUiTranslation();
  return <div className="min-h-screen bg-[#09090b] p-6 text-white md:p-12">
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-3xl font-bold">{ui('مسيرة بحثية')}</h1>
      <p className="mb-8 text-sm text-gray-400">{ui('شاركها صاحبها من واحة. البيانات من OpenAlex بمعرّف ORCID، ويمكن لصاحبها إلغاء الرابط في أي وقت.')}</p>
      {career
        ? <CareerView career={career} sections={sections} shared />
        : <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{ui('تعذر الوصول إلى بيانات OpenAlex الآن. أعد المحاولة بعد قليل.')}</p>}
      <Link href="/" className="mt-8 inline-block text-sm text-cyan-400 underline">{ui('تعرّف على واحة')}</Link>
    </div>
  </div>;
}
