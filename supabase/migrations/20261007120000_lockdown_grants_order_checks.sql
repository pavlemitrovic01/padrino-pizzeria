-- B22: lock down public grants + order CHECK constraints.
-- Source: docs/full-audit-2026-10.md (#1 CRITICAL, #7, advisor search_path).
--
-- Problem: "Allow insert orders for anon+authenticated" (WITH CHECK true) plus
-- GRANT ALL to anon let anyone holding the public anon key (it ships in the
-- frontend bundle) insert rows straight into public.orders via PostgREST —
-- any total, payment_status 'paid', any status — bypassing api/create-order
-- (price validation, business hours, rate limit). Confirmed against live DB
-- 2026-10-06. orders.status and orders.currency had no CHECK at all; one live
-- row has status 'pending\n'.
--
-- Anti-regression: every write path uses the service_role key, which bypasses
-- RLS and these grants unconditionally:
--   - api/create-order.ts, api/bankart-callback.ts, api/bankart-order-status.ts,
--     api/telegram-new-order.ts, api/admin-*.ts (buildSupabaseAdmin → SERVICE_ROLE)
--   - frontend src/ only READS menu_items + site_settings (SELECT kept);
--     zero .from("orders") in src/
--   - the pg_net "telegram-new-order" trigger was dropped in 20260512150000
-- Status values: api/admin-update-order-status.ts isOrderStatus() —
-- pending | preparing | done | cancelled; create-order/bankart-* only write
-- 'pending' / 'cancelled'. Currency: frontend always sends 'EUR'.
--
-- Apply: Supabase MCP apply_migration after project identity check
-- (pwkqyoaofcbwsecawrjz), or the dashboard SQL editor.
-- Do NOT use `supabase db push` — the 20260510 baseline is a db-pull snapshot
-- that may have drifted from live.

-- 1) Close direct writes from the public key.
drop policy if exists "Allow insert orders for anon+authenticated" on "public"."orders";

revoke insert, update, delete, truncate, references, trigger
  on table "public"."orders", "public"."menu_items", "public"."site_settings"
  from "anon", "authenticated";

revoke select on table "public"."orders" from "anon";

-- 2) Normalize the one malformed status, then constrain status + currency.
update "public"."orders"
  set "status" = btrim("status", E' \t\r\n')
  where "status" <> btrim("status", E' \t\r\n');

alter table "public"."orders"
  add constraint "orders_status_check"
  check ("status" = any (array['pending'::text, 'preparing'::text, 'done'::text, 'cancelled'::text]));

alter table "public"."orders"
  add constraint "orders_currency_check"
  check ("currency" = 'EUR'::text);

-- 3) Pin search_path on trigger functions (Supabase advisor 0011).
alter function "public"."set_total_price"() set search_path = '';
alter function "public"."set_site_settings_updated_at"() set search_path = '';

-- Rollback (if a regression appears):
--   alter function "public"."set_site_settings_updated_at"() reset search_path;
--   alter function "public"."set_total_price"() reset search_path;
--   alter table "public"."orders" drop constraint if exists "orders_currency_check";
--   alter table "public"."orders" drop constraint if exists "orders_status_check";
--   grant select on table "public"."orders" to "anon";
--   grant insert, update, delete, truncate, references, trigger
--     on table "public"."orders", "public"."menu_items", "public"."site_settings"
--     to "anon", "authenticated";
--   create policy "Allow insert orders for anon+authenticated"
--     on "public"."orders" as permissive for insert
--     to "anon", "authenticated" with check (true);
