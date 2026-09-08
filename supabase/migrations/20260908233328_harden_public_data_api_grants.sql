-- Keep the browser-facing Data API least-privileged. RLS remains the row-level
-- boundary; these grants limit which operations can reach that boundary.

alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.sources enable row level security;
alter table public.ai_generations_log enable row level security;
alter table public.users_usage enable row level security;
alter table public.research_journeys enable row level security;
alter table public.research_stage_outputs enable row level security;
alter table public.research_decisions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_integrations enable row level security;
alter table public.project_references enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.idea_verifications enable row level security;

revoke all on table
  public.projects,
  public.documents,
  public.sources,
  public.ai_generations_log,
  public.users_usage,
  public.research_journeys,
  public.research_stage_outputs,
  public.research_decisions,
  public.subscriptions,
  public.user_integrations,
  public.project_references,
  public.api_rate_limits,
  public.idea_verifications
from anon, authenticated;

grant select, insert, update, delete on table
  public.projects,
  public.documents,
  public.sources,
  public.ai_generations_log,
  public.research_journeys,
  public.research_stage_outputs,
  public.research_decisions,
  public.project_references
to authenticated;

grant select on table
  public.users_usage,
  public.subscriptions,
  public.idea_verifications
to authenticated;

-- Verification creation and usage accounting are server-mediated. Integration
-- secrets and rate-limit state are never exposed to browser roles.
drop policy if exists "Users can insert own verifications" on public.idea_verifications;

-- New public objects are private to browser roles until a migration grants the
-- exact operations needed and adds matching RLS policies.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
