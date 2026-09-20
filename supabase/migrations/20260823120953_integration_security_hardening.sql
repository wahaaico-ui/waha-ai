-- Version aligned with production migration history.
drop policy if exists "No direct client access to integration secrets" on public.user_integrations;
create policy "No direct client access to integration secrets"
  on public.user_integrations for select to authenticated
  using (false);

do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'revoke execute on function public.handle_new_user() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
