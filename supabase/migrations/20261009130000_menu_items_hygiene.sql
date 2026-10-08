-- B25 (audit, nisko): menu data hygiene. Written, NOT applied — apply with
-- Pavle's OK (any order relative to the code: nothing in the code depends on it).
--
-- Prod 2026-10-08: category "sosevi\n" (Slatko Ljuti), names with a trailing
-- space ("Pelat ", "Slatko Ljuti "), descriptions with trailing spaces, and two
-- broken image paths: "public/menu/pomodoro.webp" (Don Pomidoro 33 cm — the
-- public/ prefix is not part of the URL) and "/extras/rub.webp" (Ivice punjene
-- sirom — public/extras/ does not exist; the same picture is /menu/rub.webp).
-- The admin editor already trims new writes (api/admin-menu.ts).
--
-- Not changed: "/extras/sos.webp" (Sosevi) — there is no sauce picture in
-- public/ to point it at; the cart falls back to its name-based image.
--
-- Rollback: values before (from the 2026-10-08 SELECT):
--   update menu_items set category = E'sosevi\n', name = 'Slatko Ljuti ' where id = 'b2242f06-e644-4e8f-bb9a-52b7072aab9a';
--   update menu_items set name = 'Pelat ' where id = '87640f32-7485-4af4-ae4b-95bb4b800da0';
--   update menu_items set image = 'public/menu/pomodoro.webp' where id = '38ec511d-2dff-423b-a828-2309ecddbca3';
--   update menu_items set image = '/extras/rub.webp' where id = '1e0953dd-ac1f-4a2d-b846-69d580fedc80';

update public.menu_items
   set name = btrim(name, E' \t\r\n')
 where name <> btrim(name, E' \t\r\n');

update public.menu_items
   set category = btrim(category, E' \t\r\n')
 where category <> btrim(category, E' \t\r\n');

update public.menu_items
   set description = btrim(description, E' \t\r\n')
 where description is not null and description <> btrim(description, E' \t\r\n');

update public.menu_items set image = '/menu/pomodoro.webp' where image = 'public/menu/pomodoro.webp';
update public.menu_items set image = '/menu/rub.webp' where image = '/extras/rub.webp';
