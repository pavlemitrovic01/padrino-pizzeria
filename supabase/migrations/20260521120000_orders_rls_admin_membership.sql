-- I1: Replace hardcoded email in orders RLS policies with admin_users membership check
-- Batch: I1 (STRICT) | Date: 2026-05-21
-- Prerequisite: B14.1 applied (admin_users.rowsecurity=true, anon/authenticated grants revoked)
-- Ref: docs/rls-security-audit.md Finding F2, Option A
--
-- Live verification (Korak 0) confirmed 2026-05-21:
--   orders:      allow_admin_delete_by_email, allow_admin_select_by_email,
--                allow_admin_update_by_email present
--   admin_users: no policies (allow_self_read not yet added)
-- Safe to apply.

-- Step 1: Allow authenticated admins to read their own row in admin_users
--         Required so the EXISTS subquery in orders policies can resolve.
--         Scope: email = jwt.email AND enabled = true (own row only, admins only)
CREATE POLICY "allow_self_read" ON "public"."admin_users"
  FOR SELECT TO "authenticated"
  USING ("email" = (auth.jwt() ->> 'email') AND "enabled" = true);

-- Step 2: Drop old hardcoded-email policies on orders
DROP POLICY "allow_admin_delete_by_email" ON "public"."orders";
DROP POLICY "allow_admin_select_by_email"  ON "public"."orders";
DROP POLICY "allow_admin_update_by_email"  ON "public"."orders";

-- Step 3: Create membership-based policies using admin_users lookup
CREATE POLICY "allow_admin_select" ON "public"."orders"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email"   = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  );

CREATE POLICY "allow_admin_update" ON "public"."orders"
  FOR UPDATE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email"   = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email"   = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  );

CREATE POLICY "allow_admin_delete" ON "public"."orders"
  FOR DELETE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."admin_users" au
      WHERE au."email"   = (auth.jwt() ->> 'email')
        AND au."enabled" = true
    )
  );

-- =============================================================
-- ROLLBACK (save for reference — DO NOT apply unless reverting)
-- =============================================================
-- DROP POLICY "allow_self_read"    ON "public"."admin_users";
-- DROP POLICY "allow_admin_select" ON "public"."orders";
-- DROP POLICY "allow_admin_update" ON "public"."orders";
-- DROP POLICY "allow_admin_delete" ON "public"."orders";
--
-- CREATE POLICY "allow_admin_select_by_email" ON "public"."orders"
--   FOR SELECT TO "authenticated"
--   USING ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com');
--
-- CREATE POLICY "allow_admin_update_by_email" ON "public"."orders"
--   FOR UPDATE TO "authenticated"
--   USING  ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com')
--   WITH CHECK ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com');
--
-- CREATE POLICY "allow_admin_delete_by_email" ON "public"."orders"
--   FOR DELETE TO "authenticated"
--   USING ((auth.jwt() ->> 'email') = 'pavlemitrovic01@gmail.com');
