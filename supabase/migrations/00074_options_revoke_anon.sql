-- NAV-4-S: anon holds no privilege on options / option_sets (AGENTS.md: no anon
-- table grants). RLS already blocks anon; this removes the surface. Idempotent.
revoke all on public.options from anon;
revoke all on public.option_sets from anon;
