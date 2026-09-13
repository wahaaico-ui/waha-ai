update public.subscriptions
set plan = 'pro', updated_at = now()
where plan = 'researcher';

alter table public.subscriptions
  alter column plan set default 'pro';

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('pro', 'expert', 'institutional'));
