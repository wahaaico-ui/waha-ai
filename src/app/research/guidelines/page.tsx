'use client';

import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import UniversityPolicyEditor from '@/components/UniversityPolicyEditor';
import { useProjectId } from '@/lib/use-project-id';
import { useUiTranslation } from '@/lib/use-ui-translation';

export default function UniversityGuidelinesPage() {
  const projectId = useProjectId(); const { text: ui, direction } = useUiTranslation();
  return <div dir={direction} className="min-h-screen bg-slate-50 text-slate-900"><SiteHeader />
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-6">
      {projectId ? <><Link href={`/research/tasks?projectId=${encodeURIComponent(projectId)}&task=writing`} className="inline-block text-sm font-bold leading-7 text-blue-800 underline underline-offset-4">{ui('العودة إلى الكتابة بالدليل')}</Link><UniversityPolicyEditor key={projectId} projectId={projectId} /></>
        : <Link href="/dashboard" className="text-blue-800 underline">{ui('افتح مشروعًا لإضافة تعليمات الجامعة')}</Link>}
    </main>
  </div>;
}
