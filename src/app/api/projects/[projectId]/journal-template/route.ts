import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { JOURNAL_TEMPLATE_TYPE, parseJournalTemplate } from '@/lib/journal-template';

const headers = { 'Cache-Control': 'private, no-store' };
const serverId = (parts: unknown[]) => {
  const hash = createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

/** The project's saved journal template, or null before one is saved. */
export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const result = await auth.access.supabase.from('documents').select('content').eq('project_id', auth.projectId).eq('type', JOURNAL_TEMPLATE_TYPE)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw result.error;
    let template = null;
    try { template = result.data ? parseJournalTemplate(JSON.parse(String(result.data.content))) : null; } catch { template = null; }
    return NextResponse.json({ template }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر استرجاع قالب المجلة. أعد المحاولة.' }, { status: 503, headers }); }
}

/** Saves an immutable snapshot of the template; an identical retry maps to the same ID. */
export async function PUT(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const template = parseJournalTemplate(await request.json().catch(() => null));
    if (!template) return NextResponse.json({ error: 'راجع القالب: أقسام معروفة دون تكرار، وحدود أرقام صحيحة، وأقل عدد كلمات مفتاحية لا يتجاوز أكثره.' }, { status: 400, headers });
    const saved = await createServiceClient().from('documents').insert({
      id: serverId([JOURNAL_TEMPLATE_TYPE, auth.projectId, template]), project_id: auth.projectId,
      type: JOURNAL_TEMPLATE_TYPE, content: JSON.stringify(template), version: 1,
    });
    if (saved.error && saved.error.code !== '23505') throw saved.error;
    return NextResponse.json({ saved: true, template }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر حفظ قالب المجلة. ما أدخلته باقٍ في الصفحة؛ أعد المحاولة.' }, { status: 503, headers }); }
}
