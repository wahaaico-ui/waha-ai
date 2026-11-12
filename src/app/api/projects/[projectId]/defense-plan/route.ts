import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { journeyOutputs } from '@/lib/journey-outputs';
import { stageComplete, WORKFLOW_STAGES } from '@/lib/research-workflow';
import { calendarDate, DEFENSE_PLAN_TYPE, mergeSavedPlan } from '@/lib/defense-plan';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';
import { readDefensePlan } from '@/lib/defense-plan-data';
import { isProjectEmailConfigured } from '@/lib/email/resend';

const headers = { 'Cache-Control': 'private, no-store' };
const STAGE_TYPES = new Set(WORKFLOW_STAGES.map(stage => `journey:${stage}`));
const serverId = (parts: unknown[]) => {
  const hash = createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

/** The saved defense date and ticked tasks, with how many journey stages are still open (DOC-38-03). */
export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const db = auth.access.supabase;
    const [plan, stages] = await Promise.all([
      readDefensePlan(db, auth.projectId),
      db.from('documents').select('id, project_id, type, content, version, created_at').eq('project_id', auth.projectId).like('type', 'journey:%')
        .order('version', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    if (stages.error) throw stages.error;
    const outputs = journeyOutputs(((stages.data || []) as JourneyDocumentSnapshot[]).filter(document => STAGE_TYPES.has(String(document.type))));
    const incompleteStages = WORKFLOW_STAGES.filter(stage => !stageComplete(stage, outputs[stage])).length;
    // The page promises an email only when the daily job and the mail service are both set up.
    const emailReminder = Boolean(process.env.CRON_SECRET?.trim()) && isProjectEmailConfigured();
    return NextResponse.json({ plan, incompleteStages, emailReminder }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر استرجاع خطة الاستعداد للمناقشة. أعد المحاولة.' }, { status: 503, headers }); }
}

/** Saves the date and ticks as a new snapshot; a reminder already sent for the same date stays recorded. */
export async function PUT(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as { defenseDate?: unknown; done?: unknown } | null;
    const defenseDate = calendarDate(body?.defenseDate);
    if (!defenseDate || !Array.isArray(body?.done)) return NextResponse.json({ error: 'اكتب موعد المناقشة تاريخًا صحيحًا.' }, { status: 400, headers });
    const plan = mergeSavedPlan(await readDefensePlan(auth.access.supabase, auth.projectId), { defenseDate, done: body.done.filter((item): item is string => typeof item === 'string') });
    const savedAt = new Date().toISOString();
    const saved = await createServiceClient().from('documents').insert({
      id: serverId([DEFENSE_PLAN_TYPE, auth.projectId, plan, savedAt]), project_id: auth.projectId,
      type: DEFENSE_PLAN_TYPE, content: JSON.stringify(plan), version: 1,
    });
    if (saved.error && saved.error.code !== '23505') throw saved.error;
    return NextResponse.json({ saved: true, plan }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر حفظ خطة الاستعداد. ما أدخلته باقٍ في الصفحة؛ أعد المحاولة.' }, { status: 503, headers }); }
}
