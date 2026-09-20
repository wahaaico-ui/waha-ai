create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  requester_name text not null check (char_length(requester_name) between 2 and 120),
  requester_email text not null check (char_length(requester_email) between 3 and 320),
  category text not null check (category in ('technical', 'research', 'suggestion', 'partnership', 'billing', 'other')),
  subject text not null check (char_length(subject) between 5 and 160),
  message text not null check (char_length(message) between 20 and 4000),
  page_path text check (page_path is null or char_length(page_path) <= 500),
  status text not null default 'received' check (status in ('received', 'in_review', 'waiting_for_requester', 'resolved', 'closed')),
  assigned_queue text not null check (assigned_queue in ('support', 'followup', 'partnerships', 'billing')),
  review_due_at timestamptz not null default (now() + interval '72 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_requests_status_due_idx
  on public.support_requests (status, review_due_at);

create index support_requests_user_created_idx
  on public.support_requests (user_id, created_at desc)
  where user_id is not null;

alter table public.support_requests enable row level security;

-- Support requests are written only by the trusted server route. They are not
-- exposed to browser roles, which prevents public listing or ticket guessing.
revoke all on table public.support_requests from public;
revoke all on table public.support_requests from anon;
revoke all on table public.support_requests from authenticated;
