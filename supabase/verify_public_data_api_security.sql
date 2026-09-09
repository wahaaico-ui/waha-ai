with target_tables(table_name) as (
  values
    ('projects'), ('documents'), ('sources'), ('ai_generations_log'),
    ('users_usage'), ('research_journeys'), ('research_stage_outputs'),
    ('research_decisions'), ('subscriptions'), ('user_integrations'),
    ('project_references'), ('api_rate_limits'), ('idea_verifications')
), existing_tables as (
  select target_tables.table_name
  from target_tables
  join information_schema.tables
    on tables.table_schema = 'public'
   and tables.table_name = target_tables.table_name
), browser_grants as (
  select table_name,
         string_agg(distinct grantee || ':' || privilege_type, ', ' order by grantee || ':' || privilege_type) as grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
  group by table_name
)
select
  existing_tables.table_name,
  classes.relrowsecurity as rls_enabled,
  coalesce(browser_grants.grants, 'none') as browser_grants,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = existing_tables.table_name) as policy_count
from existing_tables
join pg_class classes on classes.oid = to_regclass(format('public.%I', existing_tables.table_name))
left join browser_grants using (table_name)
order by existing_tables.table_name;
