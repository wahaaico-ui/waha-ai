# Defense preparation plan and reminder — design (2026-11-13)

Requirement: DOC-38-03 (a reminder and preparation plan two weeks before the defense; acceptance: a test with a controlled clock issues the alert once). Roadmap item 2.7.

## Plan

- The researcher saves the defense date on `/research/defense` (linked from the research journey and the seminar report). It is kept as a project document `defense-plan:v1` (immutable snapshots, latest wins, written with the server client like the journal template; reads use the owner's session). Content: `{ version, defenseDate, done, reminderSentAt }`. No new table.
- Eight fixed tasks, each on its own day before the defense: open stages (14 days before, with the count of incomplete stages), guide compliance (12), presentation from the seminar report (10), hard questions (8), references (6), final similarity check (4), timed rehearsal (2), copies and files (1). Each links to the page where it is done.
- A late start spreads the open tasks, in order, over the days left and says so. After the defense day the page asks to update the date. Ticks are saved; changing the date clears the ticks and the reminder record.
- Dates are UTC calendar days. No scores, no estimates, no model.

## Reminder

- In the product: `/dashboard` shows a reminder for each of the researcher's projects whose defense is fourteen days away or less (`GET /api/defense-reminders`, the account's own projects only).
- By email, once: a daily Vercel Cron job (`/api/cron/defense-reminders`, 06:00 UTC, `vercel.json`) finds plans whose reminder is due (0 to 14 days left and not yet sent), emails the confirmed owner address through Resend with an idempotency key per project and date, then records `reminderSentAt` in a new snapshot that keeps any ticks saved meanwhile. A recorded send stops every later run.
- The job runs only with `CRON_SECRET` (compared in constant time) and a configured mail service; otherwise it answers 503 and sends nothing. The page promises email only when both are set, and otherwise promises the dashboard reminder alone.
- Owner step: add `CRON_SECRET` in the Vercel project settings (and the Resend key and sender if not already set). Until then the dashboard reminder works and no email goes out.

## Tests

Unit: dates, task order and dates, compression, reminder window, once-only rule, saved-plan parsing and merge, email escaping. Routes: ownership, date validation, reminder kept for the same date and reset for a new one, reminders limited to the account and to two weeks, the job refusing without the secret or mail service and sending exactly once under a fixed clock. Render: plan view, late start, dashboard reminder. Gate: save a date ten days ahead, see the compressed plan, tick a task and keep it after reload, and see the dashboard reminder.
