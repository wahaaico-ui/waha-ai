import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#090D16] text-white p-8 md:p-12" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
              لوحة التحكم الأكاديمية <span className="text-emerald-400 font-light text-xl">(WAHA Dashboard)</span>
            </h1>
            <p className="text-gray-400 text-sm">
              مرحباً بك في بيئة الأبحاث. إدارة مشاريعك، تحليل المشكلات، واستخراج الفجوات بكفاءة عالية.
            </p>
          </div>
          <Link
            href="/project/new"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10"
          >
            <span>+ إنشاء مشروع بحثي جديد</span>
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm">
            حدث خطأ أثناء جلب المشاريع: {error.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects && projects.length > 0 ? (
            projects.map((project: { id: string; title: string; created_at: string }) => (
              <div
                key={project.id}
                className="bg-[#111827] border border-gray-800 hover:border-emerald-500/50 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between group shadow-xl"
              >
                <div>
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    مشروع بحثي
                  </span>
                  <h3 className="text-lg font-semibold text-white mt-4 mb-2 group-hover:text-emerald-300 transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-xs text-gray-400">
                    تاريخ الإنشاء: {new Date(project.created_at).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-800/80 flex justify-between items-center">
                  <span className="text-xs text-gray-500">نشط</span>
                  <span className="text-emerald-400 text-sm font-medium group-hover:translate-x-[-4px] transition-transform inline-block">
                    عرض التفاصيل &larr;
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-16 bg-[#111827]/50 border border-dashed border-gray-800 rounded-2xl">
              <p className="text-gray-400 mb-4">لا توجد مشاريع بحثية مسجلة حتى الآن.</p>
              <Link
                href="/project/new"
                className="text-emerald-400 hover:text-emerald-300 font-medium text-sm underline underline-offset-4"
              >
                ابدأ بإنشاء مشروعك الأول الآن
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}