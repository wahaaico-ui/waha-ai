import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#090D16] text-white p-8 md:p-12" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            &larr; العودة إلى لوحة التحكم
          </Link>
          <Link
            href={`/project/${id}/analysis`}
            className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            عرض نتائج التحليل والفجوات &rarr;
          </Link>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              تفاصيل المشروع البحثي
            </span>
            <h1 className="text-3xl font-bold text-white mt-3 mb-2">{project.title}</h1>
            <p className="text-xs text-gray-400">
              تاريخ الإنشاء: {new Date(project.created_at).toLocaleDateString('ar-SA')}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-200">إدارة العمليات والبيانات</h3>
            <div className="bg-[#090D16] border border-gray-800/80 rounded-xl p-6 text-gray-300 text-sm leading-relaxed">
              <p className="text-gray-400">
                المشروع الآن مرتبط بقاعدة البيانات ومجهز بالكامل. انقر على زر &quot;عرض نتائج التحليل والفجوات&quot; في الأعلى للانتقال الفوري لتقرير النتائج الحي.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}