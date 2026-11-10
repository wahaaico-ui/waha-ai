import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { buildDashboardProjects, type DashboardProjectSource } from '@/lib/dashboard-resume';
import { readDashboardPages, readDashboardWork } from '@/lib/dashboard-resume-server';
import { researcherProfileFromMetadata, specialtyLabel } from '@/lib/researcher-profile';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401, headers: privateHeaders });

    const [history, projectSources] = await Promise.all([
      readDashboardPages<{ id: string; idea_text: string; report_score: number; created_at: string }>((from, to) => access.supabase
        .from('users_usage')
        .select('id, idea_text, report_score, created_at')
        .eq('user_id', access.user.id)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      readDashboardPages<DashboardProjectSource>((from, to) => access.supabase
        .from('projects')
        .select('id, title, status, created_at')
        .eq('user_id', access.user.id)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
    ]);

    const projectIds = projectSources.map((project) => project.id);
    const work = await readDashboardWork(access.supabase, projectIds);
    const projects = buildDashboardProjects(projectSources, work.documents, work.drafts);
    const total = history.length;
    const avg = total ? Math.round(history.reduce((sum, r) => sum + r.report_score, 0) / total) : 0;
    const best = history.reduce((score, row) => Math.max(score, row.report_score), 0);

    const researcher = researcherProfileFromMetadata(access.user.user_metadata);
    const displayName = researcher.fullName || access.user.email?.split('@')[0] || 'باحث';

    return NextResponse.json({
      success: true,
      stats: { total, avg, best },
      history,
      projects,
      latestProject: projects[0] || null,
      researcher: {
        displayName,
        specialty: specialtyLabel(researcher),
      },
    }, { headers: privateHeaders });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'فشل جلب بيانات لوحة التحكم' }, { status: 500, headers: privateHeaders });
  }
}
