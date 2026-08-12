import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectReportsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) {
    notFound();
  }

  const { data: reports, error } = await supabase
    .from('project_analyses')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-4 py-6" dir="rtl">
      <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">تقارير التحليل السابقة</h1>
          <p className="text-sm text-gray-400">استعراض كافة تقارير تحليل الفجوات والنتائج المخزنة لمشروع: {project.title}</p>
        </div>
        <Link
          href={`/project/${projectId}/analysis`}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/10 text-sm"
        >
          + تحليل جديد
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
          تعذر جلب التقارير. يرجى التحقق من جدول البيانات.
        </div>
      )}

      <div className="space-y-6">
        {reports && reports.length > 0 ? (
          reports.map((report: any) => (
            <div key={report.id} className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  تقرير تحليل أكاديمي
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(report.created_at).toLocaleString('ar-SA')}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-emerald-400 mb-2">🎯 الفجوات المكتشفة:</h4>
                <ul className="space-y-2">
                  {report.gaps?.map((gap: string, idx: number) => (
                    <li key={idx} className="text-xs text-gray-300 bg-[#090D16] p-3 rounded-xl border border-gray-800">
                      {idx + 1}. {gap}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold text-emerald-400 mb-2">💡 التوصيات:</h4>
                <ul className="space-y-2">
                  {report.recommendations?.map((rec: string, idx: number) => (
                    <li key={idx} className="text-xs text-gray-300 bg-[#090D16] p-3 rounded-xl border border-gray-800">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {report.methodology_notes && (
                <div>
                  <h4 className="text-sm font-bold text-emerald-400 mb-2">⚙️ ملاحظات المنهجية:</h4>
                  <p className="text-xs text-gray-300 bg-[#090D16] p-3 rounded-xl border border-gray-800 leading-relaxed">
                    {report.methodology_notes}
                  </p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-16 bg-[#111827]/50 border border-dashed border-gray-800 rounded-2xl text-gray-400 text-sm">
            لا توجد تقارير تحليل محفوظة لهذا المشروع حتى الآن. ابدأ بتشغيل محرك تحليل الفجوات لإضافة تقارير جديدة.
          </div>
        )}
      </div>
    </main>
  );
}
