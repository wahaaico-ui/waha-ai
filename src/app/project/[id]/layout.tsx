import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  return (
    <div className="min-h-screen bg-[#090D16] text-white" dir="rtl">
      {/* شريط التنقل الفرعي الخاص بالمشروع */}
      <nav className="border-b border-gray-800 bg-[#111827]/50 backdrop-blur sticky top-0 z-50 px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs text-gray-400 hover:text-white transition-colors bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-800"
            >
              &larr; لوحة التحكم الرئيسية
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-sm font-bold text-emerald-400">إدارة المشروع الأكاديمي</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <Link
              href={`/project/${projectId}`}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-emerald-400 bg-gray-800/40 hover:bg-emerald-500/10 rounded-lg transition-all border border-gray-800"
            >
              نظرة عامة
            </Link>
            <Link
              href={`/project/${projectId}/analysis`}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-emerald-400 bg-gray-800/40 hover:bg-emerald-500/10 rounded-lg transition-all border border-gray-800"
            >
              تحليل الفجوات
            </Link>
            <Link
              href={`/project/${projectId}/reports`}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-emerald-400 bg-gray-800/40 hover:bg-emerald-500/10 rounded-lg transition-all border border-gray-800"
            >
              التقارير
            </Link>
            <Link
              href={`/project/${projectId}/settings`}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-emerald-400 bg-gray-800/40 hover:bg-emerald-500/10 rounded-lg transition-all border border-gray-800"
            >
              الإعدادات
            </Link>
          </div>
        </div>
      </nav>

      {/* محتوى الصفحات الفرعية */}
      <div className="py-6">
        {children}
      </div>
    </div>
  );
}
