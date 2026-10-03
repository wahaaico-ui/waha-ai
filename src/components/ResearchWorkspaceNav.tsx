'use client';

import Link from 'next/link';
import { useProjectId } from '@/lib/use-project-id';

const destinations = [
  ['/research/problem', 'تصميم البحث'],
  ['/research/sources', 'البحث والمصادر'],
  ['/research/library', 'المكتبة والمراجع'],
  ['/research/intelligence', 'الأدلة والادعاءات'],
  ['/research/language-tools', 'مراجعة اللغة'],
  ['/research/publication', 'حزمة النشر والتصدير'],
] as const;

export default function ResearchWorkspaceNav() {
  const projectId = useProjectId();
  if (!projectId) return null;
  return <nav aria-label="مساحات البحث في المشروع" dir="rtl" className="border-b border-slate-200 bg-white print:hidden">
    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
      {destinations.map(([href, label]) => <Link key={href} href={`${href}?projectId=${encodeURIComponent(projectId)}`} className="min-w-0 rounded-lg px-3 py-2 text-center text-sm font-bold leading-6 text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{label}</Link>)}
    </div>
  </nav>;
}
