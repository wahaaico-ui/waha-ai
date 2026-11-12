jest.mock('@/components/SiteHeader', () => ({ __esModule: true, default: () => null }));

import { renderToStaticMarkup } from 'react-dom/server';
import { DefensePlanView } from './DefensePreparationWorkspace';
import { DefenseReminderList } from './DefenseReminderBanner';
import { buildDefensePlan, defenseReminderEmail } from '@/lib/defense-plan';

const at = (iso: string) => new Date(`${iso}T09:00:00Z`);

test('the plan shows each task with its date, its page and what is still open', () => {
  const view = buildDefensePlan({ defenseDate: '2026-12-01', done: ['guide'] }, at('2026-11-17'), { incompleteStages: 2 });
  const html = renderToStaticMarkup(<DefensePlanView view={view} projectId="p1" />);
  expect(html).toContain('بقي على المناقشة 14 يومًا.');
  expect(html).toContain('بقيت 2 مراحل غير مكتملة.');
  expect(html).toContain('2026-11-21');
  expect(html).toContain('href="/research/seminar?projectId=p1"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).not.toContain('فوزّعنا المهام');
});

test('a late start says the open tasks were spread over the days left', () => {
  const view = buildDefensePlan({ defenseDate: '2026-12-01', done: [] }, at('2026-11-28'), { incompleteStages: 0 });
  expect(renderToStaticMarkup(<DefensePlanView view={view} projectId="p1" />)).toContain('فوزّعنا المهام المفتوحة على الأيام الباقية بترتيبها.');
});

test('the dashboard reminder links to the plan, and nothing shows without a reminder', () => {
  expect(renderToStaticMarkup(<DefenseReminderList reminders={[]} />)).toBe('');
  const html = renderToStaticMarkup(<DefenseReminderList reminders={[{ projectId: 'p1', title: 'التعليم الإلكتروني', defenseDate: '2026-12-01', daysLeft: 9 }]} />);
  expect(html).toContain('بقي على مناقشة «التعليم الإلكتروني» 9 يومًا.');
  expect(html).toContain('href="/research/defense?projectId=p1"');
});

test('the reminder email carries the date and link and escapes the title', () => {
  const email = defenseReminderEmail({ title: '<b>بحثي</b>', defenseDate: '2026-12-01', daysLeft: 14, link: 'https://waha.systems/research/defense?projectId=p1' });
  expect(email.subject).toBe('تذكير: مناقشة «<b>بحثي</b>» بعد 14 يومًا');
  expect(email.html).toContain('&lt;b&gt;بحثي&lt;/b&gt;');
  expect(email.html).not.toContain('<b>بحثي</b>');
  expect(email.text).toContain('2026-12-01');
});
