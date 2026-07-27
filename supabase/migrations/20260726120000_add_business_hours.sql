-- B19: Add business hours gate columns to site_settings
-- Batch: B19 (STRICT) | Date: 2026-07-26
-- Ref: gate order creation to admin-configured business hours
--
-- orders_open_time / orders_close_time define the single daily window
-- (same every day) during which the site accepts orders. NULL/NULL means
-- no window configured yet — the gate treats that as fail-open (always
-- open), so this migration is a behavioral no-op until Pavle sets values
-- via /admin/settings.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS orders_open_time time NULL,
  ADD COLUMN IF NOT EXISTS orders_close_time time NULL;
