-- B18: Add telegram_notified_at idempotency column to orders
-- Batch: B18 (STRICT) | Date: 2026-07-12
-- Ref: fix duplicate Telegram new-order notification on card payments
--
-- Problem: card payments can trigger /api/telegram-new-order from up to 3 sources
--   for the SAME transaction — create-order (returnType FINISHED),
--   bankart-callback (server-to-server webhook), and bankart-order-status
--   (frontend status poll). The old `payment_status !== 'paid'` guard in each
--   caller is read-then-act (TOCTOU) and not atomic across concurrent callers,
--   so two callers can both pass the guard → duplicate Telegram message.
--   (No double charge — all three confirm the one Bankart transaction.)
--
-- Fix: telegram-new-order claims the send with a conditional UPDATE
--   (SET telegram_notified_at = now() WHERE id = ? AND telegram_notified_at IS NULL
--    RETURNING id). Postgres row-level lock serializes concurrent callers, so
--   exactly one flips NULL→now() and sends; the rest get 0 rows and no-op.
--
-- Safety: nullable, no default, no backfill → instant DDL, fully backward-
--   compatible. Old code ignores the column; existing rows stay NULL and are
--   never re-notified (no caller fires for historical orders).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz;
