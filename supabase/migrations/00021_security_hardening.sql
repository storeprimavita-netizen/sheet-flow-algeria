-- 15a: OWASP review fixes.

-- [CRITICAL] account_balances was created without security_invoker, so it ran
-- as its owner (postgres) and bypassed RLS on accounts/expenses/ad_spend —
-- readable by anon with the public key. Match every other view.
alter view public.account_balances set (security_invoker = true);
revoke all on public.account_balances from anon;

-- [HIGH, latent] An admin could UPDATE their own profile's workspace_id and
-- become admin of another tenant (pr_upd allows self-updates; the guard
-- returned early for admins). Nobody moves themselves; admins may only touch
-- profiles inside their own workspace.
create or replace function public.guard_profiles()
returns trigger
language plpgsql security definer set search_path = public as $$
declare admin_exists boolean;
begin
  select exists(select 1 from public.profiles where role = 'admin' and is_active)
    into admin_exists;
  if not admin_exists then return new; end if;   -- bootstrap window
  if auth.uid() is null then return new; end if; -- service role / SQL editor
  if tg_op = 'UPDATE'
     and new.user_id = auth.uid()
     and new.workspace_id is distinct from old.workspace_id then
    raise exception 'cannot move your own profile to another workspace';
  end if;
  if public.is_admin() then
    if tg_op = 'UPDATE' and old.workspace_id is distinct from public.current_workspace_id() then
      raise exception 'profile belongs to another workspace';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE'
     and (new.role is distinct from old.role
          or new.workspace_id is distinct from old.workspace_id
          or new.is_active is distinct from old.is_active) then
    raise exception 'only admins can change role, workspace, or activation';
  end if;
  return new;
end; $$;

-- [LOW] SECURITY DEFINER seed/bootstrap helpers were executable by PUBLIC.
revoke execute on function public.seed_workspace(uuid) from public, anon, authenticated;
revoke execute on function public.bootstrap_workspace(text, text) from public, anon, authenticated;
