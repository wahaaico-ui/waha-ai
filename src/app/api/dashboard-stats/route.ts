import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const sessionClient = await createSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await serviceClient
      .from('users_usage')
      .select('id, idea_text, report_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const history = data || [];
    const total = history.length;
    const avg = total ? Math.round(history.reduce((sum, r) => sum + r.report_score, 0) / total) : 0;
    const best = total ? Math.max(...history.map((r) => r.report_score)) : 0;

    return NextResponse.json({
      success: true,
      stats: { total, avg, best },
      history,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'فشل جلب بيانات لوحة التحكم' }, { status: 500 });
  }
}
