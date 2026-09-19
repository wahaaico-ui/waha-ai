-- Full account deletion is performed by deleting auth.users. Every row that
-- identifies that user must therefore cascade instead of becoming orphaned.
do $account_deletion$
declare
  constraint_name text;
begin
  if to_regclass('public.idea_verifications') is not null then
    select con.conname into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'idea_verifications'
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
    limit 1;

    if constraint_name is not null then
      execute format('alter table public.idea_verifications drop constraint %I', constraint_name);
    end if;
    alter table public.idea_verifications
      add constraint idea_verifications_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  constraint_name := null;
  if to_regclass('public.profiles') is not null then
    select con.conname into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
    limit 1;

    if constraint_name is not null then
      execute format('alter table public.profiles drop constraint %I', constraint_name);
    end if;
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end
$account_deletion$;
