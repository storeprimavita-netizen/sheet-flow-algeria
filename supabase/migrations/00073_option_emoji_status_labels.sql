-- NAV-4: emoji on options; per-workspace label overrides for system statuses.
-- Overrides change the DISPLAYED text only; keys, colors, transitions stay in code.

-- 1) options.emoji (admin-only to set: insert policy now refuses an emoji from non-admins)
alter table public.options add column emoji text;
alter table public.options add constraint options_emoji_chk check (
  emoji is null or (
    char_length(emoji) between 1 and 16
    and emoji !~ '[[:cntrl:]]'
    -- U+200D (ZWJ) stays allowed: family and profession emoji are joined with it
    and emoji !~ E'[\u200B\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069]'
  )
);
comment on column public.options.icon is 'DEPRECATED (NAV-4): unused, use emoji';

drop policy o_ins on public.options;
create policy o_ins on public.options for insert to authenticated
  with check (
    workspace_id = (select public.current_workspace_id())
    and (emoji is null or (select public.is_admin()))
  );

-- 2) status_label_overrides
create table public.status_label_overrides (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind         text not null check (kind in ('confirmation','delivery','product','task','stock','store','review')),
  status_key   text not null check (status_key ~ '^[a-z_]{1,40}$'),
  label_en     text,
  label_ar     text,
  updated_at   timestamptz not null default now(),
  unique (workspace_id, kind, status_key),
  constraint sl_en_chk check (label_en is null or (char_length(label_en) between 1 and 40
    and label_en !~ '[[:cntrl:]]' and label_en !~ E'[\u200B-\u200F\u202A-\u202E\u2066-\u2069]')),
  constraint sl_ar_chk check (label_ar is null or (char_length(label_ar) between 1 and 40
    and label_ar !~ '[[:cntrl:]]' and label_ar !~ E'[\u200B-\u200F\u202A-\u202E\u2066-\u2069]')),
  constraint sl_nonblank_chk check (
    coalesce(btrim(label_en), '') <> '' or coalesce(btrim(label_ar), '') <> '')
);

create trigger set_updated_at before update on public.status_label_overrides
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.status_label_overrides
  for each row execute function public.audit_row();

alter table public.status_label_overrides enable row level security;
revoke all on public.status_label_overrides from anon;
revoke truncate, trigger, references on public.status_label_overrides from authenticated;

create policy slo_sel on public.status_label_overrides for select to authenticated
  using (workspace_id = (select public.current_workspace_id()));
create policy slo_ins on public.status_label_overrides for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy slo_upd on public.status_label_overrides for update to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy slo_del on public.status_label_overrides for delete to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
