-- STATS-3 review 1 (7): the unique check ran before the composite FK, so another workspace could
-- tell by 23505 vs 23503 whether a season had a period for a year. Scope it to the workspace.
alter table public.season_periods drop constraint season_periods_season_id_year_key;
alter table public.season_periods add constraint season_periods_ws_season_year_key unique (workspace_id, season_id, year);
