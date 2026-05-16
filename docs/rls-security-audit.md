# RLS Security Audit — Padrino Pizzeria

**Batch:** B14 | **Tier:** STRICT | **Date:** 2026-05-16
**Source:** B3 schema baseline `supabase/migrations/20260510230628_remote_schema.sql`
**Status:** AUDIT-ONLY. Remediation SQL is proposed below — NOT applied.
Remediation requires a separate STRICT execution batch with live DB verification first.

---

## Summary

| # | Finding | Severity | Tables | Baseline-only? |
|---|---------|----------|--------|----------------|
| F1 | `admin_users` has no RLS + `GRANT ALL TO anon` | **CRITICAL** | admin_users | Yes — verify live |
| F2 | `orders` admin policies hardcode a personal email | **MEDIUM** | orders | Yes — verify live |

---

## Finding 1 — `admin_users`: No RLS + GRANT ALL to `anon`

### Evidence (baseline lines)

```
L438: GRANT ALL ON TABLE "public"."admin_users" TO "anon";
L439: GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
L440: GRANT ALL ON TABLE "public"."admin_users" TO "service_role";

L236: ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;
L239: ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
L242: ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;
-- admin_users is NOT in the ENABLE ROW LEVEL SECURITY list.
```

`admin_users` schema (L92–L98):
```sql
CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "email" text NOT NULL,               -- PK, the admin allowlist
    "role"  text DEFAULT 'staff' NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "admin_users_role_check" CHECK (role IN ('owner', 'staff'))
);
```

### Attack vector

The Supabase `anon` key is **public** — it ships in the React frontend bundle, exposed to every browser. Supabase PostgREST uses this key for unauthenticated REST access. With `GRANT ALL` and no RLS on `admin_users`, any visitor can:

| Operation | HTTP call | Effect |
|-----------|-----------|--------|
| **Read all admins** | `GET /rest/v1/admin_users?select=*` with anon header | Exposes all admin emails, roles, enabled status |
| **Insert admin** | `POST /rest/v1/admin_users` with anon header | Privilege escalation: attacker inserts their own email → gains admin access via admin API |
| **Disable admin** | `PATCH /rest/v1/admin_users?email=eq.<email>` with anon header | DoS: disable the owner account |
| **Delete admin** | `DELETE /rest/v1/admin_users?email=eq.<email>` with anon header | Removes admin from allowlist |

This is a full **privilege escalation** path. The app-layer admin guard (`api/_shared/admin-auth.ts`) validates against `admin_users`, but that validation uses the `service_role` key (backend-only). An attacker who inserts a row via anon PostgREST does not bypass the Supabase Auth session check, BUT they pre-populate the allowlist to allow their account if they obtain a Supabase Auth session. Combined with a future account creation flow or social engineering, this is exploitable.

### Severity: CRITICAL

- Exploitability: **HIGH** — anon key is public; no special skills required; standard HTTP client
- Blast radius: **CRITICAL** — admin allowlist is the auth gate for all admin operations (orders, menu, settings, user management)
- Confidentiality: **HIGH** — exposes all admin email addresses

---

## Finding 2 — `orders`: Hardcoded personal email in RLS policies

### Evidence (baseline lines)

```sql
-- L220
CREATE POLICY "allow_admin_delete_by_email" ON "public"."orders"
  FOR DELETE TO "authenticated"
  USING ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com');

-- L224
CREATE POLICY "allow_admin_select_by_email" ON "public"."orders"
  FOR SELECT TO "authenticated"
  USING ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com');

-- L228
CREATE POLICY "allow_admin_update_by_email" ON "public"."orders"
  FOR UPDATE TO "authenticated"
  USING  ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com');

-- L239: orders has RLS enabled ✓
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
```

### Problems

1. **Fragile single point of failure** — if the owner's Supabase Auth email changes (via Supabase dashboard), all three DB-level policies break immediately, blocking any direct PostgREST admin access with an authenticated JWT.

2. **Diverges from app-layer auth model** — `api/_shared/admin-auth.ts` (B10/B10.1) validates against the `admin_users` table (supports `owner` + `staff` roles, checks `enabled` flag). The DB-level RLS only recognizes one hardcoded email. If staff accounts are ever issued Supabase Auth sessions, they'd be blocked at the DB level.

3. **Does NOT protect the admin API path** — all `api/admin-*.ts` endpoints use `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)`. Service_role bypasses RLS (`SET row_security = off` internally). These policies have zero effect on any admin API endpoint. The policies only matter for direct PostgREST calls with an `authenticated` JWT.

### Severity: MEDIUM

- Exploitability: **LOW** — exploiting requires an `authenticated` Supabase session (not just the public anon key)
- Impact if hardcoded email becomes stale: **MEDIUM** — DB-level admin access blocked, app-layer unaffected
- Consistency risk: **MEDIUM** — diverges from `admin_users` auth model; silent inconsistency

---

## Live Verification (for Pavle — run against Supabase dashboard SQL editor)

**Baseline snapshot date:** 2026-05-10 (`supabase db pull`, batch B3). The live DB may have been modified since. Run these queries to confirm each finding against the current production state before scheduling remediation.

```sql
-- 1. RLS status for all public tables
-- Expected: admin_users.rowsecurity = false (FINDING F1 confirmed)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. All policies in public schema
-- Expected: no policies on admin_users (F1 confirmed)
--           three _by_email policies on orders (F2 confirmed)
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'admin_users', 'menu_items', 'site_settings')
ORDER BY tablename, policyname;

-- 3. Grants on admin_users
-- Expected: anon = GRANT ALL, authenticated = GRANT ALL (F1 confirmed)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'admin_users'
ORDER BY grantee, privilege_type;

-- 4. Verify current admin allowlist contents (sanity before remediation)
SELECT email, role, enabled, created_at FROM admin_users ORDER BY created_at;
```

**Label each finding as "CONFIRMED" or "NOT REPRODUCED" after running these queries. Do not proceed with remediation if live state differs materially from baseline.**

---

## Anti-Regression Analysis — API Paths Are Safe

All admin API endpoints (`api/admin-orders.ts`, `api/admin-me.ts`, `api/admin-settings.ts`, `api/admin-menu.ts`, `api/admin-menu-image.ts`, `api/admin-users.ts`, `api/admin-update-order-status.ts`, `api/admin-resend-telegram.ts`) use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.

In Supabase (PostgreSQL), the `service_role` key creates a connection with `SET row_security = off` — **service_role bypasses RLS unconditionally, for all tables**. This means:

- `getAdminFromDb()` in `api/_shared/admin-auth.ts` queries `admin_users` via service_role → unaffected by any RLS change on `admin_users`
- All order reads/writes in admin handlers use service_role → unaffected by any change to `orders` RLS policies
- **Enabling RLS on `admin_users` and revoking `anon`/`authenticated` grants will NOT break any admin API endpoint**

The only paths affected by proposed remediation:
1. Direct PostgREST calls with `anon` key → F1 remediation closes this (desired)
2. Direct PostgREST calls with `authenticated` JWT (if any non-API clients exist) → would need a targeted `allow_self_read` policy on `admin_users` for F2 remediation to work (see Option A below)

---

## Proposed Remediation (NOT APPLIED — document only)

### Priority 1 — Fix F1: Enable RLS on `admin_users` + Revoke anon/authenticated grants

**Risk:** LOW — service_role bypasses RLS, API paths unaffected. Only direct PostgREST access changes.
**Prerequisite:** Verify live grants match baseline (query 3 above). Confirm no legitimate client uses anon/authenticated key against admin_users.

```sql
-- Step 1: Enable RLS on admin_users (blocks all non-service_role access by default)
ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;

-- Step 2: Revoke table-level grants from anon and authenticated
-- (service_role retains its grant; it bypasses RLS anyway)
REVOKE ALL ON TABLE "public"."admin_users" FROM anon;
REVOKE ALL ON TABLE "public"."admin_users" FROM authenticated;

-- Step 3 (optional, belt+suspenders): Explicit deny policy
-- Not required — no RLS policies = no access for anon/authenticated even if grants exist.
-- But if you want explicit documentation in pg_policies:
-- CREATE POLICY "deny_all" ON "public"."admin_users" AS RESTRICTIVE
--   FOR ALL TO PUBLIC USING (false);
```

**Rollback:**
```sql
REVOKE ALL ON TABLE "public"."admin_users" FROM anon;  -- if accidentally re-granted
ALTER TABLE "public"."admin_users" DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."admin_users" TO anon;
GRANT ALL ON TABLE "public"."admin_users" TO authenticated;
```

---

### Priority 2 — Fix F2: Replace hardcoded email in `orders` policies

Three options, ordered by complexity:

**Option B (simplest — update the constant, not the pattern):**
If the owner's Supabase Auth email will never change and staff will never need direct DB access, update the hardcoded email to match current state and document the fragility. Minimal risk, minimal work.

```sql
-- Only do this if pavlemitrovic01@gmail.com is still the current Auth email.
-- No change needed if baseline is current.
-- Document: "orders RLS is owner-only-email gate; update manually on email change."
```

**Option A (correct — use admin_users for membership check):**
Requires `allow_self_read` policy on `admin_users` first (authenticated users must see their own row for the subquery to resolve).

```sql
-- Prerequisite: add self-read policy on admin_users (only if F1 remediation is applied first)
CREATE POLICY "allow_self_read" ON "public"."admin_users"
  FOR SELECT TO "authenticated"
  USING ("email" = (auth.jwt() ->> 'email') AND "enabled" = true);

-- Drop old hardcoded policies
DROP POLICY "allow_admin_select_by_email" ON "public"."orders";
DROP POLICY "allow_admin_update_by_email"  ON "public"."orders";
DROP POLICY "allow_admin_delete_by_email"  ON "public"."orders";

-- Create new policies using admin_users membership
CREATE POLICY "allow_admin_select" ON "public"."orders"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email" = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  );

CREATE POLICY "allow_admin_update" ON "public"."orders"
  FOR UPDATE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email" = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email" = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  );

CREATE POLICY "allow_admin_delete" ON "public"."orders"
  FOR DELETE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email" = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  );
```

**Option C (defer F2 — accept current orders RLS as-is):**
Since all admin API endpoints bypass RLS via service_role, the hardcoded email policies have no production effect. F2 is a correctness/consistency issue, not an active exploit. Acceptable to defer F2 and prioritize F1.

**Recommended approach:** Implement Option C for F2 (defer) and focus the execution batch exclusively on F1 (the CRITICAL finding).

---

## Follow-up Recommendation

Schedule a **separate STRICT execution batch** (proposed ID: **B14.1**) with these constraints:

| Gate | Requirement |
|------|-------------|
| Pre-batch | Run live verification queries above; confirm F1 findings against production |
| Branch | Per-batch branch (STRICT tier, schema change) |
| Scope | F1 only (admin_users ENABLE RLS + REVOKE grants) — do NOT bundle F2 |
| Migration | New file in `supabase/migrations/` with timestamp (DO NOT edit baseline) |
| Verify | Re-run verification queries after apply; check admin UI smoke (login, order list) |
| Rollback | Rollback SQL ready before starting |

F2 (orders hardcoded email) is optional follow-up — acceptable as B14.2 or long-term deferral per Option C above.

---

*B14 audit closed 2026-05-16. No code or schema changes made in this batch.*
