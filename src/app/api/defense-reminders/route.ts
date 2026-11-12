import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { DEFENSE_PLAN_TYPE, daysUntil, parseDefensePlan, REMINDER_DAYS } from '@/lib/defense-plan';

const headers = { 'Cache-Control': 'private, no-store' };

/** The signed-in researcher's projects whose defense falls within the next two weeks (DOC-38-03). */
export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401, headers });
  try {
    const projects = await access.supabase.from('projects').select('id, title').eq('user_id', access.user.id).limit(200);
    if (projects.error) throw projects.error;
    const ids = (projects.data || []).map(project => project.id as string);
    if (!ids.length) return NextResponse.json({ reminders: [] }, { headers });
    const documents = await access.supabase.from('documents').select('project_id, content, created_at').in('project_id', ids).eq('type', DEFENSE_PLAN_TYPE)
      .order('created_at', { ascending: false });
    if (documents.error) throw documents.error;
    const latest = new Map<string, unknown>();
    for (const row of documents.data || []) if (!latest.has(row.project_id as string)) latest.set(row.project_id as string, row.content);
    const now = new Date();
    const reminders = (projects.data || []).flatMap(project => {
      let plan = null;
      try { plan = parseDefensePlan(JSON.parse(String(latest.get(project.id as string) ?? 'null'))); } catch { plan = null; }
      if (!plan) return [];
      const daysLeft = daysUntil(plan.defenseDate, now);
      return daysLeft >= 0 && daysLeft <= REMINDER_DAYS ? [{ projectId: project.id as string, title: String(project.title || ''), defenseDate: plan.defenseDate, daysLeft }] : [];
    }).sort((a, b) => a.daysLeft - b.daysLeft);
    return NextResponse.json({ reminders }, { headers });
  } catch {
    return NextResponse.json({ error: 'تعذر قراءة مواعيد المناقشة.' }, { status: 503, headers });
  }
}
