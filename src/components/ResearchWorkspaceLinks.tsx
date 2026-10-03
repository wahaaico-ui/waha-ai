import Link from 'next/link';

export default function ResearchWorkspaceLinks({ projectId }: { projectId: string }) {
  if (!projectId) return null;
  const query = `?projectId=${encodeURIComponent(projectId)}`;
  return <nav aria-label="أدوات المشروع" dir="rtl" className="flex flex-wrap gap-3 text-sm">
    <Link href={`/research/sources${query}`} className="rounded-lg px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">البحث عن مصادر</Link>
    <Link href={`/research/language-tools${query}`} className="rounded-lg px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">مراجعة اللغة</Link>
  </nav>;
}
