-- B14.1: F1 remediation — enable RLS on admin_users + revoke anon/authenticated grants.
-- Source: docs/rls-security-audit.md (B14, finding F1 — CRITICAL).
--
-- Problem: admin_users (the admin allowlist) had NO row-level security and
-- GRANT ALL to "anon". The Supabase anon key is public (ships in the frontend
-- bundle), so anyone could read/insert/update/delete the admin allowlist via
-- PostgREST (privilege escalation + admin DoS). Confirmed against live DB.
--
-- Anti-regression: every admin_users access path uses the service_role key,
-- which bypasses RLS unconditionally:
--   - api/admin-users.ts        (buildSupabaseAdmin → SERVICE_ROLE)
--   - api/_shared/admin-auth.ts (caller passes service_role client)
--   - supabase/functions/payments-create-session does NOT touch admin_users
--   - frontend src/ has ZERO .from("admin_users") (UI strings only)
-- => enabling RLS + revoking anon/authenticated grants breaks no code path.
--
-- Apply: run these statements in the Supabase dashboard SQL editor.
-- Do NOT use `supabase db push` — the 20260510 baseline is a db-pull snapshot
-- that may have drifted from live; pushing could attempt a full reconcile.
--
-- F2 (orders hardcoded-email policies) is intentionally NOT addressed here —
-- deferred per audit Option C (vestigial; service_role bypasses it).

alter table "public"."admin_users" enable row level security;

revoke all on table "public"."admin_users" from "anon";
revoke all on table "public"."admin_users" from "authenticated";

-- Rollback (if a regression appears):
--   alter table "public"."admin_users" disable row level security;
--   grant all on table "public"."admin_users" to "anon";
--   grant all on table "public"."admin_users" to "authenticated";
