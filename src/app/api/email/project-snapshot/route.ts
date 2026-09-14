import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { buildProjectSnapshotEmail } from '@/lib/email/project-snapshot';
import { isProjectEmailConfigured, sendProjectSnapshotEmail } from '@/lib/email/resend';
import { completeOperationalRequest, operationalHeaders, startOperationalRequest } from '@/lib/observability';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const operation = startOperationalRequest(request, '/api/email/project-snapshot', 'api.email.project_snapshot.started');
  const respond = (payload: Record<string, unknown>, status: number, errorCode?: string) => {
    completeOperationalRequest(operation, 'api.email.project_snapshot.completed', status, status < 400 ? 'success' : status < 500 ? 'rejected' : 'failed', errorCode);
    return NextResponse.json(status >= 400 ? { ...payload, requestId: operation.requestId } : payload, { status, headers: operationalHeaders(operation) });
  };
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return respond({ error: 'يجب تسجيل الدخول' }, 401, 'unauthorized');

    const body: unknown = await request.json().catch(() => null);
    const projectId = body && typeof body === 'object' && typeof (body as { projectId?: unknown }).projectId === 'string'
      ? (body as { projectId: string }).projectId.trim()
      : '';
    if (!UUID_PATTERN.test(projectId)) return respond({ error: 'معرّف المشروع غير صالح' }, 400, 'invalid_project_id');
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) {
      return respond({ error: 'المشروع غير موجود' }, 404, 'project_not_found');
    }
    if (!access.user.email) return respond({ error: 'لا يوجد بريد مؤكد مرتبط بالحساب' }, 422, 'confirmed_email_missing');
    if (!isProjectEmailConfigured()) {
      return respond({ error: 'خدمة إرسال البريد غير مفعّلة حالياً', code: 'EMAIL_NOT_CONFIGURED' }, 503, 'email_not_configured');
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
    if (!projectResult.data) return respond({ error: 'المشروع غير موجود' }, 404, 'project_not_found');
    if (!documentResult.data) return respond({ error: 'لا توجد نسخة محفوظة لإرسالها بعد' }, 409, 'snapshot_missing');

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

    return respond({ success: true, sentTo: access.user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'EMAIL_NOT_CONFIGURED') {
      return respond({ error: 'خدمة إرسال البريد غير مفعّلة حالياً', code: message }, 503, 'email_not_configured');
    }
    if ((error as { name?: unknown })?.name === 'TimeoutError') {
      return respond({ error: 'تأخر مزود البريد، حاول مجدداً' }, 504, 'email_provider_timeout');
    }
    return respond({ error: 'تعذر إرسال النسخة حالياً' }, 502, message.startsWith('EMAIL_') ? message.toLowerCase() : 'email_send_failed');
  }
}
