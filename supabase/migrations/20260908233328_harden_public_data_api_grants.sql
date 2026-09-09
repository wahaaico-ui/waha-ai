-- Keep the browser-facing Data API least-privileged. Some installations do
-- not contain every optional table, so each operation is existence-guarded.
do $security$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects', 'documents', 'sources', 'ai_generations_log', 'users_usage',
    'research_journeys', 'research_stage_outputs', 'research_decisions',
    'subscriptions', 'user_integrations', 'project_references',
    'api_rate_limits', 'idea_verifications'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
    end if;
  end loop;

  foreach table_name in array array[
    'projects', 'documents', 'sources', 'ai_generations_log',
    'research_journeys', 'research_stage_outputs', 'research_decisions',
    'project_references'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        table_name
      );
    end if;
  end loop;

  foreach table_name in array array[
    'users_usage', 'subscriptions', 'idea_verifications'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('grant select on table public.%I to authenticated', table_name);
    end if;
  end loop;

  if to_regclass('public.idea_verifications') is not null then
    execute 'drop policy if exists "Users can insert own verifications" on public.idea_verifications';
  end if;
end
$security$;

-- New public objects are private to browser roles until a migration grants the
-- exact operations needed and adds matching RLS policies.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
