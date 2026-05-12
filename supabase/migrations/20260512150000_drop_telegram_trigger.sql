-- B15: DROP dead Telegram trigger from orders table.
-- Trigger called https://padrino-pizzeria.vercel.app/api/telegram-new-order
-- which returns 401 (Vercel Deployment Protection). Confirmed non-functional
-- via 3 production orders 2026-05-11. Active Telegram flow runs via
-- api/create-order.ts server-to-server (see RUNBOOK §1).

DROP TRIGGER IF EXISTS "telegram-new-order" ON "public"."orders";
