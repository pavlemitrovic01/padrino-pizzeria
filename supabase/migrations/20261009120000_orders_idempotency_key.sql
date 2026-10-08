-- B24 (audit #9): one checkout attempt = one order.
--
-- The cart sends a random key per checkout attempt and reuses it when it
-- resends the same order (e.g. after a timeout hid a response that had in fact
-- succeeded). api/create-order.ts stores it here and answers a repeated key
-- with the first order instead of inserting a second one.
--
-- Additive and safe to apply before or after the code: the code takes the
-- order without the key if this column does not exist yet.
--
-- Rollback:
--   drop index if exists public.orders_idempotency_key_key;
--   alter table public.orders drop column if exists idempotency_key;

alter table public.orders add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_key
  on public.orders (idempotency_key)
  where idempotency_key is not null;
