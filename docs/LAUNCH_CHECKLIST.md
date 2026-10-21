# Launch checklist (details: docs/council/E-integrations-deploy.md)
- [ ] Rotate tokenrouter/kimi key; delete `kimi.tx` and `~/mnw-erp-backup-*.bundle`
- [ ] `LOCAL_SUPABASE_URL=… npm test` 83/83, `npx tsc --noEmit`, `npm run build`
- [ ] Secret scan of outgoing commits clean (redacted output only)
- [ ] Supabase backup → owner runs `db push` (00020→00024 + new, in order; 00024 BEFORE app deploy) → regen types, no diff
- [ ] Vercel project; env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL(https); Supabase auth site/redirect URLs
- [ ] Push `mnw` (set upstream; target branch decision), deploy preview, smoke test both themes/locales, agent cannot see cost/profit/ad data
- [ ] Bootstrap workspace + admin; webhook secrets; send test order twice → one order
- [ ] ZR: creds, territories, webhook, `zr_state_map`; one controlled parcel agreed with ZR, cancel after
- [ ] Watch `webhook_events` errors 48h
## Rollback
App: Vercel instant rollback (safe on new DB). DB: forward-fix only (restore 00011 `dashboard_stats`, 00015 void `transition_order_status`); never revert 00021; data damage → PITR. Integrations: `integration_configs.is_active=false`, cancel parcels in ZR, replay from `webhook_events`.
