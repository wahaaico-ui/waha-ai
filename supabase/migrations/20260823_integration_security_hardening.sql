create policy "No direct client access to integration secrets"
  on public.user_integrations for select to authenticated
  using (false);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function public.check_rate_limit(text, integer, integer) set search_path = '';
