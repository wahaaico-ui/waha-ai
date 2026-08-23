import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function GET() {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { data: project, error } = await access.supabase.from('projects').select('title, status, created_at').eq('user_id', access.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) return NextResponse.json({ success: false, error: 'Unable to load dashboard' }, { status: 500 });
    return NextResponse.json({ success: true, dashboard: { researcherName: access.user.user_metadata?.full_name || access.user.email || 'باحث', currentJourneyStep: project?.status || 'IDEA_SUBMISSION', activeProject: project?.title || 'مشروع بحثي جديد', brainStatus: { status: project ? 'ACTIVE' : 'PENDING', clarityScore: 0, lastCritique: 'بانتظار تقييم الفكرة الحالية.' }, evidenceStats: { totalPapersIndexed: 0, averageConfidence: 0, identifiedGapsCount: 0 }, recentMilestones: [] } });
  } catch { return NextResponse.json({ success: false, error: 'Unable to load dashboard' }, { status: 500 }); }
}
