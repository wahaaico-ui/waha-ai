import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isProjectEmailConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { daysUntil, DEFENSE_PLAN_TYPE, defenseReminderEmail, dueReminders } from '@/lib/defense-plan';
import { readDefensePlan } from '@/lib/defense-plan-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SITE = 'https://waha.systems';

const sameSecret = (given: string, expected: string) => {
  const a = createHash('sha256').update(given).digest(), b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
};
const serverId = (parts: unknown[]) => {
  const hash = createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

/**
 * Daily job (Vercel Cron): emails each researcher once, fourteen days before
 * a saved defense date, then records the send so no later run repeats it
 * (DOC-38-03). Only Vercel, holding CRON_SECRET, may call it.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!given || !sameSecret(given, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isProjectEmailConfigured()) return NextResponse.json({ error: 'email_not_configured' }, { status: 503 });

  const db = createServiceClient();
  const now = new Date();
  const rows = await db.from('documents').select('project_id, content, created_at').eq('type', DEFENSE_PLAN_TYPE)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5000);
  if (rows.error) return NextResponse.json({ error: 'read_failed' }, { status: 503 });

  let sent = 0, failed = 0;
  for (const { projectId, plan } of dueReminders((rows.data || []) as Array<{ project_id: string; content: unknown }>, now)) {
    try {
      const project = await db.from('projects').select('title, user_id').eq('id', projectId).maybeSingle();
      if (project.error || !project.data) throw new Error('project_missing');
      const user = await db.auth.admin.getUserById(String(project.data.user_id));
      const to = user.data.user?.email_confirmed_at ? user.data.user.email : null;
      if (!to) throw new Error('email_missing');
      const message = defenseReminderEmail({ title: String(project.data.title || ''), defenseDate: plan.defenseDate, daysLeft: daysUntil(plan.defenseDate, now), link: `${SITE}/research/defense?projectId=${encodeURIComponent(projectId)}` });
      // The key stops a retried run from sending twice before the send is recorded.
      await sendTransactionalEmail({ to, ...message, idempotencyKey: `defense-reminder:${projectId}:${plan.defenseDate}` });
      // Keep ticks the researcher saved meanwhile; a moved date gets its own reminder later.
      const current = await readDefensePlan(db, projectId);
      const record = { ...(current && current.defenseDate === plan.defenseDate ? current : plan), reminderSentAt: now.toISOString() };
      const saved = await db.from('documents').insert({ id: serverId([DEFENSE_PLAN_TYPE, projectId, record]), project_id: projectId, type: DEFENSE_PLAN_TYPE, content: JSON.stringify(record), version: 1 });
      if (saved.error && saved.error.code !== '23505') throw saved.error;
      sent += 1;
    } catch { failed += 1; }
  }
  return NextResponse.json({ sent, failed }, { headers: { 'Cache-Control': 'no-store' } });
}
