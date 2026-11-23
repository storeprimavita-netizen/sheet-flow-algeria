VERDICT: FIX
Reviewer model: claude-opus

## Summary

The design review found three medium issues. Specify the transition overload contract, validate persisted view settings when reading them, and verify function grants. The local schema was available for inspection.

## Findings

1. **Medium · brief step 2.** Give the five-argument overload no defaults. Kanban sends explicit nulls for unused status or note fields. Define null preserve flag and note plus preserve flag behavior. Keep the existing return shape and `changed` semantics so unchanged confirmations do not repeat auto-push.
2. **Medium · brief step 3.** Treat persisted view config as untrusted even when the action validates it. Use the lenient read parser and scope and role allowlists. Keep database projections fixed.
3. **Medium · brief steps 1–2.** Explicitly preserve revoked seed-helper execution and deny anon execution on both transition signatures. Test grants against the live local database.
4. **Low · seed backfill.** Insert only the new Kanban seed for existing workspaces. Skip duplicate keys, name conflicts and capped groups while preserving old seed deletions.
5. **Low · board movement.** Use the existing transition metadata for both drag and status controls. A non-admin Shipping board and the swap column must never offer moves.
6. **Low · layout URL.** Use the shared query merge path and verify switching layout retains pending search parameters.
7. **Low · workspace check.** Explicitly reject a missing caller workspace when scoping the new overload.

## Acceptance additions

- Keep existing named and positional calls and `swap_order` working. Check invalid flag combinations, unchanged results and helper privileges.
- Test backfill with a deleted seed, a name conflict and a full group. Test corrupt saved config at read time, valid drop targets and a pending search on layout switch.
