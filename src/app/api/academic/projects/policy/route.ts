import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  try {
    const { projectId, universityPolicy } = await request.json();
    if (!projectId || !universityPolicy) {
      return NextResponse.json({ error: 'Missing projectId or universityPolicy' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { error } = await supabase
      .from('projects')
      .update({ university_policy: universityPolicy })
      .eq('id', projectId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update policy' }, { status: 500 });
  }
}
