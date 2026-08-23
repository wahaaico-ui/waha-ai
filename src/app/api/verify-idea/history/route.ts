import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function GET() {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await access.supabase
      .from('idea_verifications')
      .select('id, topic, acceptance_score, decision, total_papers, created_at')
      .eq('user_id', access.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ error: 'Unable to load verification history' }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch {
    return NextResponse.json({ error: 'Unable to load verification history' }, { status: 500 });
  }
}
