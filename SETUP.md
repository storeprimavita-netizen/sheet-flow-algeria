# MNW COD ERP — Setup

Next.js 16 (App Router) + Supabase. Auth + RBAC scaffold.

## 1. Database (one-time)

Apply the schema in `supabase/migrations/00001_init.sql`:

- **Dashboard:** Supabase → SQL Editor → paste the file → Run, **or**
- **CLI:** `supabase db push` (install `supabase` CLI first).

## 2. Environment

```bash
cp .env.local.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 3. First admin (one-time)

1. Create a user: sign up once at `/login`, **or** Dashboard → Authentication → Users → Add user.
2. Bootstrap that user as admin (works exactly once, then refuses):

   ```sql
   select public.bootstrap_admin('you@mnw.xxx');
   ```

New signups default to `confirmation_agent`. Any authenticated user can
add/remove agent roles; only admins can grant the `admin` role.

## 4. Generate TypeScript types (after the migration is applied)

```bash
npx supabase gen types --project-id <project-id> > src/lib/supabase/database.types.ts
```

Then type the clients: `createServerClient<Database>(...)` / `createBrowserClient<Database>(...)`
in `src/lib/supabase/{server,client}.ts`.

## 5. Run

```bash
npm run dev
```

## Layout

```
src/
  proxy.ts                     # Next 16 proxy (was "middleware") — session refresh + route gating
  middleware (removed)         # renamed to proxy in Next 16
  lib/
    supabase/{server,client,session}.ts
    rbac.ts                    # getCurrentUserRole() / isCurrentUserAdmin()
  app/
    page.tsx                   # redirects to /app/dashboard
    login/page.tsx
    app/                       # auth-gated (layout.tsx checks session)
      layout.tsx
      dashboard/page.tsx       # shows the signed-in user's role
```

## Notes

- **RBAC enforcement:** RLS (in the migration) is the real boundary. The proxy
  and layout/page checks are UX. Always re-check authz inside Server
  Functions / Route Handlers (webhooks) — do not rely on the proxy alone.
- **Next 16 specifics:** `cookies()`/`headers()` are async (awaited);
  `middleware.ts` → `proxy.ts`; Turbopack is the default bundler.
