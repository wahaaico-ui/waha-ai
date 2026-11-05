'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjectId } from '@/lib/use-project-id';

const destinations = [
  ['/research/tasks', 'مساحة العمل'],
  ['/research/problem', 'مشكلة البحث'],
  ['/research/sources', 'البحث والمصادر'],
  ['/research/library', 'المكتبة والمراجع'],
  ['/research/intelligence', 'الأدلة والادعاءات'],
  ['/research/language-tools', 'مراجعة اللغة'],
  ['/research/guidelines', 'تعليمات الجامعة'],
  ['/research/publication', 'حزمة النشر والتصدير'],
] as const;

export default function ResearchWorkspaceNav() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const projectId = useProjectId();
  const pathname = usePathname();
  if (!projectId) return null;
  return <nav aria-label={ui("مساحات البحث في المشروع")} dir={uiDirection} className="border-b border-slate-200 bg-white print:hidden">
    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4 sm:px-6 xl:grid-cols-8">
      {destinations.map(([href, label]) => <Link key={href} href={`${href}?projectId=${encodeURIComponent(projectId)}`} aria-current={pathname === href ? 'page' : undefined} className="flex min-h-11 min-w-0 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-bold leading-5 text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-[current=page]:bg-blue-600 aria-[current=page]:text-white">{ui(label)}</Link>)}
    </div>
  </nav>;
}
