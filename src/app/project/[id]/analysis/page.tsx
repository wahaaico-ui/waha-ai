import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectAnalysisPage({ params }: PageProps) {
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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <Link
            href={`/project/${id}`}
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
          >
            &larr; العودة إلى تفاصيل المشروع
          </Link>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
            نتائج التحليل الذكي للبروتوتايب
          </span>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">تقرير تحليل الفجوات البحثية</h1>
            <p className="text-gray-400 text-sm">المشروع النشط: <span className="text-white font-medium">{project.title}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="bg-[#090D16] border border-gray-800 p-6 rounded-2xl space-y-3">
              <h3 className="text-emerald-400 font-bold text-base">🔍 الفجوة المكتشفة</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                قصور في تكامل خوارزميات الذكاء الاصطناعي لمعالجة البيانات الأكاديمية الضخمة في الوقت الفعلي ضمن بيئة العمل المشتركة.
              </p>
            </div>

            <div className="bg-[#090D16] border border-gray-800 p-6 rounded-2xl space-y-3">
              <h3 className="text-teal-400 font-bold text-base">💡 التوصيات الاستراتيجية</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                تطوير إطار عمل هجين يربط مدخلات قواعد البيانات بمحركات الاستدلال لتقليل زمن استخراج النتائج بنسبة تتجاوز 45%.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 flex justify-between items-center">
            <span className="text-xs text-gray-500">حالة النظام: متصل ومستقر</span>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
            >
              العودة للوحة التحكم الرئيسية
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}