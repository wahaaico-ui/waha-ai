'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import CareerWorkspace from '@/components/CareerWorkspace';
import { useUiTranslation } from '@/lib/use-ui-translation';

/** The researcher's career page, reached from the account page (DOC-30-01..03). */
export default function CareerPage() {
  const { text: ui } = useUiTranslation();
  return <div className="min-h-screen bg-[#09090b] p-6 text-white md:p-12">
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/profile" className="mb-8 inline-flex items-center gap-2 text-gray-400 transition hover:text-cyan-400"><ArrowRight className="h-4 w-4" /> {ui('العودة إلى الحساب')}</Link>
      <h1 className="mb-2 text-3xl font-bold">{ui('مسيرتي البحثية')}</h1>
      <p className="mb-8 text-gray-400">{ui('أعمالك المنشورة، ومن يستشهد بها، وموضوعات قد تكون خطوتك التالية، من بيانات OpenAlex.')}</p>
      <CareerWorkspace />
    </div>
  </div>;
}
