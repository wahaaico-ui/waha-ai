'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { useUiTranslation } from '@/lib/use-ui-translation';

export type DefenseReminder = { projectId: string; title: string; defenseDate: string; daysLeft: number };

/** Reminders as shown, without loading, so they can be rendered and tested on their own. */
export function DefenseReminderList({ reminders }: { reminders: DefenseReminder[] }) {
  const { text: ui } = useUiTranslation();
  if (!reminders.length) return null;
  return <section aria-label={ui('تذكير بالمناقشة')} className="space-y-3">{reminders.map(reminder => <div key={reminder.projectId} role="status" className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div>
      <p className="font-black">{reminder.daysLeft === 0 ? ui('مناقشة «{0}» اليوم.', [reminder.title]) : ui('بقي على مناقشة «{0}» {1} يومًا.', [reminder.title, reminder.daysLeft])}</p>
      <p className="mt-1 text-sm">{ui('خطة الاستعداد جاهزة بمهامها ومواعيدها.')}</p>
    </div></div>
    <Link href={`/research/defense?projectId=${encodeURIComponent(reminder.projectId)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-600 px-5 text-sm font-bold text-white">{ui('افتح خطة الاستعداد')}</Link>
  </div>)}</section>;
}

/** Shown on the dashboard while a project's defense is two weeks away or less. */
export default function DefenseReminderBanner() {
  const [reminders, setReminders] = useState<DefenseReminder[]>([]);
  useEffect(() => {
    // A failed read hides the reminder; the dashboard itself stays usable.
    fetch('/api/defense-reminders', { cache: 'no-store' }).then(response => response.ok ? response.json() : { reminders: [] })
      .then((data: { reminders?: DefenseReminder[] }) => setReminders(data.reminders || [])).catch(() => undefined);
  }, []);
  return <DefenseReminderList reminders={reminders} />;
}
