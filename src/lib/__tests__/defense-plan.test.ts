import { DEFENSE_PLAN_TYPE, buildDefensePlan, daysUntil, mergeSavedPlan, parseDefensePlan, reminderDue } from '@/lib/defense-plan';

const day = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

describe('saved defense plan', () => {
  test('keeps a real future-or-past calendar date and known task ids only', () => {
    expect(DEFENSE_PLAN_TYPE).toBe('defense-plan:v1');
    expect(parseDefensePlan({ defenseDate: '2026-12-01', done: ['slides', 'nope', 'slides'], reminderSentAt: null }))
      .toEqual({ version: 1, defenseDate: '2026-12-01', done: ['slides'], reminderSentAt: null });
    expect(parseDefensePlan({ defenseDate: '2026-02-30', done: [] })).toBeNull();
    expect(parseDefensePlan({ defenseDate: 'tomorrow', done: [] })).toBeNull();
    expect(parseDefensePlan(null)).toBeNull();
  });

  test('a new save keeps the sent reminder unless the date moved', () => {
    const saved = { version: 1 as const, defenseDate: '2026-12-01', done: [], reminderSentAt: '2026-11-17T06:00:00.000Z' };
    expect(mergeSavedPlan(saved, { defenseDate: '2026-12-01', done: ['slides'] }).reminderSentAt).toBe('2026-11-17T06:00:00.000Z');
    expect(mergeSavedPlan(saved, { defenseDate: '2026-12-08', done: [] }).reminderSentAt).toBeNull();
    expect(mergeSavedPlan(null, { defenseDate: '2026-12-08', done: [] }).reminderSentAt).toBeNull();
  });
});

describe('two-week preparation plan (DOC-38-03)', () => {
  test('counts whole calendar days to the defense', () => {
    expect(daysUntil('2026-12-01', day('2026-11-17'))).toBe(14);
    expect(daysUntil('2026-12-01', day('2026-12-01'))).toBe(0);
    expect(daysUntil('2026-12-01', day('2026-12-02'))).toBe(-1);
  });

  test('two weeks ahead, every task has its own date from the defense backwards, in order', () => {
    const plan = buildDefensePlan({ defenseDate: '2026-12-01', done: [] }, day('2026-11-17'), { incompleteStages: 0 });
    expect(plan.daysLeft).toBe(14);
    expect(plan.tasks.map(task => task.id)).toEqual(['stages', 'guide', 'slides', 'questions', 'references', 'originality', 'rehearsal', 'files']);
    expect(plan.tasks.map(task => task.due)).toEqual(['2026-11-17', '2026-11-19', '2026-11-21', '2026-11-23', '2026-11-25', '2026-11-27', '2026-11-29', '2026-11-30']);
    expect(plan.tasks.every(task => task.state === 'upcoming' || task.state === 'today')).toBe(true);
  });

  test('a late start spreads the open tasks over the days left and says so', () => {
    const plan = buildDefensePlan({ defenseDate: '2026-12-01', done: ['stages'] }, day('2026-11-27'), { incompleteStages: 0 });
    expect(plan.daysLeft).toBe(4);
    expect(plan.compressed).toBe(true);
    const open = plan.tasks.filter(task => task.state !== 'done');
    expect(open).toHaveLength(7);
    expect(open.every(task => task.due >= '2026-11-27' && task.due <= '2026-11-30')).toBe(true);
    expect(plan.tasks.find(task => task.id === 'stages')?.state).toBe('done');
  });

  test('missing journey stages are named in the first task', () => {
    const plan = buildDefensePlan({ defenseDate: '2026-12-01', done: [] }, day('2026-11-17'), { incompleteStages: 3 });
    expect(plan.tasks[0]).toMatchObject({ id: 'stages', count: 3 });
  });

  test('after the defense day there is no plan to follow', () => {
    expect(buildDefensePlan({ defenseDate: '2026-12-01', done: [] }, day('2026-12-02'), { incompleteStages: 0 }).tasks).toEqual([]);
  });
});

describe('reminder two weeks before (DOC-38-03)', () => {
  const plan = { version: 1 as const, defenseDate: '2026-12-01', done: [], reminderSentAt: null };
  test('is due from fourteen days before until the day itself, never earlier', () => {
    expect(reminderDue(plan, day('2026-11-16'))).toBe(false);
    expect(reminderDue(plan, day('2026-11-17'))).toBe(true);
    expect(reminderDue(plan, day('2026-11-28'))).toBe(true);
    expect(reminderDue(plan, day('2026-12-02'))).toBe(false);
  });

  test('is sent once: a recorded send stops every later run', () => {
    expect(reminderDue({ ...plan, reminderSentAt: '2026-11-17T06:00:00.000Z' }, day('2026-11-18'))).toBe(false);
  });
});
