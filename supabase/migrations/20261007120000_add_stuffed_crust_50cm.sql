-- B23a: Stuffed crust for 50 cm pizza gets its own menu_items row (4 €)
-- Batch: B23a (STRICT) | Date: 2026-10-07
-- Ref: 50 cm + "Ivice punjene sirom" orders failed with "Total mismatch"
--
-- The server prices an addon by its menu_items id. There was one stuffed
-- crust row (2 €) while the cart charged 4 € on 50 cm, so no 50 cm + crust
-- order has gone through since April. The cart now sends the row matching the
-- pizza size; this adds the 50 cm row. Its name must keep "50 cm" — that is
-- how the client tells the two crust rows apart.
--
-- DEPLOY ORDER: code first, then this migration. Without the row the new
-- client simply offers no crust on 50 cm; the old client, seeing this row,
-- would list both crusts on every pizza.
--
-- Idempotent: re-running inserts nothing. `price` mirrors `price_eur_cents`,
-- as on the existing addon rows.

INSERT INTO public.menu_items (name, description, category, price, price_eur_cents, image, is_active, sort_order)
SELECT 'Ivice punjene sirom 50 cm', 'Ivice punjene sirom (50 cm)', 'dodaci', 400, 400, '/extras/rub.webp', true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items WHERE name = 'Ivice punjene sirom 50 cm'
);
