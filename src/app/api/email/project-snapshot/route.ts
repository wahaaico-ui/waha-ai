import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { buildProjectSnapshotEmail } from '@/lib/email/project-snapshot';
import { isProjectEmailConfigured, sendProjectSnapshotEmail } from '@/lib/email/resend';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    const body: unknown = await request.json().catch(() => null);
    const projectId = body && typeof body === 'object' && typeof (body as { projectId?: unknown }).projectId === 'string'
      ? (body as { projectId: string }).projectId.trim()
      : '';
    if (!UUID_PATTERN.test(projectId)) return NextResponse.json({ error: 'معرّف المشروع غير صالح' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) {
      return NextResponse.json({ error: 'المشروع غير موجود' }, { status: 404 });
    }
    if (!access.user.email) return NextResponse.json({ error: 'لا يوجد بريد مؤكد مرتبط بالحساب' }, { status: 422 });
    if (!isProjectEmailConfigured()) {
      return NextResponse.json({ error: 'خدمة إرسال البريد غير مفعّلة حالياً', code: 'EMAIL_NOT_CONFIGURED' }, { status: 503 });
    }

    const [projectResult, documentResult] = await Promise.all([
      access.supabase
        .from('projects')
        .select('id, title')
        .eq('id', projectId)
        .eq('user_id', access.user.id)
        .maybeSingle(),
      access.supabase
        .from('documents')
        .select('id, type, content, version, created_at')
        .eq('project_id', projectId)
        .like('type', 'journey:%')
        .neq('type', 'journey:decision')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (projectResult.error || documentResult.error) throw new Error('PROJECT_SNAPSHOT_QUERY_FAILED');
    if (!projectResult.data) return NextResponse.json({ error: 'المشروع غير موجود' }, { status: 404 });
    if (!documentResult.data) return NextResponse.json({ error: 'لا توجد نسخة محفوظة لإرسالها بعد' }, { status: 409 });

    const metadata = access.user.user_metadata || {};
    const researcherName = typeof metadata.full_name === 'string' && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : typeof metadata.name === 'string' && metadata.name.trim()
        ? metadata.name.trim()
        : access.user.email.split('@')[0];
    const appUrl = process.env.WAHA_APP_URL?.trim() || 'https://waha.systems';
    const message = buildProjectSnapshotEmail({
      researcherName,
      projectTitle: projectResult.data.title,
      stage: documentResult.data.type,
      version: documentResult.data.version || 1,
      savedAt: documentResult.data.created_at,
      content: documentResult.data.content,
      dashboardUrl: `${appUrl.replace(/\/$/, '')}/dashboard`,
    });

    await sendProjectSnapshotEmail({
      to: access.user.email,
      ...message,
      idempotencyKey: `project-snapshot-${projectId}-${documentResult.data.id}-v${documentResult.data.version || 1}`,
    });

    return NextResponse.json({ success: true, sentTo: access.user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('Project snapshot email failed', { code: message.startsWith('EMAIL_') ? message : 'UNKNOWN' });
    if (message === 'EMAIL_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'خدمة إرسال البريد غير مفعّلة حالياً', code: message }, { status: 503 });
    }
    if ((error as { name?: unknown })?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'تأخر مزود البريد، حاول مجدداً' }, { status: 504 });
    }
    return NextResponse.json({ error: 'تعذر إرسال النسخة حالياً' }, { status: 502 });
  }
}
