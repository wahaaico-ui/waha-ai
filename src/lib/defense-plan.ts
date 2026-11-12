/**
 * Preparation for the thesis defense (DOC-38-03): the researcher saves the
 * defense date, the platform lays out eight tasks over the two weeks before
 * it, and a reminder goes out once, fourteen days ahead. Every date is a
 * calendar day in UTC; no score or estimate is produced.
 */
export const DEFENSE_PLAN_TYPE = 'defense-plan:v1';
export const REMINDER_DAYS = 14;

export const DEFENSE_TASKS = [
  { id: 'stages', daysBefore: 14 },
  { id: 'guide', daysBefore: 12 },
  { id: 'slides', daysBefore: 10 },
  { id: 'questions', daysBefore: 8 },
  { id: 'references', daysBefore: 6 },
  { id: 'originality', daysBefore: 4 },
  { id: 'rehearsal', daysBefore: 2 },
  { id: 'files', daysBefore: 1 },
] as const;
export type DefenseTaskId = typeof DEFENSE_TASKS[number]['id'];
const TASK_IDS = DEFENSE_TASKS.map(task => task.id) as readonly string[];

export type SavedDefensePlan = { version: 1; defenseDate: string; done: DefenseTaskId[]; reminderSentAt: string | null };
export type DefensePlanInput = { defenseDate: string; done: readonly string[] };
export type DefenseTask = { id: DefenseTaskId; due: string; state: 'done' | 'today' | 'upcoming'; count?: number };
export type DefensePlanView = { defenseDate: string; daysLeft: number; compressed: boolean; tasks: DefenseTask[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const dayStart = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);
const today = (now: Date) => isoDay(now.getTime());

/** A real calendar date written as YYYY-MM-DD, or null. */
export function calendarDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = dayStart(value);
  return Number.isFinite(time) && isoDay(time) === value ? value : null;
}

export function daysUntil(defenseDate: string, now: Date) {
  return Math.round((dayStart(defenseDate) - dayStart(today(now))) / DAY_MS);
}

export function parseDefensePlan(value: unknown): SavedDefensePlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const defenseDate = calendarDate(record.defenseDate);
  if (!defenseDate || !Array.isArray(record.done)) return null;
  const done = TASK_IDS.filter(id => (record.done as unknown[]).includes(id)) as DefenseTaskId[];
  const sent = typeof record.reminderSentAt === 'string' && Number.isFinite(Date.parse(record.reminderSentAt)) ? record.reminderSentAt : null;
  return { version: 1, defenseDate, done, reminderSentAt: sent };
}

/** The researcher's new date and ticks; a reminder already sent for the same date stays recorded. */
export function mergeSavedPlan(saved: SavedDefensePlan | null, input: DefensePlanInput): SavedDefensePlan {
  const next = parseDefensePlan({ ...input, reminderSentAt: null });
  if (!next) throw new Error('invalid_defense_plan');
  return { ...next, reminderSentAt: saved && saved.defenseDate === next.defenseDate ? saved.reminderSentAt : null };
}

/**
 * Each task falls on its own day before the defense. When the plan starts late,
 * the open tasks are spread in order over the days left, and `compressed` says so.
 */
export function buildDefensePlan(plan: DefensePlanInput, now: Date, facts: { incompleteStages: number }): DefensePlanView {
  const daysLeft = daysUntil(plan.defenseDate, now);
  if (daysLeft < 0) return { defenseDate: plan.defenseDate, daysLeft, compressed: false, tasks: [] };
  const start = dayStart(today(now)), defense = dayStart(plan.defenseDate);
  const natural = DEFENSE_TASKS.map(task => ({ id: task.id, due: isoDay(defense - task.daysBefore * DAY_MS) }));
  const open = natural.filter(task => !plan.done.includes(task.id));
  const compressed = open.some(task => dayStart(task.due) < start);
  const slots = Math.max(1, daysLeft);
  const dueOf = new Map(compressed ? open.map((task, index) => [task.id, isoDay(start + Math.floor((index * slots) / open.length) * DAY_MS)]) : natural.map(task => [task.id, task.due]));
  const todayIso = today(now);
  const tasks = natural.map(task => {
    const due = dueOf.get(task.id) ?? task.due;
    const state: DefenseTask['state'] = plan.done.includes(task.id) ? 'done' : due <= todayIso ? 'today' : 'upcoming';
    return { id: task.id, due, state, ...(task.id === 'stages' ? { count: facts.incompleteStages } : {}) };
  });
  return { defenseDate: plan.defenseDate, daysLeft, compressed, tasks };
}

/** Due from fourteen days before the defense until the day itself, and only while not yet sent. */
export function reminderDue(plan: SavedDefensePlan, now: Date) {
  const left = daysUntil(plan.defenseDate, now);
  return !plan.reminderSentAt && left >= 0 && left <= REMINDER_DAYS;
}

/** Latest plan per project from rows newest first, keeping only those whose reminder is due now. */
export function dueReminders(rows: Array<{ project_id: string; content: unknown }>, now: Date) {
  const latest = new Map<string, SavedDefensePlan | null>();
  for (const row of rows) {
    if (latest.has(row.project_id)) continue;
    let plan: SavedDefensePlan | null = null;
    try { plan = parseDefensePlan(typeof row.content === 'string' ? JSON.parse(row.content) : row.content); } catch { plan = null; }
    latest.set(row.project_id, plan);
  }
  return [...latest.entries()].flatMap(([projectId, plan]) => plan && reminderDue(plan, now) ? [{ projectId, plan }] : []);
}

/** The reminder email: the date, the days left and the plan link; nothing else from the project. */
export function defenseReminderEmail(input: { title: string; defenseDate: string; daysLeft: number; link: string }) {
  const title = input.title.trim() || 'مشروعك البحثي';
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lines = [
    `بقي على مناقشة «${title}» ${input.daysLeft} يومًا، وموعدها ${input.defenseDate}.`,
    'خطة الاستعداد جاهزة في واحة: ثماني مهام موزعة على الأيام الباقية، من إكمال المراحل إلى البروفة الأخيرة.',
    `افتح الخطة: ${input.link}`,
    'وصلك هذا التذكير مرة واحدة لأنك حفظت موعد المناقشة في مشروعك.',
  ];
  return {
    subject: `تذكير: مناقشة «${title}» بعد ${input.daysLeft} يومًا`,
    text: lines.join('\n\n'),
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">${lines.slice(0, 2).map(line => `<p>${escape(line)}</p>`).join('')}<p><a href="${escape(input.link)}">افتح خطة الاستعداد</a></p><p style="color:#64748b">${escape(lines[3])}</p></div>`,
  };
}
