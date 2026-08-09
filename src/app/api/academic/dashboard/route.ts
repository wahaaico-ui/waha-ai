import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير متوفرة' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // استعلام جلب أحدث مشروع بحثي نشط
    const { data: projects, error } = await supabase
      .from('research_projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const activeProject = projects && projects.length > 0 ? projects[0] : {
      project_title: "مشروع بحثي جديد (في انتظار الإعداد)",
      current_step: "IDEA_SUBMISSION",
      brain_status: "PENDING",
      clarity_score: 0
    };

    const dashboardData = {
      researcherName: "باحث أكاديمي معتمد",
      currentJourneyStep: activeProject.current_step,
      activeProject: activeProject.project_title,
      brainStatus: {
        status: activeProject.brain_status || "PENDING",
        clarityScore: activeProject.clarity_score || 0,
        lastCritique: "بانتظار تقييم المشرف الأكاديمي للفكرة الحالية."
      },
      evidenceStats: {
        totalPapersIndexed: 0,
        averageConfidence: 0,
        identifiedGapsCount: 0
      },
      recentMilestones: [
        { step: "IDEA_SUBMISSION", title: "إيداع الفكرة الخام", status: "COMPLETED" },
        { step: "BRAIN_EVALUATION", title: "تقييم المشرف الأكاديمي", status: activeProject.brain_status ? "COMPLETED" : "ACTIVE" }
      ]
    };

    return NextResponse.json({ success: true, dashboard: dashboardData });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في جلب بيانات قاعدة البيانات' }, { status: 500 });
  }
}
