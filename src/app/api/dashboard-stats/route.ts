import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function GET() {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    const [usageResult, projectsResult] = await Promise.all([
      access.supabase
        .from('users_usage')
        .select('id, idea_text, report_score, created_at')
        .eq('user_id', access.user.id)
        .order('created_at', { ascending: false }),
      access.supabase
        .from('projects')
        .select('id, title, status, created_at')
        .eq('user_id', access.user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (usageResult.error || projectsResult.error) {
      console.error('Dashboard query failed', {
        usageError: usageResult.error?.message,
        projectsError: projectsResult.error?.message,
      });
      return NextResponse.json({ error: 'فشل جلب بيانات لوحة التحكم' }, { status: 500 });
    }

    const history = usageResult.data || [];
    const total = history.length;
    const avg = total ? Math.round(history.reduce((sum, r) => sum + r.report_score, 0) / total) : 0;
    const best = total ? Math.max(...history.map((r) => r.report_score)) : 0;

    const metadata = access.user.user_metadata || {};
    const displayName = typeof metadata.full_name === 'string' && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : typeof metadata.name === 'string' && metadata.name.trim()
        ? metadata.name.trim()
        : access.user.email?.split('@')[0] || 'باحث';

    return NextResponse.json({
      success: true,
      stats: { total, avg, best },
      history,
      projects: projectsResult.data || [],
      researcher: {
        displayName,
        specialty: typeof metadata.specialty === 'string' ? metadata.specialty : null,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'فشل جلب بيانات لوحة التحكم' }, { status: 500 });
  }
}
