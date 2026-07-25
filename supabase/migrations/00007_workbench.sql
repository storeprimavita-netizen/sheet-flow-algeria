-- ============================================================================
-- MNW COD ERP — workbench (Phase 10: agent call-sheet + assignment)
-- File: supabase/migrations/00007_workbench.sql
--
-- A confirmation attempt counter so the workbench can show how many times an
-- order has been dialled. The column-guard trigger already lets agents update
-- non-status columns, so no trigger change is needed.
-- ============================================================================

alter table public.orders
  add column if not exists confirmation_attempts integer not null default 0;
