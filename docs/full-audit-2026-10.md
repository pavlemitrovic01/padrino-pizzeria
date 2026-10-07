# Full Audit — Padrino Pizzeria (2026-10-06)

**Tip:** read-only audit (kod + prod DB read-only SQL + PoC testovi protiv handler-a)
**Baza za program:** Faza S (B22–B26) u `workflow/projects/padrino/ROADMAP.md`
**Status:** OPEN — nalazi se zatvaraju kroz B22–B26

---

## Verdict

Sajt radi (804 porudžbine ukupno, ~100/mesec), build/typecheck/test zeleni.
Ali server **ne štiti ono što dokumentacija tvrdi da štiti**:

- tabelu `orders` može da piše bilo ko sa javnim anon ključem (prod potvrđeno),
- `create-order` prihvata klijentske količine, cenu dostave i nazive stavki,
- postoji živ bug koji od ~aprila 2026 odbija porudžbine „50 cm + punjene ivice".

Tvrdnje u TEMPLATE.md / CONTEXT.md / ROADMAP.md („RLS closed", „server-side
price validation verified correct", „no file >800 LOC", „security headers u
vercel.json") su netačne ili nepotpune. Realna ocena: ~5/10 dok se B22–B24 ne zatvore.

## Šta je pokrenuto (evidence)

| Komanda / provera | Rezultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 — 22 fajla, 267 testova |
| `npm run build` | exit 0 |
| `npm run lint` | **exit 1** — 2 errors (`api/telegram-new-order.test.ts:47,75` unused vars) + 1 warning (`CartProvider.tsx:290` unused eslint-disable) |
| PoC vitest protiv `api/create-order.ts` (privremen, obrisan) | 5/5 napada prošlo — vidi §PoC |
| Prod Supabase read-only SQL (`pg_policies`, grants, constraints, agregati bez PII) | vidi nalaze #1, #6, #7 |
| Supabase security advisor | 2× mutable search_path, leaked password protection OFF |
| Vercel env (PUBLIC_SITE_URL, TELEGRAM_WEBHOOK_SECRET, UPSTASH_*) | **NIJE VERIFIKOVANO** — 403 na Vercel scope |
| HTTP ka prod (headers, telegram endpoint) | **NIJE VERIFIKOVANO** — sandbox proxy blokira |

---

## KRITIČNO

### #1 Anon INSERT u `orders` — prod potvrđeno → B22
- Politika `"Allow insert orders for anon+authenticated"` FOR INSERT TO anon, authenticated `WITH CHECK (true)` živa na prod-u.
- `anon` i `authenticated` imaju `INSERT, UPDATE, DELETE, TRUNCATE, SELECT, ...` grant na `orders`, `menu_items`, `site_settings`.
- Anon ključ je u JS bundle-u → `POST /rest/v1/orders` sa proizvoljnim `total_eur_cents`, `payment_status='paid'`, bilo kojim `status`, mimo radnog vremena, rate limita i cele `create-order` validacije.
- Frontend NIKAD ne piše u `orders` direktno (grep `src/`: samo `from("menu_items")` i `from("site_settings")`, SELECT) → revoke je bezbedan.
- B14 RLS audit (`docs/rls-security-audit.md`) ovo nije uhvatio.
- Na `orders.status` NEMA CHECK constraint-a; postoje samo `payment_method` i `payment_status` CHECK.

### #2 Količina se ne validira — PoC → B23
- `api/create-order.ts:1074` — `safeInt` (`api/_shared/parsing.ts`) prihvata razlomke (trunc) i negativne brojeve.
- Filter `calcItems` (`create-order.ts:1038-1045`) traži samo `typeof quantity === "number"`.
- Telegram (`api/telegram-new-order.ts:282,311`) i admin resend prikazuju `Math.max(1, safeInt(qty))` → kuhinja vidi „1x".
- PoC (pica 15 €, Coca-Cola 2,50 €): `pizza×0.99 + cola×1` → 2,50 €; `pizza×2 + cola×−10` → 5,00 €.

### #3 Naplata po ID-u, kuhinja vidi klijentski tekst — PoC → B23
- Cena = `priceMap.get(menu_item_id)`; ali `name`, `size`, `category`, addon `name` idu u `orders.items` i Telegram onako kako ih klijent pošalje.
- PoC: `menu_item_id = cola`, `name = "Pizza Padrino"`, `size = "50"` → 200, naplaćeno 2,50 €, sačuvano „Pizza Padrino".

### #4 Cena dostave je klijentska — PoC → B23
- Frontend nikad ne šalje lat/lng; `delivery_zones` tabela ne postoji (B2 audit).
- Server čita dostavu regexom iz slobodnog teksta META note-a: `getDeliveryFeeCentsFromMeta` (`create-order.ts:340`), `"Dostava: X"`.
- PoC: `"Zona: Petrovac, Dostava: 0"` → prihvaćeno, total bez dostave.
- Min. iznos za besplatnu dostavu (`DELIVERY_ZONES.minCents`) postoji samo na klijentu.
- B2 audit (`docs/delivery-fee-audit.md`) „CLEAN" — proveravao happy path, ne hostile klijenta.

### #5 Origin trust → curenje Telegram tajne — PoC (kod), prod neverifikovan → B22 (+B24 strukturno)
> **Korekcija (B22 close, 2026-10-07):** NIJE bio iskoristiv na produkciji — `PUBLIC_SITE_URL` i `TELEGRAM_WEBHOOK_SECRET` su već bili postavljeni u Vercel-u (All Environments), a env ima prednost nad `Origin`-om. Rupa je postojala samo u kodu; B22 je zatvorio i nju.
- `api/_shared/public-url.ts` `resolvePublicBaseUrl`: ako nema `PUBLIC_SITE_URL|SITE_URL|APP_URL|NEXT_PUBLIC_SITE_URL`, uz `trustOriginHeader: true` koristi `Origin` header.
- Pozivi sa `trustOriginHeader: true`: `create-order.ts:401` (Telegram notify), `create-order.ts:620` (Bankart URLs), `bankart-order-status.ts:105`.
- PoC: `Origin: https://attacker.example` → server POST na `https://attacker.example/api/telegram-new-order` sa headerom `x-telegram-secret: <TELEGRAM_WEBHOOK_SECRET>`.
- `telegram-new-order.ts:389` — ako `TELEGRAM_WEBHOOK_SECRET` nije postavljen, endpoint je otvoren: napravi card porudžbinu, ne plati, pozovi endpoint → kuhinji stiže „Nova porudžbina … Plaćanje: Kartica".
- README/RUNBOOK/.env.example vode `PUBLIC_SITE_URL` i `TELEGRAM_WEBHOOK_SECRET` kao „opcione" — uz ovaj kod su bezbednosno obavezne.

## VISOKO — živ bug koji košta novac

### #6 50 cm + „Ivice punjene sirom" → `400 Total mismatch` → B23
- Klijent: `stuffedCrustPriceForSize` (`src/lib/cartDrawerHelpers.ts`) = 400 za 50 cm; primenjuje se u `adjustAddonsForSize` (`src/context/CartProvider.tsx`) pri `normalizeIncomingItem`.
- Prod DB: jedan red „Ivice punjene sirom", `dodaci`, `price_eur_cents = 200`.
- Server računa addon po ID-u = 200 → razlika ≥ 200 → `Total mismatch` (`create-order.ts:1102`).
- Prod agregat (stavke u `orders.items`):

| mesec | stavke 50 cm | 50 cm + ivice | 33 cm + ivice |
|---|---|---|---|
| 2026-01 | 1 | 1 | 3 |
| 2026-02 | 12 | 7 | 13 |
| 2026-03 | 1 | 1 | 9 |
| 2026-04 | 7 | 0 | 14 |
| 2026-05 | 4 | 0 | 7 |
| 2026-06 | 26 | 0 | 11 |
| 2026-07 | 49 | 0 | 11 |
| 2026-08 | 52 | 0 | 35 |
| 2026-09 | 39 | 0 | 24 |

- Dodatno: `MenuItemDetailSheet.tsx:217-220` računa `basePrice * pizzaQty + addonsSum` (dodaci se ne množe sa qty); korpa (`useDeliveryZone.ts` subtotal) i server računaju `(base + addons) × qty` → dugme i korpa pokazuju različite cene za qty > 1.

## SREDNJE

| # | Nalaz | Lokacija | Batch |
|---|---|---|---|
| 7 | `status` i `currency` od klijenta; `currency` ide u Bankart. Prod: 1 porudžbina sa statusom `"pending\n"` (2026-02-02) → `admin-update-order-status` vraća 500 „Order has invalid status in DB" | `create-order.ts:998-999` | B22 (CHECK) + B23 (server-fixed) |
| 8 | Bankart callback ne proverava amount/currency; zakasneli DEBIT PENDING vraća `paid → pending` | `bankart-callback.ts:369` (+ `bankart-order-status.ts` analogno) | B24 |
| 9 | Nema idempotency ključa na `create-order`; Telegram self-HTTP poziv se sinhrono čeka do 12 s → timeout + retry = duplikat | `create-order.ts:400-423,1143` | B24 |
| 10 | Sirove greške ka klijentu (suprotno LESSON L5) | `telegram-new-order.ts:406,458`, `bankart-order-status.ts:489`, `bankart-callback.ts` catch | B24 |
| 11 | Nula security headera (CONTEXT.md tvrdi suprotno); nema CSP-a na stranici sa Payment.js poljima + GTM (PCI DSS 4.0 §6.4.3/§11.6.1); GA4 bez consent-a | `vercel.json`, `index.html:46-55` | B25 |
| 12 | `/api/log` otvoren, `context` bez size limita (komentar tvrdi da CORS štiti — ne štiti od non-browser poziva) | `api/log.ts` | B25 |
| 13 | `payments-create-session` edge funkcija je no-op (cash: samo „ok"; card: zastareli „NLB pending" 501), poziva se fire-and-forget na svaku cash porudžbinu | `supabase/functions/payments-create-session/index.ts`, `create-order.ts:425-448,1144` | B24 |

## NISKO

- `GRANT ALL` (uklj. TRUNCATE) za anon/authenticated na sve public tabele — RLS jedini zid → B22.
- Supabase advisor: mutable `search_path` na `set_total_price`, `set_site_settings_updated_at` → B22. Leaked password protection OFF (dashboard) → B22 ručno.
- `signInWithOtp` bez `shouldCreateUser: false` (`src/pages/admin/AdminLogin.tsx:265`) → B22.
- Admin image upload prima `image/svg+xml` (`api/admin-menu.ts` ~297-306) → B25.
- Prljavi menu podaci: kategorija `"sosevi\n"`, imena sa trailing space („Pelat ", „Slatko Ljuti "). Hipoteza (nedokazano): veza sa React duplicate-key greškom u meniju → B25.
- Lint crven; `/close` ne gate-uje lint → B25 (fix) + B26 (gate).
- Slike: `public/sections/contact.webp` 379 KB, `hero.webp` 353 KB (LCP), `public/menu/krofna.webp` 293 KB; `public/hero.jpg` nekorišćen → B25.

## Kod / arhitektura → B26 (osim gde piše drugačije)

- **Koren:** napomena, plaćanje, zona i cena dostave šalju se kao lažna „META" stavka u `items`, slobodan tekst koji server parsira regexom. Novac se izvodi iz ljudskog teksta. → B23 uvodi prave kolone (`delivery_fee_cents`, `delivery_zone`), B26 briše stari write-path.
- `api/create-order.ts` 1191 LOC (TEMPLATE.md tvrdi „no file >800 LOC").
- `buildSupabaseAdmin` / `json` / `getEnv` / `headerString(CI)` kopirani u svaki handler.
- Telegram formatter (~250 LOC) dupliran: `api/telegram-new-order.ts` i `api/admin-orders.ts` → B24 (`api/_shared/telegram.ts`).
- Mrtav kod u lock zoni: GPS/poligon (`fetchZones`, `isPointInPolygon`, `parseLatLngFromBody`), `NLB_*` env aliasi, `SUPABASE_SERVICE_KEY|SUPABASE_SERVICE_ROLE` aliasi.
- Cene ivica hardkodovane u klijentu (200/400) — duplikat baze, direktan uzrok #6 → B23.
- Vercel Hobby cap: 11/12 funkcija zauzeto (`api/*.ts` bez testova) — novi endpoint praktično nemoguć; B24 brisanjem `telegram-new-order` oslobađa 1.

## Testovi

- 267 zelenih testova, ali E1 „hostile-input" (`src/lib/createOrderEndpoint.test.ts`) pokriva samo pogrešan total i pogrešan `price_per_item`.
- Nepokriveno: količina, dostava, name/ID swap, status, currency, Origin.
- Supabase mock builder ignoriše `.eq/.in` filtere → ne hvata greške u upitima.
- Nema client↔server parity testa (isti cart → isti total) — on bi uhvatio #6. → B23.

## Proces (workflow v3) → B26

- ~9.000 linija procesnih dokumenata (workflow/, docs/, skills, TEMPLATE/RUNBOOK/README) naspram ~19.400 linija ne-test koda; 31/68 vidljivih commit-a su `workflow:` (7 samo SHA backfill).
- Ceremonija daje osećaj sigurnosti koji ne odgovara stvarnosti: TEMPLATE.md „RLS closed, CORS locked, no file >800 LOC, hostile-input tests" — netačno / ne štiti server / netačno / nepotpuno. Self-score 8.5/10 nije zaslužen.
- Lock zone konzerviraju fajlove koje niko nije adversarijalno pregledao.
- Drift u trenutku audita: STATE.md „B21 čeka merge" (a `origin/main` = `f4fb32d Merge B21`); STATE kandidati (`changeSize`, `setPizzaSizeSafe`, `addDrinkToCart`) već obrisani u B21; CONTEXT.md 17/206 testova (stvarno 22/267), lažna tvrdnja o security headerima, lock lista ≠ STATE.md (CartView/CardFields).
- LESSON L9 (checkout/admin se ne mogu testirati lokalno) → novčani tok se verifikuje samo na preview/prod.

## Šta je dobro (zadržati)

- Bankart callback: HMAC-SHA512 + `timingSafeEqual` + date skew provera.
- B18 idempotentna Telegram notifikacija (atomski claim na `telegram_notified_at`).
- Admin API: server-side provera preko service_role, uloge owner/staff, last-owner guard, optimistic concurrency na promeni statusa.
- Business hours fail-open sa jasnim obrazloženjem; strict TypeScript; `admin_users` RLS popravljen (B14.1).

---

## PoC (rekonstruisati kao regresione testove u B23)

Harness: isti kao `src/lib/createOrderEndpoint.test.ts` (mock `@supabase/supabase-js`,
`menu_items` = `[{id:"pizza",price_eur_cents:1500},{id:"cola",price_eur_cents:250}]`,
`process.env.TELEGRAM_WEBHOOK_SECRET` postavljen, `PUBLIC_SITE_URL` obrisan, `fetch` stub).
Base body: `{customer_name:"Napadac", customer_phone:"0671234567", customer_address:"Jadranski put 1", payment_method:"cash"}`.

| Napad | items / extra | Rezultat (pre fix-a) | Očekivano posle B23/B22 |
|---|---|---|---|
| fractional qty | pizza `quantity: 0.99` + cola `quantity: 1` | 200, total 250 | 400 |
| negative qty | pizza `2` + cola `-10` | 200, total 500 | 400 |
| name/ID swap | `menu_item_id:"cola", name:"Pizza Padrino", size:"50"` | 200, total 250, ime sačuvano | 200, ali sačuvano ime/size iz DB-a (Coca-Cola) |
| fee 0 | META note `"Zona: Petrovac, Dostava: 0"` | 200, total 1500 (bez dostave) | fee iz serverske zone |
| status/currency | body `status:"done"`, `currency:"XYZ"` | 200, sačuvano `done` / `XYZ` | sačuvano `pending` / `EUR` |
| Origin SSRF | header `origin: https://attacker.example` | fetch na `https://attacker.example/api/telegram-new-order` sa `x-telegram-secret` | nema fetch-a ka Origin-u (B22), nema self-HTTP uopšte (B24) |

---

## Plan sanacije — Faza S

Detalji, redosled i zavisnosti: `workflow/projects/padrino/ROADMAP.md` → „Faza S".

| ID | Tema | Tier |
|---|---|---|
| B22 | Zaključavanje baze i tajni | STRICT |
| B23 | Server je jedini izvor cene (+ fix 50 cm ivice) | STRICT |
| B24 | Plaćanje i notifikacije — robusnost | STRICT |
| B25 | Frontend hardening, performanse, menu podaci | STANDARD |
| B26 | Čišćenje koda i istina u dokumentaciji | STRICT |
