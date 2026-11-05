'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';

export default function ResearchWorkspaceLinks({ projectId }: { projectId: string }) {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  if (!projectId) return null;
  const query = `?projectId=${encodeURIComponent(projectId)}`;
  return <nav aria-label={ui("أدوات المشروع")} dir={uiDirection} className="flex flex-wrap gap-3 text-sm">
    <Link href={`/research/tasks${query}&task=writing`} className="rounded-lg px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{ui('الكتابة بالدليل')}</Link>
    <Link href={`/research/sources${query}`} className="rounded-lg px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{ui("البحث عن مصادر")}</Link>
    <Link href={`/research/language-tools${query}`} className="rounded-lg px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{ui("مراجعة اللغة")}</Link>
  </nav>;
}
