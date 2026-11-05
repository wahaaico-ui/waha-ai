import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { isResultId } from '@/lib/research-search-results';

// The caller keeps a single creation id across retries. No AI/provider is involved.
export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'سجّل الدخول لحفظ المشروع.' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!isResultId(body?.projectId) || title.length < 5 || title.length > 500) return NextResponse.json({ error: 'اكتب فكرة من 5 إلى 500 حرف.' }, { status: 400 });
    const projectId = body.projectId;
    const existing = await access.supabase.from('projects').select('id, title').eq('id', projectId).eq('user_id', access.user.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ success: true, project: existing.data, existing: true });
    const result = await access.supabase.from('projects').insert({ id: projectId, user_id: access.user.id, title, status: 'draft' }).select('id, title').single();
    if (result.error?.code === '23505') {
      const retry = await access.supabase.from('projects').select('id, title').eq('id', projectId).eq('user_id', access.user.id).maybeSingle();
      if (retry.data) return NextResponse.json({ success: true, project: retry.data, existing: true });
      return NextResponse.json({ error: 'المشروع غير متاح.' }, { status: 404 });
    }
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, project: result.data }, { status: 201 });
  } catch { return NextResponse.json({ error: 'تعذر حفظ المشروع. أعد المحاولة.' }, { status: 503 }); }
}

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('projectId');
    if (!id) {
      const result = await access.supabase.from('projects').select('id, title, created_at').eq('user_id', access.user.id).order('created_at', { ascending: false }).limit(12);
      if (result.error) throw result.error;
      return NextResponse.json({ projects: result.data || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (!isResultId(id)) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const result = await access.supabase.from('projects').select('id, title').eq('id', id).eq('user_id', access.user.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ success: true, project: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Unable to load project' }, { status: 503 }); }
}
