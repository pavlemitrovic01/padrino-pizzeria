# LOG.md — Batch Audit Trail

> Append-only. Updated via /close skill.
> Most recent at top.

---

## B20 — 2026-07-27 — Cart line identity (33 cm i 50 cm kao odvojeni redovi) — DONE

**Tier:** STRICT
**SHA:** 27a7b51
**Branch:** batch/b20-cart-line-identity (per-batch, STRICT)
**Files (3):**
  - src/lib/cartDrawerHelpers.ts — +69 LOC. `buildCartLineId({identity,size,addons,note})` → `<identity>|<size>|<variant-hash>`; `cartAddonsFingerprint` (sortirani `id:qty`, BEZ cene — `adjustAddonsForSize` prepisuje cenu punjenih ivica pri promeni veličine, pa bi ključ sa cenom migao pod redom koji kupac nije dirao); FNV-1a 32-bit hash za addons+note (length-prefixed input) tako da `cart_id` koji ide na server ostane kratak i bez kupčevog teksta.
  - src/context/CartProvider.tsx — LOCK ZONE. +77/-100 LOC. `normalizeIncomingItem` više ne prepisuje `id` u `baseKey` — obe grane (pizza i ne-pizza) vraćaju kroz novi `withLineId()`. `addToCart` merge grana pala sa ~90 na 8 linija: poklopljen ključ = identična konfiguracija, menja se SAMO količina. `updateItemInCart` dobio merge-on-collision. `changeSize` + svih 5 addon/note mutatora re-derivuju ključ. GA4 `add_to_cart`/`remove_from_cart` sada šalju `menuItemId` umesto row key-a.
  - src/context/CartProvider.test.tsx — NEW (18 testova), PRVI CartProvider testovi u repo-u. Pokriva: 33+50 odvojeni redovi (oba redosleda), identičan izbor se stakuje, dodaci se NE udvostručuju pri stakovanju, različiti dodaci/napomena/količina dodatka = novi red, redosled klikanja dodataka nebitan, per-red increase/decrease/remove, edit re-key + merge-on-collision, piće (ne-pizza grana), GA4 item_id.
**Verify:**
  build:     PASS(machine) — exit 0, vite (2026-07-27)
  typecheck: PASS(machine) — exit 0, tsc -b
  test:      PASS(machine) — exit 0, 22 fajla / 269 testova (+18 B20)
  manual:    PASS(human) — smoke u živoj app (localhost:5173, dev server): 3× Margherita 33 cm → JEDAN red qty 3; 50 cm → SVOJ red, 16,00 €; "Stavki: 4". Pavle: "okej je moze merge i close push".
  lint:      exit 1 — SAMO nasleđeni problemi, nijedan iz ovog batch-a: 2 greške u `api/telegram-new-order.test.ts` (nedirnut fajl, iz B18) + 1 warning "unused eslint-disable no-console" u CartProvider.tsx koji je postojao u originalu (`no-console` nije konfigurisan u `eslint.config.js`).
  code-review:     SKIPPED — Pavle izabrao direktan close.
  security-review: NIJE POKRENUTO — batch ne dira payment/Bankart/RLS fajlove (cena se i dalje računa server-side po `menu_item_id`).
**SCOPE_DRIFT:** none — 3 fajla = EXPECTED-FILES exact match (`git diff --name-only HEAD~1..HEAD` verifikovan).
**Notes:** Zahtjev (ad-hoc bug report, ROADMAP row N/A): "ne može se poručiti 50 cm i 33 cm iste pice u jednoj porudžbini, stakuju se u korpi". Root cause: `normalizeIncomingItem` je prepisivao `id` svakog pizza reda u `baseKey` (ime bez veličine), a `addToCart` je matchovao red samo po `id`. Simptom je bio gori od "stakuju se": merge grana je računala `bestSize` iz POSTOJEĆE stavke, pa je 50 cm dodat preko 33 cm postajao još jedan 33 cm — server re-prices po `menu_item_id` koji ostaje od prve veličine, dakle pogrešan proizvod u kuhinju + pogrešna naplata u OBA smera (zavisno koja veličina je prva ušla). Iz istog uzroka padala su još dva money bug-a: (1) re-add identičnog izbora je unijao addon liste pa je druga pica nosila duplo sosa (dodaci su per-item i množe se količinom u `totalPrice`); (2) različita napomena je pregažena. Poreklo: pre L8.4 je korpa imala 33/50 toggle po redu, pa je jedan red po imenu BIO dizajn; L8.4 je toggle premestio u `MenuItemDetailSheet` i izbacio ga iz korpe, ali je `baseKey` identitet ostao — zaostatak refaktora, ne namerno pravilo. Bezbednost promene za server: `cart_id` se koristi samo kao "nije prazan" + "nije `meta`" (`telegram-new-order.ts:142`, `admin-orders.ts`), cena ide preko `menu_item_id` — kompozitni ključ ne dira pricing path. Korpa se ne perzistira (čist `useState`, nema localStorage) → nema migracije zatečenih korpi. Tokom smoke-a lažna uzbuna: činilo se da detail sheet guta ponovni "Dodaj" za istu picu — bio je artefakt test skripta (zaostali sheet u DOM-u, klikan stari CTA); sa čistim DOM-om sheet radi ispravno, nema drugog buga. Odloženo namerno (van scope-a, RULES §7): brisanje mrtvog koda `changeSize` + `setPizzaSizeSafe`/`addDrinkToCart` (nigde se ne konzumiraju od L8.4) → zaseban LEAN batch; `changeSize` je u ovom batch-u samo usklađen sa novim ključem da ne vrati bug ako se ponovo zakači. Uočeno u prolazu (nije iz ovog batch-a): React "Encountered two children with the same key" ×4 pri otvaranju menija + detail sheet-a, reprodukovano sa PRAZNOM korpom (dakle nije CartView) — kandidat su addon/sos/piće katalozi u `useCatalogData`; zaseban task.

---

## B19 — 2026-07-27 — Business hours gate (porudžbine samo u radnom vremenu) — DONE

**Tier:** STRICT
**SHA:** c58775b
**Branch:** batch/b19-business-hours-gate (per-batch, STRICT)
**Files (13):**
  - supabase/migrations/20260726120000_add_business_hours.sql — NEW. `orders_open_time` / `orders_close_time` (`time`, NULL, bez default-a) na `site_settings`. Aplicirano na prod (pwkqyoaofcbwsecawrjz) + verifikovano `time without time zone`, nullable, no default. Nullable je namerno: deploy je bihejvioralno NO-OP dok se vrijeme ne postavi u adminu.
  - api/_shared/business-hours.ts — NEW. `parseTimeToMinutes` (HH:MM i HH:MM:SS — PostgREST vraća sa sekundama), `nowMinutesInPodgorica` (Intl + `Europe/Podgorica`, DST-safe, nezavisno od UTC runtime-a i od sata kupca), `isWithinBusinessHours` (open<close normalan opseg; open>close prelazak ponoći; open===close = 24h), `formatHoursLabel`.
  - api/_shared/business-hours.test.ts — NEW (13 testova): granice, prelazak ponoći, DST jan+jul, fail-open na null/malformed, label format.
  - api/create-order.ts — LOCK ZONE. +42 LOC. `checkOrdersOpen()` + gate POSLE validacije payload-a, PRE `fetchMenuPricesCents`, PRE inserta i PRE `getBankartConfig()` → identično važi za cash i card. Zatvoreno → 409 `{code:"outside_business_hours"}`. Fail-open na DB error / missing row / exception (console.warn + propusti).
  - api/create-order.test.ts — prošireno sa 4 na 12 testova. Mock nadograđen na pun chainable builder (prati createOrderEndpoint.test.ts presedan) da bi vozio pravi handler: dokazuje da kod zatvorenog NEMA inserta u `orders` i da `fetch` NIJE pozvan (nema Bankart naplate, nema Telegrama).
  - api/admin-settings.ts — `orders_open_time`/`orders_close_time` u select + POST validaciji (`^([01]\d|2[0-3]):[0-5]\d$`, inače 400). Kad su oba poslata, `hours_display` se IZVODI server-side iz njih → prikaz ne može da odluta od kapije.
  - src/pages/admin/AdminSettings.tsx — dva `type="time"` inputa (Otvaranje/Zatvaranje) zamenila slobodan tekst `hours_display`; `hours_display` uklonjen iz EditorState (više se ne šalje) → derivacija je jedini pisac. Live preview + kartica u "Brzi pregled".
  - src/lib/businessHours.ts — NEW. Namerni mirror `api/_shared/business-hours.ts` preko api/src build granice (isti presedan kao parsing.ts). Klijentska kopija je UX-only.
  - src/lib/businessHours.test.ts — NEW (12 testova).
  - src/hooks/cart/useCheckoutForm.ts — postojeći `site_settings` select proširen (bez novog API poziva — B17 Vercel function-cap); izlaže `ordersOpen` + `hoursLabel`; 30s re-check da korpa otvorena preko granice zatvaranja ne ostane stale.
  - src/components/CartDrawer.tsx — LOCK ZONE. `ordersOpen` u `canConfirmOrder` + rani guard u `submitOrder()` sa istom porukom kao server.
  - src/components/CheckoutView.tsx — amber banner iznad forme kad je zatvoreno.
  - docs/db-schema-baseline.md — +2 reda + napomena da je `hours_display` sada derivat.
**Verify:**
  build:     PASS(machine) — exit 0, vite 7.3.1, built in 5.80s (2026-07-27)
  typecheck: PASS(machine) — exit 0, tsc -b
  test:      PASS(machine) — exit 0, 21 files / 251 tests (+45 B19)
  manual:    DEFERRED — UI smoke zahteva deploy (kao B18). Prod verifikacija posle merge+push.
  code-review:     SKIPPED — Pavle izabrao direktan close.
  security-review: SKIPPED — Pavle izabrao direktan close (uprkos preporuci; batch dira payment path).
**SCOPE_DRIFT:** none — 13 fajlova = EXPECTED-FILES exact match (diff verifikovan).
**Notes:** Zahtjev: "porudžbine samo u radnom vremenu koje je na sajtu, mijenja se kroz admin". Odabrano: admin open/close = JEDINI izvor istine (isto svaki dan, bez rasporeda po danima, bez ručnog pauza-prekidača — oboje eksplicitno van opsega). Ključna sigurnosna odluka: fail-open svuda — pogrešno konfigurisana kapija nikad ne smije da blokira pravu porudžbinu (bolje jedna zakasnela nego oboren prijem). **DEPLOY ORDER (kritično):** migracija MORA prije koda — obrnuto bi oborilo `/admin/settings` na 500 jer `getSelectableColumns()` traži kolone kojih nema. Migracija je već na produ, pa je merge bezbjedan u bilo kom trenutku. Pri planiranju otkriven i prijavljen STATE↔repo konflikt (STATE je tvrdio da b18 merge tek predstoji, a `git merge-base --is-ancestor` pokazao da je odavno u main-u; Pavle potvrdio da je B18 E2E smoke prošao). Lokalni smoke pokušan pa odustao — vidi L9 (dev frontend gađa prod API, CORS blokira localhost); LESSONS rotacija: L1 → DECISIONS (dokazano zastareo), L9 dodat.

---

## B18 — 2026-07-12 — Idempotent Telegram notifikacija (fix duplog slanja kod kartice) — DONE

**Tier:** STRICT
**SHA:** 1f0c1f5
**Branch:** batch/b18-telegram-idempotency (per-batch, STRICT)
**Files (4):**
  - api/telegram-new-order.ts — LOCK ZONE. +37 LOC. Atomic idempotency claim before send: `UPDATE orders SET telegram_notified_at = now() WHERE id = ? AND telegram_notified_at IS NULL RETURNING id`. Exactly one concurrent caller wins (Postgres row-lock); others get 0 rows → 200 `{telegram:"already_sent"}` no-op. Fail-open on claim ERROR (logs + sends anyway — degrades to prior possibly-duplicate behavior, never blocks the notification). Resets telegram_notified_at=null on send failure so retry / admin resend still deliver. The 3 payment LOCK files (create-order / bankart-callback / bankart-order-status) UNTOUCHED — their `payment_status!=='paid'` guards remain as a cheap first line.
  - api/telegram-new-order.test.ts — NEW (5 tests): first-sends/second-noop idempotency, already-notified skip, fail-open on claim error, send-fail releases claim, missing order_id → 400. Stateful supabase mock simulates telegram_notified_at NULL→now().
  - supabase/migrations/20260712120000_add_telegram_notified_at.sql — NEW. `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz`. Applied to prod (pwkqyoaofcbwsecawrjz) + verified nullable, no default.
  - docs/db-schema-baseline.md — +1 row (telegram_notified_at in orders table).
**Verify:**
  build:     PASS(machine) — vite 7.x, exit 0 (2026-07-12)
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 19 files / 218 tests (+5 B18)
  manual:    DEFERRED — E2E smoke (test-mode card → exactly 1 Telegram msg) requires deploy; code not yet live. Pavle post-merge smoke pending.
  code-review: SKIPPED — Pavle chose direct /close.
**SCOPE_DRIFT:** none — 4 files = EXPECTED-FILES exact.
**Notes:** Root cause = duplicate Telegram (NOT double charge) on card orders: 3 sources (create-order FINISHED, bankart-callback webhook, bankart-order-status poll) call /api/telegram-new-order for the one Bankart transaction; per-caller `payment_status!=='paid'` guard is TOCTOU (read-then-act, non-atomic) so two can both pass → 2 messages. Fix centralizes one atomic single-flight claim at the shared endpoint. Ad-hoc bug report (screenshot-first per W12; ROADMAP row N/A). Deploy order: migration already on prod (backward-compatible nullable add) → safe to merge b18 → main anytime; fail-open means even code-before-migration would not break. MCP incident during execute: Supabase connector was pointed at the wrong account (izdavanje-leto-2026) — caught by list_projects + list_tables identity check BEFORE apply_migration; Pavle reconnected to padrino org, re-verified orders/admin_users, then applied.

---

## B17 — 2026-06-18 — Free (zero-price) addon validation fix + Vercel function-cap fix — DONE

**Tier:** STRICT
**SHA:** 0e00809 (branch batch/b17-free-addon-validation: b3da22d + 1447f13 + 0e00809)
**Branch:** batch/b17-free-addon-validation (per-batch, STRICT)
**Files (7):**
  - api/create-order.ts — LOCK ZONE. `fetchMenuPricesCents` price map built with `if (id && p > 0)` → `if (id) m.set(id, p > 0 ? p : 0)`. Map is used for BOTH existence (findMissingMenuItemIds) and pricing; the `p > 0` filter excluded active free addons (Kečap/Majonez/Pelat, price_eur_cents=0) so any order with one returned 400 "Inactive or invalid menu item" (cash AND card). Fix includes every active row; sumAddonsCents already guards `cents > 0` so totals unchanged; subtotal<=0 guard still blocks free-only orders; inactive/absent ids still rejected.
  - src/lib/createOrderEndpoint.test.ts — +2 tests (pizza + free addon passes; free addon id absent from active set still 400).
  - api/admin-update-order-status.test.ts, api/bankart-callback.test.ts, api/bankart-order-status.test.ts, api/create-order.test.ts — `.js` extensions on 9 relative import sites (L6; latent TS2835 surfaced by Vercel cold recompile of api tsconfig project).
  - .vercelignore — NEW. Excludes `**/*.test.ts` + `**/*.test.tsx` from Vercel upload (Hobby 12-function cap: 11 handlers + 4 api tests = 15 → 11).
**Verify:**
  build:     PASS(machine) — vite 7.x, exit 0 (2026-06-18)
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 files / 213 tests (+2 B17)
  manual:    PASS(human)   — Pavle Vercel preview smoke: order with all free sauces (Kečap/Majonez/Pelat) accepted, arrived in DB
  security:  PASS — /security-review clean, 0 HIGH/MEDIUM (anti-tampering invariants preserved: DB-authoritative pricing, is_active existence, total-mismatch + subtotal>0 guards)
**SCOPE_DRIFT:** acknowledged — plan EXPECTED-FILES 2 (api/create-order.ts + src/lib/createOrderEndpoint.test.ts); actual 7. +5 approved: (a) 4 api test files `.js` extensions — Vercel cold build TS2835 blocker (L6); (b) .vercelignore — Vercel Hobby 12-function deploy blocker. Both pre-approved by Pavle.
**Notes:** Ad-hoc production bugfix (screenshot-first per W12; ROADMAP row N/A). Root cause was the price>0 filter conflating "exists/active" with "has price"; free sauces added to menu at €0 (DB change, no deploy) activated the latent bug → customer 400s. Two independent deploy blockers surfaced while shipping: latent api test `.js` imports (masked locally by Bundler resolution + tsbuildinfo cache) and the Hobby 12-function cap (test files counted as functions — corrected L8). Production reaches the fix only on merge batch/b17 → main (Pavle decides push/merge).

---

## L17 — 2026-05-31 — Menu modal: remove desktop scroll + uniform card heights — DONE

**Tier:** LEAN
**SHA:** aaa8937
**Branch:** main (direct commit, LEAN)
**Files (1):**
  - src/sections/Menu.tsx — 3 LOC changed (no LOC delta). Desktop/tablet grid card image `sm:h-[180px]` → `sm:h-[clamp(132px,14.5vh,180px)]` (viewport-scaled so the two 7-col xl rows fit without a scrollbar; floor 132px, capped 180px on tall screens — no shrink on large monitors). Description block `min-h-[34px]` → `line-clamp-2 h-[40px]` (fixed 2-line height — equalizes card height across short/long descriptions, eliminates bottom-row stretch/cutoff; empty-desc branch given matching `h-[40px]`). `overflow-y-auto` retained as graceful fallback — scrollbar only appears if content still overflows on very short viewports, never clips.
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 4.32s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      NIJE POKRENUTO — LEAN tier, CSS-only (Tailwind className) change, no logic/JSX-structure touched
  manual:    PASS(human)   — Pavle smoke (HMR localhost:5173) 2026-05-31 ("moze close commit push")
**SCOPE_DRIFT:** none — 1 fajl, ad-hoc UX batch (no /plan, W12 screenshot-first)
**Notes:** W12 ad-hoc UX batch — screenshot-first. Trigger: scrollbar on the 7-col (xl ≥1280px) MENI modal grid + bottom row visually cut off (uneven card heights from variable-length descriptions). Fix targets the xl 2-row layout; lg (1024–1280px, 5-col = 3 rows) still scrolls via the retained overflow-y-auto fallback (acceptable — graceful scroll, no clip). ROADMAP row N/A — screenshot-first batch.

---

## L16 — 2026-05-28 — Remove "Po pravilima"/"Besplatna" delivery pill from checkout — DONE

**Tier:** LEAN
**SHA:** 7d72776
**Branch:** main (direct commit, LEAN)
**Files (1):**
  - src/components/CheckoutView.tsx — -3 LOC; removed shrink-0 rounded-full pill (`qualifiesForFreeDelivery ? "Besplatna" : "Po pravilima"`) from "Pravila dostave" zone card header flex row; qualifiesForFreeDelivery still used in free-delivery progress conditional below — no dead code; flex parent justify-between now left-aligns single remaining child; no breakpoint difference (mobile + desktop identical removal)
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 3.09s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      NIJE POKRENUTO — LEAN tier, UI-only single-element removal, no logic touched
  manual:    PASS(human)   — Pavle "Pill izmena je okej" 2026-05-28
**SCOPE_DRIFT:** none — 1 fajl, ad-hoc UX batch (no /plan, W12 screenshot-first)
**Notes:** W12 ad-hoc UX batch. Both pill states removed (Besplatna + Po pravilima). Free-delivery progress messaging ("Nedostaje još X do besplatne dostave") below pill retained. Billing-section rework (Grad/Poštanski broj input removal + "Podaci za naplatu" heading relocation to CardFields) discussed same session — investigated payment data flow (BANKART_FALLBACK_CITY/POSTCODE/EMAIL fallbacks confirmed, billing fields optional-with-defaults), Pavle decided email keep + city/postcode UI-removal+send-default — but ultimately DECLINED execution ("ostalo necemo dirati"). Not executed; deferred. ROADMAP row N/A — screenshot-first batch.

---

## L15 — 2026-05-28 — Menu modal polish + checkout PREGLED removal + mobile chef hat logo — DONE

**Tier:** LEAN planned → STRICT effective (lock zone touch — CartView + CartDrawer per CONTEXT.md:44-45)
**SHA:** a5d59b3
**Branch:** main (direct commit; LEAN→STRICT scope drift acknowledged, per-batch branch skipped per ad-hoc UX flow)
**Files (4):**
  - src/sections/Menu.tsx — net -110 LOC; modal sm:max-w-[1160px]→[1400px]; image sm:h-[132px]→[180px]; card padding/min-h/pt compaction; sm:flex sm:flex-col sm:justify-center on scroll container for grid vertical centering; h2 "Iz naših srca, do vaših osmjeha" hidden sm:block → hidden lg:block (only ≥1024px desktop); subtitle p hidden sm:block (hidden on mobile); removed TopsellerCard component (62 LOC) + topsellerPizzas useMemo + POPULAR_PIZZAS import + "Pizza" section label + topseller JSX block from mobile sm:hidden branch; added ChefHatLogo absolute left-1/2 top-3 -translate-x-1/2 h-20 sm:hidden (centered mobile-only)
  - src/components/CheckoutView.tsx — -32 LOC; removed PREGLED p-glass card entirely (lines 160-184: heading + subtitle + 3-pill SUBTOTAL/DOSTAVA/UKUPNO grid); removed unused props from Props type + destructuring (totalItems, subtotalLabel, deliveryFeeCents); effectiveTotalLabel retained (used on submit button line 436)
  - src/components/CartView.tsx LOCK — ±1 LOC; "Izmeni broj komada" label className text-sm → text-[12.5px] + added whitespace-nowrap (single-line on narrow mobile widths)
  - src/components/CartDrawer.tsx LOCK — -3 LOC; removed totalItems/subtotalLabel/deliveryFeeCents prop assignments from <CheckoutView> JSX call (cascade from CheckoutView prop cleanup; vars still computed at lines 98/496/103 for other usages: order submission, post-checkout summary, telegram payload)
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 5.47s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 5.82s
  manual:    PASS(human)   — Pavle smoke (HMR localhost:5173) 2026-05-28
  security:  PASS — /security-review SAFE TO MERGE (UI-only, no XSS/auth/crypto/injection surface; React JSX auto-escape; lock zone touches are JSX-only prop removal + className change, no payment/HMAC/state-machine logic)
**SCOPE_DRIFT:** acknowledged 4 vs 1 planned — Menu.tsx (in-scope) + CartView.tsx (font tweak per Pavle ask, lock zone) + CheckoutView.tsx (PREGLED removal per Pavle ask via AskUserQuestion "Ceo blok i totalsi") + CartDrawer.tsx (cascade prop cleanup, lock zone, no logic). Per-batch branch skipped — ad-hoc UX iteration on main per W12 screenshot-first pattern.
**Notes:** W12 ad-hoc UX batch — screenshot-first iteration. Mid-session direction reversals (h2 desktop-only after initial removal both, chef hat placement corrected after initial wrong placement) documented in chat history. /security-review run pre-close per CLAUDE.md guidance (payment lock zone touched). Pavle frustration mid-session over visual element placement assumptions — for future screenshot-first UX work AskUserQuestion BEFORE placing visual elements rather than after. ROADMAP row N/A — screenshot-first batch.

---

## L14 — 2026-05-27 — Favicon + Google search icon (gold circle, dark chef hat) — DONE

**Tier:** STANDARD
**SHA:** b63d0a3
**Branch:** main (direct commit, STANDARD)
**Files (6):**
  - public/favicon.png — NEW, 192×192 PNG; gold #f2b400 circle, dark #0a0a0a chef hat recolored from chef-hat-stroke.webp via sharp blend-in composite; fixes /favicon.png 404 causing generic globe in Google Search
  - public/apple-touch-icon.png — NEW, 180×180 PNG; ista tema, iOS home screen
  - index.html — +1 LOC; `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />` dodan posle favicon linka
  - package.json — +1 LOC; sharp ^0.34.x devDependency (generate-time only, ne ide u bundle)
  - package-lock.json — +618 LOC; lockfile update
  - public/_mockups/favicon-preview.html — DELETED; design decision artifact, bio untracked
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 3.57s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova
  manual:    PASS(human)   — Pavle smoke localhost:5173 "sviđa mi se može" 2026-05-27
**SCOPE_DRIFT:** none — 6 fajla = EXPECTED-FILES exact match (untracked DELETE ne broji se u git diff)
**Notes:** Ad-hoc UX batch per W12. Design V1 (dark rounded rect) odbačen — pre-smoke; V2 (gold circle dark hat) usvojen posle smoke. Sharp pipeline: load webp → resize contain na innerSize (12% padding) → composite gold SVG blend 'in' → composite na SVG circle BG. Schema.org Organization.logo URL (index.html:89) auto-resolves — već referencira /favicon.png. Post-deploy: Pavle treba "Request Indexing" u Google Search Console (re-crawl može trajati dane).

---

## L13 — 2026-05-27 — Addon/sauce/drink slike u pillovima (Sheet + CartView) — DONE

**Tier:** STRICT (CartView u K-O LOCK zoni per CONTEXT.md:44)
**SHA:** 761d8d7 / merge 86126d2
**Branch:** batch/l13-addon-images → main (--no-ff merge)
**Files (2):**
  - src/components/MenuItemDetailSheet.tsx — +5/-0 LOC; import SmartMiniAddonImage iz ./CartDrawerImage; AddonSection (linija 542-601) renderuje 44×44px sliku levo od name/price bloka u svakom pillu kroz `<SmartMiniAddonImage name={it.name} className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />`; click delegacija ostaje (slika je pointer-events-none po prirodi <img> unutar clickable diva); QtyStepper/handleConfirm/size picker/note NETAKNUTI
  - src/components/CartView.tsx LOCK — +1/-1 LOC; linija 156 SmartMiniAddonImage className upgrade h-7 w-7 → h-11 w-11 + shrink-0; ostali tokeni (rounded-lg, object-cover, ring-1 ring-white/10) ostaju; lock zone non-regression — qty +/-/trash/edit handleri NETAKNUTI
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 3.70s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 3.96s
  manual:    PASS(human)   — Pavle smoke "savršeno" 2026-05-27 (DODAJ SOSOVE/PIĆE pillovi + CartView addon summary + lock zone non-regression)
**SCOPE_DRIFT:** none — 2 fajla = EXPECTED-FILES exact match
**Notes:** W12 ad-hoc UX batch. Wire-up batch — postojeća infrastruktura (SmartMiniAddonImage u CartDrawerImage.tsx + buildImageCandidates u cartDrawerHelpers.ts + public/menu/*.webp assets) već postojala, samo nikad nije bila aktivirana u AddonSection pickerima. Fallback chain završava na /menu/padrino.webp (brand-consistent, no FaUtensils dep odbačen R2). R1 (Coca-Cola Zero NAME_TO_FILE coverage) verifikovan pre execute — linije 174-178 pokrivaju coca cola zero / coca zero / coca-cola zero → coca-zero.webp. R5 (CartView lock zone scope creep) prevented — samo 1 string change u className-u, sve handler/state logic NETAKNUTO. imageKey: r.name polje u useCatalogData ostaje dead (out of scope cleanup za buduću LEAN). Code-review explicit skip per Pavle ("u novoj sesiji"). ROADMAP row N/A — screenshot-first batch.

---

## L12 — 2026-05-27 — Footer sekcija redesign (Pravac A Editorial Signoff) — DONE

**Tier:** STANDARD
**SHA:** bf46d67
**Branch:** main (direct commit, STANDARD)
**Files (1):**
  - src/sections/Footer.tsx — rewrite 148→93 LOC (−55); marketing H3 "Dobra pizza..." + paragraf + dva CTA-a (Česta pitanja + Nazad na vrh) uklonjeni; glass payment card (rounded-[28px] backdrop-blur) uklonjen; dual radial-gradient pozadina uklonjena; PAYMENT_BADGES const + PaymentBadge text-pill komponenta + scrollToTop + onTop useCallback uklonjeni; layout max-w-7xl grid → centered max-w-3xl (matches Contact L11); NEW: p-serif italic tagline "Tijesto sa ljubavlju, od 2021." text-2xl/3xl/4xl; quick-nav 5 linkova (Meni · O nama · Dostava · Kontakt · FAQ) sa middle-dot separatorima; payment row 4 brand logo <img> (visa/mastercard/nlb/bankart h-8 sm:h-9 rounded-md) + GOTOVINA gold pill sa FaMoneyBill1Wave; "Since 2021" desni stub uklonjen iz bottom row; loadSettings Supabase useEffect NETAKNUT
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 7.78s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 4.78s
  manual:    PASS(human)   — Pavle "odlicno je" 2026-05-27
**SCOPE_DRIFT:** none
**Notes:** W12 ad-hoc UX batch. Pravac A "Editorial Signoff" odabran. Payment logo assets pripremljeni u prethodnom housekeeping commit-u 110f946 (public/payments/{visa,mastercard,nlb,bankart}.webp, sve 400px width, total 23KB). CASH logo alternativa razmotrena/odbijena — language consistency (sajt 100% srpski, GOTOVINA pill ostaje). ROADMAP row N/A — screenshot-first batch.

---

## L11 — 2026-05-27 — Contact sekcija redesign (Pravac A Hero poziv) — DONE

**Tier:** STANDARD
**SHA:** 98c2396
**Branch:** main (direct commit, STANDARD)
**Files (1):**
  - src/sections/Contact.tsx — rewrite 266→175 LOC (−91); teški shadow-[inset_0_0_180px_...] overlay uklonjen — foto diše; hero telefon p-serif zlatni text-5xl/xl:text-7xl sa "Pozovi sada" pill CTA; info strip (Email/Adresa/Radno Vrijme) horizontalno s vertikalnim dividerima na desktop; 4 social pill-a (Instagram/Viber/WhatsApp/Maps) kompaktni red; SocialItem.glowBg field uklonjen (cleanup); yellowBubble class varijabla uklonjena
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 8.05s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 5.27s
  manual:    PASS(human)   — Pavle "ODLICNO" 2026-05-27
**SCOPE_DRIFT:** none
**Notes:** W12 ad-hoc UX batch. Pravac A "Hero poziv" odabran od 3 predložene varijante. ROADMAP row N/A — screenshot-first batch.

---

## L10 — 2026-05-27 — About sekcija redesign (cinematic asymmetric layout + Cormorant/Inter tipografija) — DONE

**Tier:** STANDARD
**SHA:** 0451a2d86cd8028f734e6d1be65820856409296d
**Branch:** main (direct commit, STANDARD)
**Files (3):**
  - src/sections/About.tsx — full rewrite 408→248 LOC (−160); CSS Grid 1.3fr/1fr desktop; slika levo full-bleed object-position 50%/50%; tekst desno Cormorant Garamond serif + Inter body; eyebrow "Naš početak"/"Danas" sa gold gradient divider; closing pull-quote serif italic gold text-[1.375rem]; mobile: stacked (slika 4:3 rounded → teaser → NAŠA PRIČA CTA → tags inline → Reviews na kraju); glass containeri desktop uklonjeni; "premium • porodično • domaće" uklonjeni; useMemo POS magic numbers uklonjeni; AboutStoryModal: gold accent stripe + #111 bg + radial glow; TagStrip + ReviewsCard simplify
  - src/index.css — +14 LOC: .p-serif (Cormorant Garamond) + .p-section-editorial (Inter) u @layer components
  - index.html — +1 LOC: Google Fonts link Cormorant Garamond:500;600;700 + Inter:300;400;500 (display=swap; preconnects već postojali)
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 7.70s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 4.79s
  manual:    PASS(human)   — Pavle odobrio layout + modal redesign + quote size 2026-05-27
**SCOPE_DRIFT:** none
**Notes:** W12 ad-hoc UX batch. Mockup fajlovi (about-a/b/c.html) kreirani tokom recon pa obrisani pre /plan-a. Font quote finaliziran na text-[1.375rem] xl:text-[1.6rem] (10% iznad text-xl). ROADMAP row N/A — screenshot-first batch.

---

## L9 — 2026-05-26 — Delivery sekcija redesign (kompresija + overlay + top fade) — DONE

**Tier:** STANDARD
**SHA:** 391ad79
**Branch:** main (direct commit, STANDARD)
**Files (1):**
  - src/sections/Delivery.tsx — rewrite 158→111 LOC (−47); 5 overlay slojeva+inset-shadow→2; 2 paragrafa+3 karte→1 rečenica+3 stat-pill-a (8 zona/~30 min/Besplatno); py-24/py-32→py-16/py-24; top h-20 fade-from-black dodat
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 8.63s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 4.62s
  manual:    PASS(human)   — Pavle: "okej je" + mobile confirmed 2026-05-26
**SCOPE_DRIFT:** none
**Notes:** Slika /sections/delivery.webp sačuvana (Pavle potvrdio). Pill sadržaj: "8 zona / Lastva–Sveti Stefan", "~30 min / Do vaših vrata", "Besplatno / Dostava u Budvi". Zona panel: "Budva, Bečići, Sv. Stefan + 5 lokacija duž rivijere". W12 ad-hoc UX batch — bez ROADMAP reda.

---

## L8.4 — 2026-05-25 — CartView display-only refactor + edit-reopen flow — DONE

**Tier:** STRICT
**SHA:** 42b6203
**Branch:** batch/l8.4-cartview-display-only
**Files (5):**
  - src/components/CartView.tsx — complete rewrite to display-only; removed size toggle, inline addon/sauce/drink pickers, note textarea; added clickable card (onEditItem) + read-only addon summary + read-only note display
  - src/components/CartDrawer.tsx — wired edit-reopen flow (editingCartItemId, editingItemAsDbRow, handleEditConfirm → updateItemInCart); removed useCatalogData, ROW constant, addon/note context actions
  - src/components/MenuItemDetailSheet.tsx — size picker (33/50 cm via pizzaVariantsByBaseKey); edit-mode props (initialSize/Qty/Addons/Note); key remount; z-[60]→z-[90]; CTA label edit/create; isDrinkCategory guard (drink section hidden when editing drink)
  - src/context/CartProvider.tsx — updateItemInCart: pure replace semantics, normalizeIncomingItem pipeline, no GA4
  - src/context/CartContext.tsx — updateItemInCart tip na CartContextType [SCOPE_DRIFT-ACK: implementacioni par]
**Scope expansion (approved):** size picker dodat u detail sheet (baseKey/variant discovery via useCatalogData)
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 7.68s, CartDrawer 64.04kB
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 4.64s
  manual:    PASS(human) — Pavle smoke 2026-05-25 (size picker prikazan, cart display clean)
**SCOPE_DRIFT:** CartContext.tsx — acknowledged: implementation pair za updateItemInCart tip
**Post-execute fixes (isti batch):**
  - normalizeText vs stripPizzaSizeFromName baseKey mismatch → size picker se nije prikazivao
  - isDrinkCategory guard → drink edit sheet ne nudi drink picker (sprečava tiho bacanje)
**Code-review:** pokrenut u sesiji, 2 nalaza identifikovana i oba popravljena pre /close

---

## L8.3 — 2026-05-25 — Mobile menu drawer full-page (remove floating overlay + transparency, back arrow) — DONE

**Tier:** STANDARD
**SHA:** e70fdbb
**Branch:** main (direct commit, STANDARD)
**Files (1):**
  - src/sections/Menu.tsx — +8/-8 net 0 LOC; mobile drawer CSS overrides:
    outer container removed `px-3 pb-10 pt-10` (edge-to-edge);
    inner drawer mobile-default rounded-none + border-0 + bg-[#0a0a0a] solid
    + shadow-none + no max-width, sm: prefixes restore desktop glass modal
    (rounded-[32px] + border-white/10 + bg-black/22 + shadow + max-w-[1160px]
    + backdrop-blur-md); menu.webp opacity-30 mobile → sm:opacity-[0.82]
    desktop (sub diluted on solid bg); ring overlay rounded-[32px] gated
    sm: only; close button left-3 top-3 + chevron-left SVG ("Nazad" aria)
    mobile → sm:left-auto sm:right-4 sm:top-4 desktop; header py-6 → pb-6
    pt-16 mobile (clearance ispod back button-a 56px + 8px gap), sm:py-7
    restored desktop. Behavioral logic intact (Escape/closeAll/L8.2 sheet
    integration NETAKNUT).
**Verify:**
  build:     PASS(machine) — vite 7.3.1, 2203 modules, 3.09s
  typecheck: PASS(machine) — tsc -b exit 0
  test:      PASS(machine) — 18 fajlova, 211 testova, 3.68s
  manual:    PASS(human) — Pavle smoke 2026-05-25 (mobile full-page bez
             transparentnosti + back arrow + desktop centered modal sa X
             gore-desno NETAKNUT)
**SCOPE_DRIFT:** none — EXPECTED-FILES=src/sections/Menu.tsx, diff exact
match (1 file, 16 line changes, all drawer CSS).
**Notes:**
- Pre-flight gotcha: /execute pokrenut na main koji JOŠ NIJE imao L8.2
  merged (L8.2 commit `0b46ba8` ostao na `batch/l8.2-mobile-detail-sheet`
  čekajući Vercel preview smoke). Recovery: stash L8.3 → ff-merge L8.2 →
  pop stash → auto-merge bez konflikta (L8.2 menja onClick/state, L8.3
  menja CSS — različite linije Menu.tsx-a). Workflow lesson kandidat za
  budući L: STANDARD pre-flight treba da proveri da li su predhodni batch
  branchevi koji touch-uju iste fajlove već merged u main pre `git
  checkout main` (LESSONS skip ovog batch-a; pattern može da se ponovi).
- L8.2 fast-forward doneo L8.2 close commit-ove (`81883af` workflow
  backfill SHA) u main istovremeno — main sad 4 commita ahead origin/main
  (L8.2 code + L8.2 backfill + L8.3 code + L8.3 close).
- Header pt-16 (64px) je direktna posledica button repositioning na
  mobile (button at top-3 + h-11 = 56px from top, +8px gap). Plan nije
  eksplicitno pominjao header padding ali je u istom fajlu / istom
  visual change-u — no scope drift per file-level comparison.

---

## L8.2 — 2026-05-25 — Mobile detail sheet (slide-up bottom sheet sa addonima) — DONE

**Tier:** STRICT
**SHA:** 0b46ba8
**Branch:** batch/l8.2-mobile-detail-sheet (per-batch branch)
**Files (3):**
  - src/components/MenuItemDetailSheet.tsx — NEW 442 LOC; AnimatePresence wrapper +
    SheetView (drag-y close, body scroll lock, Escape handler, keyed remount via
    item.id); QtyStepper + AddonSection sub-components; pizzaQty (1-10) + addons
    Map<id, {name,price,qty}> + note (200 char max); useCatalogData hook za
    sauces/drinks/addons catalog; handleConfirm builds CartItem sa addons[]/note;
    confirmedRef guard sprečava double-tap tokom exit animacije (~300-400ms)
  - src/sections/Menu.tsx — +43/-44 net -1 LOC; MenuItemDetailSheet import;
    selectedItem useState<DbMenuItem | null>; Escape handler guard
    "if (selectedItem) return" + selectedItem u deps; onAdd function REMOVED
    (dead code) → onConfirmFromSheet wrapper (addToCart + setSelectedItem(null)
    + markAdded + toast, menu drawer stays open); card click handlers
    onAdd={setSelectedItem} (TopsellerCard + MobileListRow); desktop grid
    onClick + keyboard handler → setSelectedItem; sheet render at bottom
    sa isHalalPizza() check
  - src/context/CartProvider.tsx — LOCK ZONE — +43/-13 net +30 LOC;
    addToCart existing-item branch rewritten: quantity +incomingQty (umesto +1)
    da sheet pizzaQty>1 ne ide u silent drop; addons union by id sum qty
    (Map-based merge, 99 cap) da incoming addons ne idu silent discard;
    note prefer incoming non-empty else preserve existing; trackAddToCart
    quantity hardcoded 1 → item.quantity za accurate GA4 events
**Verify:**
  build:     PASS(machine) — 2.94s
  typecheck: PASS(machine)
  test:      PASS(machine) — 18 fajlova, 211 testova
  manual:    PASS(human) — Pavle localhost:5173 smoke 3-fix scenarios PASS
             (qty merge 1→3→5, addon merge, double-tap guard) + base sheet
             flow (mobile topseller/list card tap → sheet slide-up, addons,
             qty stepper, note, sticky CTA, backdrop/X/Escape close, swipe-down)
**Code-review:** /code-review pokrenut pre /close, recall-biased recall pass;
5 verified findings (2 CONFIRMED HIGH + 1 PLAUSIBLE MED + 2 CONFIRMED MED);
HIGH findings (CartProvider re-add silent qty/addon discard) FIXED in-batch;
PLAUSIBLE double-tap CTA FIXED via confirmedRef; 2 MED deferred (scroll-lock
race unreachable in current paths; useCatalogData double-fetch perf only).
**SCOPE_DRIFT:** acknowledged — CartProvider.tsx (LOCK ZONE) added during
fix phase per code-review findings. Drift triggered by in-batch quality
gate (code-review uncovered pre-existing dormant bugs in addToCart existing
branch — old onAdd always sent qty=1/no-addons, so re-add silent discard
was invisible; sheet now sends qty>1 + addons, activating the latent path).
LOCK ZONE precedent: STRICT tier + Pavle approval pre-commit + smoke PASS.
**Notes:**
- Pattern: pre-existing dormant bug becomes visible when new feature activates
  the dormant code path. Code-review during STRICT batches catches these
  before they ship; smoke alone wouldn't (re-add data loss is silent).
- AnimatePresence + key={item.id} on SheetView = clean state reset on item
  switch (no useEffect deps gymnastics).
- Escape handler conflict resolved via guard in Menu.tsx (selectedItem !== null
  → return early, sheet handles its own Escape).
- closeAll() unreachable while sheet open (sheet backdrop z-[60] iznad menu
  backdrop z-50; user can't trigger closeAll path with sheet up).

---

## L8.1 — 2026-05-25 — Mobile menu redesign (Topseller strip + list rows + halal badge) — DONE

**Tier:** STANDARD
**SHA:** c1792b8
**Branch:** main (direct commit, STANDARD)
**Files (2):**
  - src/lib/config.ts — +30 LOC; POPULAR_PIZZAS readonly string[] (5 entries,
    lowercase normalized) + HALAL_PIZZAS ReadonlySet<string> (5 entries);
    matching via normalizeText(name).includes(target)
  - src/sections/Menu.tsx — +362/-208 net +154 LOC; PreviewImage component
    removed (dead code — "Vidi sliku" button gone); preview useState removed;
    TopsellerCard NEW file-local component (horizontal scroll, 120px wide,
    thumbnail + name + price + halal badge); MobileListRow NEW file-local
    component (full-width row, thumbnail right 80×80, text left, halal badge);
    mobile layout: sm:hidden div with Topseller strip + "Pizza" labeled list;
    desktop layout: hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7
    (existing card behavior preserved + halal badge bottom-right on thumbnail);
    isHalalPizza() helper + topsellerPizzas useMemo added
**Verify:**
  build:     PASS(machine) — 25 modula, 7.38s
  typecheck: PASS(machine)
  test:      PASS(machine) — 18 fajlova, 211 testova
  manual:    PASS(human) — Pavle localhost:5173 + real phone smoke PASS
**SCOPE_DRIFT:** none
**Notes:** Open question (search bar repositioning) — search ne postoji u
  Menu.tsx, uklonjeno iz scope-a; "Topseller" sekcija ime per Pavle explicit.

---

## L8.0 — 2026-05-25 — Mobile menu + add-to-cart flow mapping (recon) — DONE

**Tier:** LEAN
**SHA:** 10c66a6
**Branch:** main (direct commit, LEAN doc-only)
**Files (1):**
  - workflow/projects/padrino/L8-recon.md — NEW +108 LOC; architecture map for
    L8.1–L8.3; Menu.tsx (575 LOC drawer/modal, Supabase data, direct add-to-cart);
    CartProvider addon system already built (addons?: CartAddon[], CRUD methods);
    useCatalogData provides drinksCatalog/saucesCatalog/addonsCatalog; config.ts
    seam for POPULAR_PIZZAS + HALAL_PIZZAS; L8.1/L8.2/L8.3 batch scope maps;
    addon integration strategy (pass addons[] in initial addToCart call)
**Verify:**
  build:     PASS(machine) — 25 modula, 7.14s
  typecheck: PASS(machine)
  test:      NIJE POKRENUTO (LEAN tier)
  manual:    N/A (doc-only, no UI change)
**SCOPE_DRIFT:** none
**Notes:** Recon done during /plan Step 1.5 (3 parallel scouts). Execution =
  write file. Precedes L8.1 (STRICT) mobile menu drawer redesign.

---

## L7 — 2026-05-24 — Hero + Navbar redesign (logo lockup + solid backdrop + hero copy swap) — DONE

**Tier:** STANDARD
**SHA:** cc96bd0
**Branch:** main (direct commit per STANDARD)
**Files (5):**
  - src/components/Navbar.tsx — UPDATE +6/-17 net −11 LOC; (a) `isSticky`
    useState + scroll `useEffect` uklonjeni — header sad uvek
    `backdrop-blur-md bg-black/70 border-b border-white/10`, bez
    transparent-to-solid flash na scroll; (b) navbar inner `h-20` → `h-24`
    (prima veći logo); (c) ChefHatLogo prop className `h-9 w-9 translate-y-[2px]`
    (forsirana tiny veličina) → `h-16 sm:h-20 w-auto` (responsive,
    aspect-driven); (d) `aria-label` "Padrino početna" → "Padrino
    Pizzeria početna", `sr-only` span "Padrino" → "Padrino Pizzeria".
  - src/sections/Hero.tsx — UPDATE +5/-21 net −16 LOC; (a) p-kicker pill
    "Premium pizza u Budvi" uklonjen — exit criterion #4 grep za "Premium"
    sad clean u Hero.tsx (ostali "premium" u About/Menu/index.html/OG =
    sledeći M1 batch); (b) H1 split color: bela "Padrino" +
    gold #f2b400 "Pizzeria" (i dalje `uppercase` pa renderuje
    "PADRINO PIZZERIA"); (c) subcopy paragraf "Premium picerija u Budvi..."
    → "pizza · delivery · budva" letterspaced uppercase tracking-[0.35em]
    (zameni W8 locked M1 copy odluku — Pavle 2026-05-24 nova odluka);
    (d) 3 trust pills div uklonjen (Brza dostava / Svježe / Online);
    CTA "Poruči odmah" + background image stack NETAKNUTI.
  - src/components/brand/ChefHatLogo.tsx — UPDATE +3/-12 net −9 LOC
    (ACK SCOPE_DRIFT, mid-execute expansion per Pavle approval); (a)
    image className `h-[170px] w-auto object-contain translate-y-[8px]
    -translate-x-[14px]` (magic numbers + forced height bigger than container
    + clipping hacks) → `h-full w-auto object-contain block select-none`
    (natural scaling, čuva aspect); (b) container default sizing
    `h-16 w-[210px] sm:w-[240px]` uklonjen — Tailwind class conflict cleanup
    (sizing isključivo iz Navbar className override); (c) `overflow-hidden`
    uklonjen. Used only by Navbar (grep confirmed); no ripple risk.
  - public/logo/chef-hat-stroke.png — REPLACE bin 2001116 → 24140 bytes
    (ACK SCOPE_DRIFT, Pavle manual asset operation); 1024x1536 sa whitespace
    padding-om → 463x346 tight crop. 83× file size reduction. Natural
    consequence of "trim transparent" preporuke.
  - public/logo/chef-hat-stroke.webp — REPLACE bin 336898 → 34908 bytes
    (ACK SCOPE_DRIFT, Pavle manual asset operation); 1024x1536 → 463x346
    tight crop. WebP > PNG ovde (stroke graphics + alpha). 10× reduction.
    Drži se kao primary asset (ChefHatLogo WEBP_SRC konstanta).
**Verify:**
  build:     PASS(machine) — exit 0, 3.73s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 18 files / 211 tests
  manual:    PASS(human) — Pavle smoke localhost:5173 PASS za logo proporcije
    i hero copy/layout na mobile + desktop
**SCOPE_DRIFT:** acknowledged — 5 fajlova vs 2 planned. ChefHatLogo dodato
  mid-execute kao logical extension natural-scaling fix-a (Pavle eksplicitno
  odobrio). PNG+WebP asset replacement je natural consequence "trim
  transparent padding" preporuke Pavle-u — manuelno izvršeno van koda.
  Sve drift items iste teme (logo render kompletan fix), ne stvarna scope
  eksplozija.
**LESSONS:** unchanged (7/7 cap retained). Kandidat lekcije iz batch-a
  (image-asset rendering hygiene + transparent padding pitfall) su one-off
  design observations, ne recurring tehnička greška — preskočena rotacija.
**ROADMAP-row update:** N/A — L7 je screenshot-first batch bez ROADMAP row-a
  (per W12 reframe). M1 row je delimično advanced (hero side completed) ali
  /close Step 6 b2 guard ZABRANJUJE SCOPE edit kroz /close — sledeći M1
  batch (SEO meta + OG + index.html + "premium" grep clean u About/Menu)
  će close-ovati M1 row.
**Notes:**
  - Pre-plan flow: screenshot-first razgovor (5 screenshot iteracija) pre
    /plan-a — Pavle pitao "Šta predlažeš?" → predloženo 3 smera → izabrao
    "minimalna intervencija + logo lockup" → 4 odluka pitanja (Korpa, nav
    items, ornaments, trust pills) → /plan generated L7 STANDARD 2 fajla.
  - Execute path: 2 planned fajla edit-ovani → Pavle prvi screenshot "još
    nije dobro" → 2 iteracije logo lockup-a (pizzeria tagline added then
    removed) → Pavle "obriši Pizzeria" → Pavle "image natural scale" →
    scope expansion ChefHatLogo → "logo se ne vidi" (container width
    200/240 sa vertikalnom 2:3 slikom = tiny logo lost u praznini) →
    recommendation "trim transparent padding" → Pavle ručno cropped
    1024x1536 → 463x346, 24KB PNG → drop-in replace → potvrda "savršeno".
  - WebP delete drift caught mid-/close: Pavle prvo obrisao WebP,
    ChefHatLogo bi pravio 404 (WEBP_SRC primary). Flagged. Pavle dodao
    WebP nazad — "samo sam dodao webp i tjt".
  - M1 copy decision evolved: W8 2026-05-23 lock "Pill = PIZZA · BUDVA ·
    DOSTAVA, H1 netaknut PADRINO PIZZERIA, Sub = porodični recepti od 2021"
    → L7 2026-05-24 supersedes: pill OUT, H1 split-color PADRINO PIZZERIA,
    Sub = "pizza · delivery · budva". Sledeći M1 batch će formalno
    reconcile M1 row sa novom odlukom.
  - /code-review skipped per Pavle direct /close — STANDARD tier dotiče UI
    strukturu ali ne lock zone, payment, ili api. Smoke = primary gate.
  - Logo asset weight još uvek može optimizovati: PNG 24KB → ~15KB sa
    TinyPNG; WebP 35KB → ~10KB lossy (trenutno lossless). Ne blokira,
    deferred opcioni nice-to-have.

---

## W12 — 2026-05-23 — ROADMAP K-O reframe (audit findings reference, ne queue) — DONE

**Tier:** LEAN (doc-only)
**SHA:** 05d8134
**Branch:** main (direct commit per W-batch pattern)
**Files (1):**
  - workflow/projects/padrino/ROADMAP.md — UPDATE +19/-1; (a) Current
    Phase line 13 — "L5 ili L6 sledeci" → "Preostali audit findings
    (L2/L5/L6) ne queue-uju se" sa pointerom na ROADMAP scope sekciju;
    (b) Faza L heading — dodato quote-note block "W12 reframe — audit
    findings reference, ne pre-locked specs" (eksplicitno važi i za
    M2/N1-N3); (c) K-O strategic notes — dodat prvi bullet "Workflow
    (W12) — screenshot-first razgovor pre /plan-a" pre Mobile-first
    bullet-a; (d) NEW "ROADMAP scope" sekcija (~25 LOC) pre Long-term —
    eksplicitno "kad da / kad ne" + rationale (W8 napravio solution-specs
    bez Pavle screenshot input-a, L4 već prošireno mid-execute kad
    Pavle screenshot otkrio 3-pill duplikat).
**Verify:**
  build:     PASS(machine) — exit 0, 4.00s
  typecheck: PASS(machine) — exit 0
  test:      NIJE POKRENUTO — LEAN doc-only tier ne zahteva
  manual:    NIJE POKRENUTO — doc-only, nema UI/runtime promene
**SCOPE_DRIFT:** none — EXPECTED-FILES = [ROADMAP.md], actual diff = same.
**Cap:** 290 → 308 lines (cap 600 OK).
**LESSONS:** unchanged (no new lesson — proces shift, ne tehnička greška).
**ROADMAP-row update:** N/A — W12 je workflow batch, nema sopstveni ROADMAP
  row (per /close Step 6 b2 guard "W/workflow batches → skip silently").
**Notes:**
  - Razlog: Pavle pitao "da li nam ovaj mini redesign otezava roadmap" —
    realan odgovor: za UX iteracije (Faza L-N) pre-locked solution specs
    prerano sazri jer dolaze iz audit dokumenta a ne iz screenshot razgovora.
    Workflow disciplina je projektovana za risk management (lock zone,
    payment, RLS, refactor sa dependencies — Faze A-J šablon) — tamo
    ostaje. Za pure-UX iteracije pristup je screenshot-first.
  - ROADMAP nije "dead", samo trenutno u low-utilization periodu (~10%
    rada ide kroz ROADMAP, ~90% screenshot-first ili ad-hoc /plan).
    Sledeći ROADMAP-tipa program: J2 (template extraction kad app#2
    stigne) ili novi tehnički refactor ako audit otkrije sistematski debt.
  - Pre W12 commit-a — push L1+L3+L4+W12-prep commits (7 commits) na
    origin/main (af40248..8414d13). Sve mergovano.
  - Sledeći task: kad bude UX rad, screenshot-first razgovor pa /plan.

---

## L4 — 2026-05-23 — Cart item editor mobile compact — DONE

**Tier:** STRICT
**SHA:** e4def5b
**Branch:** batch/l4-cart-mobile-compact
**Files (3):**
  - src/components/CartView.tsx — UPDATE +1/-6 net −5 LOC; (a) `lineTotalCents`
    const + item-card "Ukupno: {formatEUR(lineTotalCents)}" pill uklonjeni
    (samo "X € / kom" pill ostaje uz qty stepper); (b) trailing spacer h-3 → h-32
    wrapped u `props.canSubmit` ternary — code-review CONFIRMED fix da empty
    cart state ne renderuje 128px dead space ispod "Korpa je prazna" placeholdera.
  - src/components/CartDrawer.tsx — UPDATE +2/-7 net −5 LOC; (a) header
    `py-4 sm:py-5` → `py-2.5 sm:py-3` (kompaktniji mobile header);
    (b) X close button `border-red-500/40 text-red-400 hover:bg-red-500/15
    hover:border-red-400` → `border-white/15 text-white/60 hover:bg-white/10
    hover:border-white/30` (neutralni dismiss affordance, aria-label retained);
    (c) "Nazad na meni" button + `<div className="mt-3 grid grid-cols-1 gap-2">`
    wrapper obrisani iz sticky footer-a; handleGoToMenu handler RETAINED jer
    je referenced u CartDrawer:557 (CartDrawerSuccessView onGoToMenu) +
    :637 (CartView onGoToMenu — empty cart "Idi na meni" CTA).
  - src/components/CheckoutView.tsx — UPDATE 0/-15 net −15 LOC; drugi
    SUBTOTAL/DOSTAVA/UKUPNO 3-pill summary blok unutar `selectedDeliveryZone`
    conditional obrisan (bio strukturni duplikat top "PREGLED" 3-pill kartice
    linije 170-182, koja ostaje kao single source — `subtotalLabel`,
    `formatFeeEurShort(deliveryFeeCents)`, `effectiveTotalLabel` updates
    reactively via useDeliveryZone hook).
**Verify:**
  build:     PASS(machine) — exit 0, 7.24s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 18 files, 211 tests (CartDrawer.contract +
             CartDrawer.e2e najrelevantniji — no assertion regression)
  manual:    PASS(human) — Pavle screenshots:
             (cart view) kompaktan header, sivi X, samo "10,50 € / kom" pill u
             Diavolo item kartici (no duplicate "Ukupno"), Sosevi+Napomena+addons
             ne preklapaju sticky "UKUPNO 20,00 € + Poruči" footer;
             (checkout view) "PREGLED — Spremno za potvrdu" kartica sa jednim
             SUBTOTAL/DOSTAVA/UKUPNO 3-pill summary, form polja ispod bez
             dupliranog summary bloka. Plus Bankart test-mode card transaction
             full golden path PASS (payment-flow ne regressira).
**SCOPE_DRIFT:** none — EXPECTED-FILES = [CartDrawer.tsx, CartView.tsx,
  CheckoutView.tsx], actual diff = same. Initial plan imao 2 fajla (CartView +
  CartDrawer) per ROADMAP description; CheckoutView dodato pre /execute kad je
  Pavle screenshot intervenisao otkrivši drugi 3-pill duplikat (scope expansion
  approved u istoj plan iteraciji, ne SCOPE_DRIFT po close definiciji).
**Code-review (Opus, 3 angles × verify):** 1 CONFIRMED + 2 PLAUSIBLE.
  CONFIRMED: h-32 spacer renderovan unconditionally → 128px dead space u empty
  cart state. Fix primenjen u istoj sesiji (canSubmit ternary, +1 LOC).
  PLAUSIBLE deferred: (a) qty>1 per-line subtotal više nije vidljiv (sticky
  footer pokriva grand total) — Pavle product decision retained; (b) X button
  contrast text-white/60 nad composite bg-black/40 + bg-black/25 + gradient
  backdrop borderline za WCAG 4.5:1 — aria-label="Zatvori korpu" retained,
  consider bump na text-white/80 ako buduce accessibility audit flag-uje.
**LESSONS:** unchanged (7/7 active L1/L2/L3/L5/L6/L7/L8) — recon-depth tema
  (Haiku scout promašio cart-item-card duplikat) već pokrivena W4/W5
  reconciliation notes; h-32 empty-state bug je standardni React conditional
  render pattern, ne project-specific learning vredan L9 rotacije.
**Notes:** Drugi STRICT batch u Fazi L (posle L1 LEAN + L3 LEAN). Lock zone
  touch — CartView/CardFields W8 promocija za K–O period honored, plus
  CheckoutView dodato u scope mid-plan posle Pavle screenshot intervencije.
  Pattern observation: kad ROADMAP opis ima "duplicate X" claim, recon mora
  pokriti SVA mesta gde se taj string pojavljuje, ne samo header — Haiku scout
  prvi prolaz tražio "Ukupno" u headeru CartView-a/CartDrawer-a, što je tehnički
  netačno mesto. Pavle screenshot direktno upro u item-card "Ukupno: 10,50 €"
  pill + CheckoutView drugi 3-pill — recon je morao da grep-uje "Ukupno|UKUPNO|
  SUBTOTAL|DOSTAVA" cross-file pre nego što plan kreće. To je bilo zatvoreno
  inline drugim grep prolazom; nije nova lesson jer je već u W4/W5 noti
  ("recon depth — pre-plan grep mora pokriti src/lib/, ne samo src/components/").
  Branch batch/l4-cart-mobile-compact će biti merged + obrisan post-PR.

Sledeći u Faza L: L5 (Checkout step indicator + header renaming, STRICT,
  CheckoutView + CartDrawer lock zone) ili L6 (Zona dostave chips + Pozovi
  demote, STANDARD, CheckoutView only). L2 (Bankart iframe styling, STRICT)
  blocked dok Pavle ne potvrdi VITE_BANKART_PAYMENTJS_ENABLED + PUBLIC_KEY u
  Vercel + lokalni dev env (per L3 close note).

---

## L3 — 2026-05-23 — Trust messaging reduction 3→1 in CardFields — DONE

**Tier:** LEAN
**SHA:** a2bbfea
**Branch:** main (LEAN, direct commit per v3 default)
**Files (1):**
  - src/components/CardFields.tsx — UPDATE +14/-22 (net -8 LOC); 3 trust signala → 1:
    (Block 1) "Sigurna Bankart polja" header + dynamic 3-variant subtitle
    (paymentJsRequested/paymentJsMissingKey branchcontentdriven dev-internal copy) +
    emerald uppercase "Bankart" badge → single compact row "🔒 Plaćanje kroz Bankart —
    sigurno i šifrovano" + inline VISA/Mastercard/Maestro mini-pills (style-mirror iz
    Footer.tsx PAYMENT_BADGES pattern, inline duplicate ne abstrakcija — LEAN scope);
    (Block 2) "Secure entry" uppercase micro-label uz "Detalji kartice" header
    + okolni flex wrapper uklonjen, header postaje single child;
    (Block 3) bottom pill-ovi "Bankart iframe polja" + "Broj kartice i CVV se ne čuvaju
    u našem frontend-u" → uklonjeni; payment logic ne dirano (paymentJsRequested branch,
    input handlers, iframe DOM containers numberDivId/cvvDivId, polishCss style injection,
    loading/error operational messages — sve LOCKED)
**Verify:**
  build:     PASS(machine) — exit 0, 7.06s
  typecheck: PASS(machine) — exit 0
  test:      NIJE POKRENUTO — LEAN tier (nema CardFields test fajla)
  manual:    PASS(human) — Pavle DevTools mobile view (Chrome) screenshot potvrdio:
             gornji trust red sa 🔒 + 3 pill-a vidljiv; "Detalji kartice" header bez
             "Secure entry"; nema bottom pill-ova; "Kartično plaćanje vodi na sigurnu
             Bankart stranicu za unos kartice" copy iz CartDrawer ostao (van scope-a)
**SCOPE_DRIFT:** none — EXPECTED-FILES = [src/components/CardFields.tsx], actual diff = same
**LESSONS:** unchanged (7/7 active) — copy reduction je rutinski pattern
**Notes:** Drugi L (friction reduction) batch. Lock zone touch (CardFields.tsx promovisan
W8 za K-O period), ali LEAN tier honored per ROADMAP eksplicitan label — copy/JSX only,
zero payment logic change.

**Bonus observation (NOT a new lesson, NOT in scope):** Tokom smoke-a potvrđeno da je
trenutno paymentJsRequested=false lokalno (.env.local nema VITE_BANKART_PAYMENTJS_ENABLED
ni VITE_BANKART_PAYMENTJS_PUBLIC_KEY) → redirect-to-Bankart-hosted-page flow aktivan.
Pavle pitanje "moramo li raditi redirect?" potvrdio da je env-driven feature flag.
Implikacija za **L2 (Bankart iframe styling, STRICT)**: pre L2 izvršenja treba (a) potvrditi
production env stanje (VITE_BANKART_PAYMENTJS_ENABLED + KEY u Vercel), (b) lokalno
postaviti iste env vars za development smoke. Bez tog operativnog koraka L2 ne može da se
smokra jer iframe ne renderuje. L3 trust copy je honest u oba flow-a — "Plaćanje kroz
Bankart" tačno za redirect (vodi na Bankart) i za iframe (kroz Bankart polja).

Sledeći u Faza L: L4 (Cart item editor mobile compact, STRICT, CartView.tsx lock zone)
prefer over L2 jer je L2 ops-blokiran. L4 fokus: ukloni duplicate "Ukupno: X €" pill,
"Nazad na meni" button, kompaktnije header, X dugme sivo umesto crveno, sticky bottom
da ne preklapa addons.

---

## L1 — 2026-05-23 — Hamburger menu z-index fix + logo hide — DONE

**Tier:** LEAN
**SHA:** 3a5dfe0
**Branch:** main (LEAN, direct commit per v3 default)
**Files (1):**
  - src/components/Navbar.tsx — UPDATE +7/-2; (a) mobile dropdown wrapper (linija 220) dobio
    `relative z-[60]` → stacking context iznad logo `z-[55]` (defense in depth ako logo
    opacity bude ikada uklonjeno); (b) logo `<a>` element conditional klase array — kad
    `mobileOpen=true` dobija `opacity-0 pointer-events-none`, plus `md:opacity-100
    md:pointer-events-auto` preserves desktop visibility (edge: user otvori mobile menu pa
    rotira u landscape); `transition-opacity duration-200` smooth fade; `aria-hidden="true"`
    when hidden (screen reader correctness)
**Verify:**
  build:     PASS(machine) — exit 0, 3.02s
  typecheck: PASS(machine) — exit 0
  test:      NIJE POKRENUTO — LEAN tier (CSS-only change, nema Navbar test fajla)
  manual:    PASS(human) — Pavle real phone smoke (Huawei, hotspot Wi-Fi) + DevTools
             mobile view potvrda; logo nestaje na hamburger open, panel čist bez siluete,
             logo se vraća na close, navigacija normalna
**SCOPE_DRIFT:** none — EXPECTED-FILES = [src/components/Navbar.tsx], actual diff = same
**LESSONS:** unchanged (7/7 active) — poznat Tailwind stacking context + conditional className pattern
**Notes:** Prvi L (friction reduction) batch posle W8 ROADMAP definition. Pre-plan scout
(Haiku) recon identifikovao Navbar.tsx + logo z-[55] vs header z-50 stacking konflikt.
Inicijalni fix (`z-[60]` na dropdown wrapper) tehnički rešio stacking, ali Pavle phone
smoke pokazao da semi-transparent panel (`bg-black/40 backdrop-blur-md`) propušta
siluetu logoa kroz; user feedback "nema potrebe da tu stoji logo" → dodato conditional
opacity-0 + pointer-events-none na logo. Dva commit-a u jedan PR: implementacija
(3a5dfe0) + workflow close. Dev procedure update: ubuduće Chrome DevTools mobile view
za CSS/layout iteracije; real device test tek pre/posle push-a (L2 STRICT će zahtevati
real device per Bankart smoke gate). L3 (trust messaging reduction, LEAN, CardFields.tsx)
sledeći u istoj sesiji.

---

## W11 — 2026-05-23 — Workflow tooling completion — DONE

**Tier:** LEAN
**SHA:** 90d4c5f
**Branch:** main (skill+doc-only, direct commit per v3 default)
**Files (7):**
  - .claude/skills/execute/SKILL.md — NEW; model: sonnet; ~140 LOC; "Opcija B" implementation:
    Step 1 locate /plan output (refuse if missing), Step 2 pre-flight gates (clean tree
    + active batch + STRICT branch check), Step 3 STRICT auto-branch (batch/<id>-<slug>),
    Step 4 implementation sa SCOPE_DRIFT guard (STOP and report ako edit van EXPECTED-FILES),
    Step 5 verification (typecheck/test/build per tier), Step 6 hand-off ka /close;
    refusal examples + anti-patterns + workflow position diagram (Opus plan → Sonnet
    execute → Sonnet close)
  - CLAUDE.md — UPDATE Session Hygiene; razdvojeno u 2 sekcije: "Context management" (postojeća
    pravila zadržana) + NEW "Workflow skill suggestions" sa 7 trigger pravila: post-/plan →
    /execute, post-/execute STRICT → /code-review, post-payment/Bankart/RLS → /security-review,
    pre-/plan na dug doc → /doc-lens, post-/close + nepovezan task → /clear, /audit drift
    findings → fix-first, end-of-session → /usage
  - .claude/skills/plan/SKILL.md — UPDATE; Step 1.5 NEW "Pre-plan recon (OPTIONAL)" —
    scout (Haiku) agent invocation pattern za grep-heavy file inspection PRE /plan-a;
    eksplicitno "Skip when" usloven (self-contained brief, follow-up batch);
    razlog: ~70% Opus context token savings
  - .claude/skills/audit/SKILL.md — UPDATE Step 1 paralelizacija; ranija sekvencijalna
    verification + git checks zamenjena sa 2 paralelna Explore agenta: Agent A "build-health"
    (npm build/typecheck/test + LOC + any/ts-ignore grep) + Agent B "drift-checks"
    (git status/log/worktree + doc wc -l caps); Opus thread synthesizes both reports
    za drift analysis umesto da puni context sa grep output-om
  - .claude/skills/close/SKILL.md — UPDATE; NEW Step 0.5 "Pre-close code review recommendation
    (STRICT only)"; STRICT batch sa lock zone touch → suggest /code-review pre commit-a;
    payment/Bankart/RLS files → dodatno suggest /security-review; recommendation only,
    ne refuses, ne blokira; sledi anti-pattern "fail-soft" — workflow skill, ne gate
  - workflow/STATE.md — UPDATE; Poslednji završen W11, Sledeći L1; W11 row dodat u Faza progres
  - workflow/LOG.md — UPDATE; ovaj entry
**Verify:**
  build:     PASS(machine) — N/A (skill+doc-only)
  typecheck: PASS(machine) — N/A
  test:      PASS(machine) — N/A
  manual:    NIJE POKRENUTO — LEAN tier; skill files će biti exercised tokom L1 (prvi
             stvarni test /execute skill-a)
**SCOPE_DRIFT:** none — 5 sub-items koherentno fit pod temom "workflow tooling completeness post K-O ROADMAP" (analog W2/W3/W9 pattern)
**LESSONS:** unchanged (7/7 active)
**Notes:** Trigger = Pavle diskusija 2026-05-23 (post-W10, pre-L1): (a) subagent integration
priložnosti, (b) full skills mapping diskusija → finalna tabela 12 skills u svakodnevnom
workflow-u, (c) /execute skill request da bi Sonnet automatski preuzimao execution posle
Opus /plan-a, (d) proactive skill suggestions pravila koja ću pratiti.
Strategija: sve 5 sub-items su LOW-risk, doc/skill-only, tematski koherentni — single
LEAN batch ne narušava R1 "1 tema = 1 batch" (tema = workflow tooling).
M1 (sledeći L batch) je prvi test za /execute skill — tier LEAN pa će scope drift guard
+ auto-branch step biti exercised, ali bez lock-zone rizika (Navbar.tsx). L2 (STRICT)
je prvi pravi test workflow-a sa /code-review recommendation u /close.
Pavle će raditi /clear posle ovog W11 close pa nova sesija za L1.

---

## W10 — 2026-05-23 — /plan SKILL.md simplification (legacy "Claude Code prompt" removed) — DONE

**Tier:** LEAN
**SHA:** b4a1f3d
**Branch:** main (skill-config-only, direct commit per v3 default)
**Files (3):**
  - .claude/skills/plan/SKILL.md — UPDATE 4 edits, ~12 LOC net delta;
    (1) description: pojasnjeno "structured header (BATCH-ID, TIER, EXPECTED-FILES)
        used later by /close for SCOPE_DRIFT detection" (skinuto "for Claude Code handoff");
    (2) Role: nova "Workflow context" sekcija — plan dokument je deliverable u istoj
        Claude Code sesiji, ne odvojen execution prompt; legacy ChatGPT→Composer pattern
        eksplicitno ozvučen kao dead;
    (3) Step 4: "DO NOT write the Claude Code prompt until approval" → "DO NOT begin
        execution until approval";
    (4) Step 5: "On approval, write Claude Code prompt" → "On approval, begin execution
        in same session"; header iz Step 3 ostaje kao machine-readable referenca za
        /close, ne treba ga "pakovati" u execution prompt;
    (5) Anti-patterns: "Write Claude Code prompt before Pavle approves" →
        "Begin execution before Pavle approves" + dodat eksplicitan anti-pattern
        "Generate a separate 'execution prompt' deliverable (legacy ChatGPT→Composer
        pattern — sve se sada radi u istoj Claude Code sesiji, plan dokument je dovoljan)"
  - workflow/STATE.md — UPDATE; Poslednji završen W10, Sledeći L1; W10 row dodat
  - workflow/LOG.md — UPDATE; ovaj entry
**Verify:**
  build:     PASS(machine) — N/A (skill-config-only)
  typecheck: PASS(machine) — N/A
  test:      PASS(machine) — N/A
  manual:    NIJE POKRENUTO — LEAN tier
**Pre-edit verification:**
  - .claude/skills/close/SKILL.md grep "prompt" — zero matches (clean, ne treba edit)
**SCOPE_DRIFT:** none — tema = "/plan SKILL.md simplification (drop legacy prompt step)"; sve izmene fit pod jedan koherentan refactor
**LESSONS:** unchanged (7/7 active)
**Notes:** Trigger = Pavle question 2026-05-23 (pre K1 zatvaranja) "fora je sto smo izbacili iz upotrebe web verziju kao planner itd, sve radim ovde u claude code i meni nije potrebno da se pisu promptovi pre izvrsenja, da li je opusu/sonnetu potrebno?" Analiza potvrdila da Step 5 ("Write Claude Code prompt") je legacy iz pre-W0 ChatGPT→Composer Execute workflow (vidi DECISIONS Phase History). AI koji generiše plan (Opus, via W9 frontmatter override) je u istoj sesiji kao AI koji izvršava — plan dokument već u chat history, nema "handoff" preko alatki. Header (BATCH-ID/TIER/EXPECTED-FILES) zadržan jer /close ga čita za SCOPE_DRIFT — to je machine-readable kontrakt, ne handoff prompt. Pre nego što krene L1, /plan sad daje čistiji output (plan dokument samo, ne plus duplicated execution prompt).

---

## K1 — 2026-05-23 — GA4 enhanced ecommerce events — DONE

**Tier:** STRICT (upgraded from STANDARD pre-execution — plan analiza otkrila 2 lock-zone fajla)
**SHA:** f2047cb
**Branch:** batch/k1-ga4-events
**Files (5):**
  - src/lib/analytics.ts — UPDATE +55/-1; Ga4CartItem type, AnalyticsEventParams extended
    to allow Ga4CartItem[], 5 new ecommerce helpers: trackAddToCart / trackRemoveFromCart /
    trackBeginCheckout / trackAddPaymentInfo / trackPurchase
  - src/lib/analytics.test.ts — NEW +64; 5 unit testova, @vitest-environment jsdom,
    svi PASS; shouldTrackNow() zahteva window (jsdom) da ne vrati false
  - src/context/CartProvider.tsx — UPDATE +22; trackAddToCart posle addToCart setItems,
    trackRemoveFromCart pre setItems filter (čita items iz closure), trackAddPaymentInfo
    posle setPaymentMethod (LOCK — side-effect only, nula logike)
  - src/components/CartDrawer.tsx — UPDATE +9; trackBeginCheckout u proceedToCheckout
    (effectiveTotalCents iz useDeliveryZone), totalCents: nextSummary.totalCents dodat
    u cash applySuccessUiState call (LOCK — side-effect only)
  - src/hooks/cart/useSuccessState.ts — UPDATE +11; totalCents? u ApplySuccessUiStateInput,
    hasFiredPurchaseRef dedup guard (keyed na orderId), trackPurchase u cash branch +
    card "paid" branch (successSummary.totalCents iz stanja, set pre polling-a)
**Verify:**
  build:     PASS(machine) — 25 chunks, exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 18 test fajlova, 211/211 testova
  manual:    PASS(human) — Pavle: GA4 DebugView smoke PASS (2026-05-23)
**SCOPE_DRIFT:** none
**Notes:**
  hasFiredPurchaseRef sprečava double-fire na Bankart polling loop. Cash purchase fires
  u paymentMethod!=="card" branch (totalCents iz input.totalCents); card purchase fires
  u paymentStatus==="paid" branch (totalCents iz successSummary iz bankartReturnStorage).
  Faza K DONE (K1 je bio jedini batch).

---

## W9 — 2026-05-23 — Workflow housekeeping post K–O ROADMAP — DONE

**Tier:** LEAN
**SHA:** be3ff60
**Branch:** main (doc/tooling-only, direct commit per v3 default)
**Files (5):**
  - .claude/skills/plan/SKILL.md — UPDATE +1; `model: opus` frontmatter field added (skill-level model override; eliminira manual /model switch posle /plan)
  - .claude/skills/audit/SKILL.md — UPDATE +1; `model: opus` frontmatter field added (audit reasoning quality justifies Opus)
  - .claude/skills/kickoff/SKILL.md — UPDATE +18/-1; new Step 3.5 "Lock zone recent touches" + Quick health output red dodat; razlog = ako se ulaziš u plan koji bi dotakao lock zone, treba odmah da znaš da li je neko (možda ti od juče) već radio tamo
  - workflow/projects/padrino/CONTEXT.md — UPDATE +4/-1; (a) "Testing: Vitest (3 test files)" → "(17 test files, 206 tests — covers money path + API _shared + DOM characterization + golden path E2E)" stale doc drift fix; (b) Lock zone tabela: CartView.tsx + CardFields.tsx dodati sa K–O conditional note (W8 promotion materijalizovan u CONTEXT)
  - workflow/STATE.md — UPDATE; Poslednji završen W9, Sledeći K1; W9 row dodat u Faza progres
  - workflow/LOG.md — UPDATE; ovaj entry
**Verify:**
  build:     PASS(machine) — N/A (doc/skill-only)
  typecheck: PASS(machine) — N/A
  test:      PASS(machine) — N/A
  manual:    NIJE POKRENUTO — LEAN tier
**Git housekeeping (out-of-files):**
  - 10 local merged batch/* branches obrisane:
    g4.1-bankart-return-storage, g4.2-use-checkout-form, g4.6-catalog-and-checkout-view,
    h1-admin-orders-lib, h2.1-admin-menu-component-split, i2-cors-allowlist,
    i2.1-cors-admin-handlers, i2.2-hobby-slot-reclaim, i3-logger-server-sink,
    i4-build-sha-monitoring
  - 9 remote merged batch/* branches obrisane (h2.1 had no remote)
  - 3 lokalne (i2/i2.1/i2.2) bile advanced od remote-a (squash merge razlika) — force delete (-D) bezbedan jer merged u main verifikovano
  - Post-cleanup: zero batch/* local, zero batch/* remote
**SCOPE_DRIFT:** none — tema = "workflow housekeeping post K–O ROADMAP"; 4 zero-risk sub-items legitimno fit pod tom temom (analog W2/W3 reconciliation pattern)
**LESSONS:** unchanged (7/7 active)
**Notes:** Trigger = Pavle question 2026-05-23 "ima li lakši način" za Opus→Sonnet model handoff. Verified preko claude-code-guide subagent-a: skill `model:` frontmatter je jedina realna opcija (slash commands, hooks, settings.json per-feature — sve mitovi). Plus exploited momentum za 3 dodatna housekeeping items koji bi inače decay-ovali kao background drift. K1 starta posle ovog batch-a sa čistim baseline-om: zero stale branches, accurate CONTEXT.md, /kickoff sa lock zone visibility, /plan + /audit ne traže manual /model.

---

## W8 — 2026-05-23 — ROADMAP K–O friction-reduction program definition — DONE

**Tier:** LEAN
**SHA:** da0dcd7
**Branch:** main (doc-only, direct commit per v3 default)
**Files (3):**
  - workflow/projects/padrino/ROADMAP.md — UPDATE +103/-3 LOC; Current Phase reframed (Refactor-to-9 "Faze A–J COMPLETED" — replaces "All 8 exit criteria met" claim); NEW "Friction-reduction program (Faze K–O)" sekcija: UX audit findings (analytics 28-day pull + mobile screenshots 2026-05-22), strategic LOCK "friction reduction, NOT redesign" + šta NE pravimo (design system, fotosesije, paleta, dvojezičnost), CardFields.tsx + CartView.tsx promovisani u lock zone za K–O period, 9 hard + 3 soft exit criteria (falsifiable), Faza K (K1 GA4 instrumentation STANDARD), Faza L (L1 hamburger LEAN, L2 Bankart iframe STRICT #1 priority, L3 trust msg LEAN, L4 cart compact STRICT, L5 checkout step STRICT, L6 zone chips STANDARD), Faza M (M1 hero copy STRICT — Pavle locked 2026-05-23, M2 menu drawer STANDARD), Faza N (N1-N3 conversion engine, conditional na L+M baseline), Faza O (data-triggered, pre-empty, cap 3 batch-a), K–O strategic notes (mobile-first, Bankart smoke gate, parallelization rules); self-score target 8.0/10 UX
  - workflow/STATE.md — UPDATE; Poslednji završen W8, Sledeći K1; W8 row dodat u Faza progres
  - workflow/LOG.md — UPDATE; ovaj entry
**Verify:**
  build:     PASS(machine) — N/A (doc-only)
  typecheck: PASS(machine) — N/A (doc-only)
  test:      PASS(machine) — N/A (doc-only)
  manual:    NIJE POKRENUTO — doc-only LEAN batch
**SCOPE_DRIFT:** none — exact 3 EXPECTED files (ROADMAP + STATE + LOG)
**LESSONS:** unchanged (7/7 active) — no new technical risk pattern; novo programsko područje (UX) ali ne otvara nov LESSON-class
**Notes:** Trigger = UX audit conversation 2026-05-22 + Pavle decision 2026-05-23 da definišemo K–O program kao formal continuation A–J. M1 copy locked u istoj sesiji: pill "PIZZA · BUDVA · DOSTAVA" (kratak, 2 search keyword-a — `pizza budva` + `dostava`), H1 "PADRINO PIZZERIA" (netaknut brand wordmark), sub "Sveže pečena pizza, brza dostava u Budvi i okolini. Porodični recepti od 2021, ljubav na svaki zalogaj." SEO rationale: niko ne kuca "porodična picerija" kao keyword — porodičnu priču držimo kao brand signal u sub-headline-u, ne u pill-u. K1 (GA4 instrumentation) sledeći stvarni batch; može paralelno sa L1/L3 (LEAN, ne dotiču isti fajl), ali poželjno K1 stoji 3-4 dana pre nego što L promene UI da imamo bar parcijalni baseline. K-O fundamentalno različit od A-J — UX/conversion vs technical debt — falsifiable hard exit criteria + soft post-deploy metrike (14-day window).

---

## J1 — 2026-05-22 — TEMPLATE.md + canonical env manifest — DONE

**Tier:** STANDARD
**SHA:** 43e7dd7
**Branch:** main (doc-only, direct commit per v3 default)
**Files (2):**
  - TEMPLATE.md — NEW 246 LOC; clone-and-adapt vodič; stack snapshot, reusable vs project-specific map, canonical env manifest (26 vars, grep-verified), clone steps, known limitations, references
  - .env.example — UPDATE +5 LOC; ALLOWED_ORIGINS dodat (I2 drift od 2026-05-21)
**Verify:**
  build:     PASS(machine) — exit 0, 7.82s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files
  manual:    NIJE POKRENUTO — doc-only batch, no code touched
**SCOPE_DRIFT:** none — exact 2 EXPECTED-FILES
**LESSONS:** unchanged (7/7 active) — no new technical risk pattern; .env.example drift (ALLOWED_ORIGINS missing since I2) caught during /plan recon, system working as intended
**Notes:** Zatvara exit criterion #8 — TEMPLATE.md postoji sa canonical env manifest-om. Env manifest: 26 vars dokumentovano; svi path-ovi u REUSABLE tabeli grep-verified (17/17). ALLOWED_ORIGINS bio missing iz .env.example od I2 (2026-05-21) — jedini drift nađen. Faza J: J1 DONE, J2 deferred (pending app#2). Self-score: 8.5/10 (9.0 je claim tek kad J2 uspešno klonira app#2).

---

## H2.1 — 2026-05-22 — AdminMenu component split — DONE

**Tier:** STRICT
**SHA:** a379a06 (batch) / 643dea7 (merge)
**Branch:** batch/h2.1-admin-menu-component-split
**Files (3):**
  - src/pages/admin/MenuItemList.tsx — NEW 179 LOC; left-column list panel; 14 props; local StatusBadge; imports from adminMenuLib + money
  - src/pages/admin/MenuEditorPanel.tsx — NEW 372 LOC; right-column editor panel; 25 props; local fieldClassName/PreviewImage/StatusBadge; imports from adminMenuLib
  - src/pages/admin/AdminMenu.tsx — MODIFIED 939→548 LOC (net −391); imports MenuItemList + MenuEditorPanel; keeps fileToDataUrl + all state/hooks/handlers; left/right JSX replaced with component call sites
**Verify:**
  build:     PASS(machine) — exit 0, 7.33s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files
  manual:    PASS(human) — Pavle smoke confirmed
**SCOPE_DRIFT:** none — exact 3 EXPECTED-FILES
**LESSONS:** unchanged (7/7 active)
**Notes:** AdminMenu.tsx 939→548 LOC — exit criterion #1 CLOSED for AdminMenu. Faza H DONE ✓. StatusBadge duplicated in both subcomponents (14 LOC each) — clean separation preferred over shared import at this scale.

---

## H2 — 2026-05-22 — AdminMenu lib extraction — DONE

**Tier:** STANDARD
**SHA:** 0c96ced
**Branch:** main (direct commit)
**Files (2):**
  - src/lib/adminMenuLib.ts — NEW 449 LOC; exports: MenuCategory/VisibilityFilter/AdminMenuRow/EditorState + 4 response types + consts (MAX_IMAGE_SIZE_BYTES/CATEGORY_OPTIONS/VISIBILITY_OPTIONS/EMPTY_EDITOR/ADMIN_API_BASE); 12 pure helpers (toStr/toNullableStr/toBool/toNonNegativeInt/normalizeCategory/safeDateTime/centsToInput/parseEuroInputToCents/normalizeImageInput/buildPreviewCandidates/isAdminStorageUrl/normalizeMenuRow); 4 API fns (getSessionToken/apiGetMenuItems/apiUpsertMenuItem/apiUploadMenuImage/apiDeleteMenuImage); 3 editor helpers (editorFromRow/sortMenuItems/getNextSortOrder)
  - src/pages/admin/AdminMenu.tsx — MODIFIED 1353→939 LOC (net −414); imports from adminMenuLib; keeps fileToDataUrl/fieldClassName/PreviewImage/StatusBadge/AdminMenu component; React hooks/JSX/handlers unchanged
**Verify:**
  build:     PASS(machine) — exit 0, 7.06s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files
  manual:    PASS(human) — Pavle smoke confirmed (list/edit/toggle)
**SCOPE_DRIFT:** none — exact 2 EXPECTED-FILES
**LESSONS:** unchanged (7/7 active)
**Notes:** Pure extraction — nulta promena ponašanja. AdminMenu.tsx 1353→939 LOC. Note: 939 LOC iznad exit-kriterijuma #1 (800 LOC) — komponentno splitting (editor forma / lista / action toolbar) biće H2.1.

---

## H1 — 2026-05-21 — AdminOrders lib extraction — DONE

**Tier:** STANDARD
**SHA:** 916e017
**Branch:** batch/h1-admin-orders-lib
**Files (2):**
  - src/lib/adminOrdersLib.ts — NEW 565 LOC; exports: OrderStatus/OrderRow/ParsedItem/MetaItem + 3 response types; ADMIN_API_BASE/PAYMENT_STATUS_MAP/STATUS_LABEL/BUSINESS_TIMEZONE consts; 28 pure helper fns (safeInt/safeDateTime/isEurOrder/parseOrderItems/pillClass/paymentPill/groupOrdersByBusinessDay/generateCsvExport/buildOrderSummary etc.) + 3 API call fns (adminFetchOrders/adminUpdateOrderStatus/adminResendTelegram)
  - src/components/AdminOrders.tsx — MODIFIED 1165→637 LOC (net −528); imports from adminOrdersLib; React hooks/state/JSX unchanged byte-for-byte; copyOrder ostaje u komponenti (setToastById dep)
**Verify:**
  build:     PASS(machine) — exit 0, 9.09s (local) + Vercel READY (iad1, 11 funkcija)
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files
  manual:    NIJE POKRENUTO — STANDARD tier
**SCOPE_DRIFT:** none — exact 2 EXPECTED-FILES
**LESSONS:** unchanged
**Notes:** Pure extraction — nulta promena ponašanja. AdminOrders.tsx 1165→637 LOC. adminOrdersLib.ts je template seam za buduće ordering/admin apps (zajedno sa api/_shared/, src/lib/parsing.ts, src/lib/config.ts). H2 AdminMenu sledeći.

---

## I4 — 2026-05-21 — Build SHA in monitoring init — DONE

**Tier:** LEAN
**SHA:** da8145b
**Branch:** batch/i4-build-sha-monitoring
**Files (3):**
  - vite.config.ts — MODIFIED; +define block: `import.meta.env.VITE_BUILD_SHA` = `process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown"`
  - src/vite-env.d.ts — MODIFIED; +`readonly VITE_BUILD_SHA?: string` to ImportMetaEnv
  - src/main.tsx — MODIFIED; version: `"unknown"` → `import.meta.env.VITE_BUILD_SHA ?? "unknown"` in initClientMonitoring call
**Verify:**
  build:     PASS(machine) — exit 0, 7.41s
  typecheck: PASS(machine) — exit 0
  test:      NIJE POKRENUTO — LEAN tier
  manual:    NIJE POKRENUTO — LEAN tier
**SCOPE_DRIFT:** none — exact 3 EXPECTED-FILES
**LESSONS:** unchanged
**Notes:** Git commit SHA injected at build time via Vite define block. On Vercel, `VERCEL_GIT_COMMIT_SHA` auto-set. Local dev: `VITE_BUILD_SHA` = `"unknown"` (acceptable). Exit criteria #5 closed. Faza I DONE ✓ — all 6 batches (I1/I2/I2.1/I2.2/I3/I4) closed.

---

## I3 — 2026-05-21 — Logger server sink — DONE

**Tier:** STANDARD
**SHA:** 8f9a0a8
**Branch:** batch/i3-logger-server-sink
**Files (2):**
  - api/log.ts — NEW; POST-only serverless; applyCors default; accepts ClientLogEvent[] (max 20); emits via console.error/console.warn → Vercel Runtime Logs; no auth, no DB write; normalizeEvent validates ts/level/message shape; returns {ok:true, received:N}
  - src/lib/logger.ts — MODIFIED; +import getApiBase from ./apiBase; +flushToServer(evt) fire-and-forget (void fetch().catch()); log() calls flushToServer(evt) for error-level only after localStorage pushEvent
**Verify:**
  build:     PASS(machine) — exit 0, 7.24s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files
  manual:    NIJE POKRENUTO — STANDARD tier (Vercel smoke not required; Vercel Build Logs awaited)
**SCOPE_DRIFT:** none — exact 2 EXPECTED-FILES
**LESSONS:** unchanged
**Notes:** Error-level client events now reach Vercel Runtime Logs automatically (fire-and-forget POST to /api/log). localStorage ring buffer unchanged — both channels active. api/log.ts follows same handler pattern as other api/ files (applyCors, isPlainObject from _shared/parsing.js, json helper). flushToServer uses void fetch().catch() to prevent unhandled rejection. version:"unknown" in initClientMonitoring stays — I4 will inject git SHA there.

---

## I2.2 — 2026-05-21 — Hobby plan slot reclaim — DONE

**Tier:** STRICT
**SHA:** 5b9d716
**Branch:** batch/i2.2-hobby-slot-reclaim
**Files (6):**
  - api/admin-menu.ts — MODIFY; absorbed image upload/delete from admin-menu-image.ts; +queryString helper +image helpers (decodeBase64Payload, detectExtension, sanitizeBaseName, extractStoragePath, isValidAdminPath) +handleImageUpload +handleImageDelete; op=image branch after owner check + parseJsonBody
  - api/admin-orders.ts — MODIFY; absorbed telegram resend from admin-resend-telegram.ts; +isPlainObject/normalizeText/safeInt import; +Telegram types + all helpers (formatOrderForTelegram etc.); +handleResendTelegram; CORS GET→GET,POST; op=resend-telegram branch; existing GET list logic netaknuta
  - api/admin-menu-image.ts — DELETE (324 LOC absorbed into admin-menu.ts)
  - api/admin-resend-telegram.ts — DELETE (426 LOC absorbed into admin-orders.ts)
  - src/pages/admin/AdminMenu.tsx — /api/admin-menu-image → /api/admin-menu?op=image (2 call sites: upload + delete)
  - src/components/AdminOrders.tsx — /api/admin-resend-telegram → /api/admin-orders?op=resend-telegram
**Verify:**
  build:     PASS(machine) — exit 0, 7.33s (local) + Vercel "Deployment completed" (iad1, 10 funkcija)
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files
  manual:    PASS(human) — Pavle: "prošlo" (preview URL; admin menu image upload/delete + telegram resend + orders list + menu list/save sve PASS)
**SCOPE_DRIFT:** none — exact 6 EXPECTED-FILES (4 modify + 2 delete)
**LESSONS:** rotated L0 (OneDrive) → DECISIONS.md deprecated; added L8 (Vercel Hobby 12-function limit + ?op= consolidation pattern)
**Notes:** Trigger: I3 dodao api/log.ts kao 13. serverless funkciju, Vercel Hobby plan limit je 12. Rešenje bez Pro plana: konsolidacija 2 mala admin handlera u roditelje via ?op= query routing. Broj funkcija: 13 → 10 (I3 i I4 još nisu merge-ovani; kada se merge-uju biće 11). Production ostao netaknut (na I2.1 stanju) tokom celog batch-a.

---

## I2.1 — 2026-05-21 — CORS env-driven allowlist — admin handlers — DONE

**Tier:** STANDARD
**SHA:** 3979261
**Branch:** batch/i2.1-cors-admin-handlers
**Files (8):**
  - api/admin-me.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"GET",allowHeaders:"content-type, x-requested-with, authorization"})
  - api/admin-orders.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"GET",allowHeaders:"content-type, x-requested-with, authorization"})
  - api/admin-settings.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"GET, POST",allowHeaders:"content-type, x-requested-with, authorization"})
  - api/admin-users.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"GET, POST",allowHeaders:"content-type, x-requested-with, authorization"})
  - api/admin-menu.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"GET, POST",allowHeaders:"content-type, x-requested-with, authorization"})
  - api/admin-menu-image.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"POST",allowHeaders:"content-type, x-requested-with, authorization"})
  - api/admin-update-order-status.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"POST",allowHeaders:"content-type, x-requested-with, authorization"})
  - api/admin-resend-telegram.ts — DELETE local setCors (8 LOC); +import applyCors; applyCors(req,res,{methods:"POST",allowHeaders:"content-type, x-requested-with, authorization"})
**Verify:**
  build:     PASS(machine) — exit 0, 7.11s (local) + Vercel Build Logs PASS (iad1)
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files
  manual:    PASS(human) — Vercel Build Logs clean; Pavle: "pass"
**SCOPE_DRIFT:** none — exact 8 EXPECTED-FILES
**LESSONS:** unchanged
**Notes:** All 8 admin handlers now use env-driven CORS allowlist via api/_shared/cors.ts. allowHeaders extended to include `authorization` (Bearer token auth required on all admin routes). headerString preserved in all files (still used by getBearerToken). admin-me setCors had different header order ("authorization, content-type") — normalized to standard form. CORS allowlist coverage complete: all 11 handlers (3 from I2 + 8 from I2.1) now use applyCors().

---

## I2 — 2026-05-21 — CORS env-driven allowlist — LOCK handlers — DONE

**Tier:** STRICT
**SHA:** 5b0ff6c
**Branch:** batch/i2-cors-allowlist
**Files (6):**
  - api/_shared/cors.ts — NEW; 84 LOC; applyCors(req, res, opts) reads ALLOWED_ORIGINS env (CSV) + VERCEL_URL preview auto-injection; parseAllowedOrigins() exported; ApplyCorsOpts: {methods, allowHeaders?}; headerValue private case-insensitive helper
  - api/_shared/cors.test.ts — NEW; 22 cases; parseAllowedOrigins (8: undefined/empty/single/multi/whitespace/dedupe/trailing-slash/double-comma) + applyCors (11: match/disallow/no-origin/empty-env/Vary/methods/headers/custom-headers/max-age/CI-key) + preview (3: VERCEL_URL allowed/non-preview-blocked/no-VERCEL_URL)
  - api/create-order.ts — LOCK; DELETE local setCors (8 LOC); +import applyCors; setCors→applyCors(req,res,{methods:"POST"})
  - api/bankart-order-status.ts — LOCK; DELETE local setCors (8 LOC) + headerString/headerStringCI (14 LOC, dead after setCors removal); +import applyCors; setCors→applyCors(req,res,{methods:"GET"})
  - api/telegram-new-order.ts — LOCK; DELETE local setCors (12 LOC); +import applyCors; setCors→applyCors(req,res,{methods:"POST",allowHeaders:"content-type,x-requested-with,x-telegram-secret"})
  - workflow/projects/padrino/ROADMAP.md — I2 scope corrected (STANDARD→STRICT, 1h→1.5h) + I2.1 row added
**Verify:**
  build:     PASS(machine) — exit 0, 3.83s (local) + Vercel Build Logs PASS (iad1, 15:04:08)
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 206/206, 17 files (+22 new cors.test.ts cases)
  manual:    PASS(human) — Vercel Build Logs clean; Pavle: "Sve ide normalno, pass"
**SCOPE_DRIFT:** none — exact 6 EXPECTED-FILES
**LESSONS:** unchanged
**Notes:** Scope corrected pre-plan (grep revealed reflect-any-origin in 11 handlers, ROADMAP said 1). Split C: I2 (LOCK 3, STRICT) + I2.1 (admin 8, STANDARD). Vercel env ALLOWED_ORIGINS=https://padrinobudva.com set (All Environments). bankart-order-status headerString/headerStringCI removed as dead code (setCors was sole caller). telegram headerStringCI preserved (x-telegram-secret runtime check). ALLOWED_ORIGINS pre-existed only in supabase Deno edge function (out of scope).

---

## I1 — 2026-05-21 — RLS admin_users membership policy — DONE

**Tier:** STRICT (live production schema migration)
**SHA:** 88c3967
**Branch:** none (schema migration, no src/api changes)
**Files (3):**
  - supabase/migrations/20260521120000_orders_rls_admin_membership.sql — NEW; DROP 3 allow_admin_*_by_email policies on orders + CREATE allow_self_read on admin_users + CREATE 3 membership-based allow_admin_select/update/delete on orders using EXISTS(SELECT 1 FROM admin_users WHERE email=jwt.email AND enabled=true); rollback SQL included as comment block
  - docs/rls-security-audit.md — MODIFIED; status updated from AUDIT-ONLY to "F1 RESOLVED (B14.1) F2 RESOLVED (I1)"; resolution table added
  - workflow/STATE.md — MODIFIED (active batch tracking, pre-execution bookkeeping)
**Verify:**
  build:      PASS(machine) — exit 0, 3.54s
  typecheck:  PASS(machine) — exit 0
  test:       PASS(machine) — 184/184, 16 files
  live-pre:   PASS(human) — Pavle potvrdio 3 _by_email policy-ja postoje u pg_policies
  live-post:  PASS(human) — allow_self_read na admin_users + allow_admin_select/update/delete na orders; stari _by_email policy-ji UKLONJENA
  manual:     PASS(human) — "admin radi" (/admin login + orders list)
**SCOPE_DRIFT:** acknowledged — workflow/STATE.md (workflow bookkeeping, active-batch tracking — nije code scope)
**LESSONS:** unchanged (7/7 cap)
**Notes:** F2 iz B14 audita (2026-05-16) CLOSED. pavlemitrovic01@gmail.com više nije hardkodovan u production DB-u. allow_self_read prerequisit omogućava EXISTS subquery u orders policy-jima da se razrješi. Sve admin API rute koriste service_role → bypass RLS → neafektovane. Direktni PostgREST pozivi sa authenticated JWT-om sada koriste membership check umjesto hardkodovanog emaila.

---

## G4.6 — 2026-05-21 — Extract useCatalogData hook + CheckoutView component — DONE

**Tier:** STRICT (lock zone CartDrawer.tsx, final G4 batch)
**SHA:** 17025f4 (batch) / b5ec256 (merge → main)
**Branch:** batch/g4.6-catalog-and-checkout-view
**Files (3):**
  - src/hooks/cart/useCatalogData.ts — NEW; 136 LOC; exports PizzaVariantsMap type; calls useCart() internally (addToCart + changeSize); 4 catalog useState slots (addonsCatalog/saucesCatalog/drinksCatalog/pizzaVariantsByBaseKey) + sauceIdSet useMemo; returns 7 values: pizzaVariantsByBaseKey/drinksCatalog/saucesCatalog/addonsCatalog/sauceIdSet/setPizzaSizeSafe/addDrinkToCart; onErrorRef = useRef(opts?.onError) stable-callback pattern (avoids exhaustive-deps); one-shot supabase catalog loader (menu_items is_active=true, order name asc) with mounted flag cleanup
  - src/components/CheckoutView.tsx — NEW; 429 LOC; flat component (not /cart/ subdir per convention); ~40 explicit props; deliveryZoneKey: DeliveryZoneKey | "" (matches useDeliveryZone actual useState initial — not null); direct imports: formatFeeEurShort from cartDrawerHelpers, BANKART_PAYMENTJS_*_DIV_ID/POLISH_CSS from useBankartPaymentJs, DELIVERY_ZONES/DeliveryZone from config; BTN_GOLD_ACTIVE/BTN_NEUTRAL/BTN_SUCCESS + PHONE_E164/PHONE_DISPLAY passed as props; byte-identical view="checkout" JSX relocation
  - src/components/CartDrawer.tsx — LOCK; 946 → 688 LOC (net −258); removed: 4 catalog useState + sauceIdSet useMemo + setPizzaSizeSafe fn + addDrinkToCart fn + loadCatalogs useEffect + changeSize/addToCart from useCart destructure + 13 stale imports (useMemo/supabase/PizzaSize/PizzaVariant/hasEurPrice/isPizzaRow/etc); added: useCatalogData import + 6-value hook destructure; view="checkout" JSX block replaced with <CheckoutView … /> call site (~60 props); submitOrder 176 LOC STAYS in CartDrawer
**Verify:**
  build:     PASS(machine) — exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 184/184, 16 files
  vercel:    PASS(human) — Vercel Build Logs clean (L6 gate clean, no TS2835)
  manual:    PASS(human) — Pavle: "Svi testovi pass" (golden-path smoke)
**SCOPE_DRIFT:** NONE — exact 3-file match EXPECTED-FILES
**LESSONS:** unchanged (7/7 cap)
**Notes:** Final G4 batch. Faza G DONE ✓. CartDrawer 688 LOC (target ~550-650 — achieved). Two type fixes during execution: (1) deliveryZoneKey prop type DeliveryZoneKey|null → DeliveryZoneKey|"" (actual useDeliveryZone useState initial ""); (2) formatFeeEurShort import corrected money.ts → cartDrawerHelpers. Stale ~17kb JSX block after initial Edit attempt required Node.js scripting. Advisory: pre-G4.6 CartDrawer was 946 LOC not 1056 as STATE/ROADMAP suggested (G4.2 verbose-destructure gap accumulated across G4.3-G4.5 closes without LOC recheck); W reconciliation will normalize.

---

## G4.5 — 2026-05-21 — Extract useSuccessState hook → src/hooks/cart/ — DONE

**Tier:** STRICT (NAJOPASNIJI G4 batch — Bankart return URL + status polling)
**SHA:** b7d989d (batch) / 1a69111 (merge → main)
**Branch:** batch/g4.5-use-success-state
**Files (2):**
  - src/hooks/cart/useSuccessState.ts — NEW; 334 LOC; custom React hook; takes {openCart, setView, setSubmitError} 3 callbacks; returns 16 values: 9 display state (successPaymentMethod/OrderId/PaymentStatus/Title/Subtitle/StatusNote/CheckingPayment/Copied/Summary) + 3 setters (PaymentMethod/Summary/CheckingPayment) + 4 actions (applySuccessUiState/resetSuccessState/copySuccessOrderId/closeBankartReturnFlow); owns: 9 useState + 3 useRef + 3 useEffect (successCopied reset on orderId change, unmount timer cleanup, Bankart return URL + polling loop 109 LOC with attempt cap + retry-after); module-level fetchBankartOrderStatus async fn (14 LOC); imports 6 from bankartReturnStorage (4 fns + 2 types + 2 storage helpers)
  - src/components/CartDrawer.tsx — LOCK; 1310 → 1056 LOC (net −254, recon predicted ~−255 — TAČNO NA METU); deleted: successPaymentMethod state (line 109) + 8 success-* useState + successCopiedTimerRef + 2 useEffects (successCopied reset + unmount cleanup) + copySuccessOrderId fn (25 LOC) + applySuccessUiState fn (62 LOC) + fetchBankartOrderStatus fn (14 LOC) + 2 useRef (bankartReturnHandledRef + bankartStatusTimerRef) + resetSuccessState fn (9 LOC) + handleCloseDrawer 6 cleanup lines + Bankart return useEffect (109 LOC); added: useSuccessState import + 18-LOC hook destructure + closeBankartReturnFlow() call in handleCloseDrawer; removed unused imports: useRef, BankartOrderPaymentStatus type, plus 5 bankartReturnStorage symbols (clearBankartReturnStorage/cleanBankartReturnUrl/getBankartReturnParams/readBankartReturnStorage/isPaymentStatusValue/isFinalPaymentStatusValue/BankartOrderStatusResponse) — CartDrawer keeps writeBankartReturnStorage only
**Verify:**
  build:     PASS(machine) — exit 0, 7.39s, 2197 modules
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 184/184, 16 files
  vercel:    PASS(human) — Vercel preview build clean (23s, 2197 modules)
  manual:    PASS(human) — Pavle confirmed Scenario A (card_redirect → return → paid): drawer auto-open, polling visible in Network, status transition "Provjeravamo uplatu" → "Uplata je uspješna", URL cleared, sessionStorage cleared
**SCOPE_DRIFT:** NONE — exact 2-file match EXPECTED-FILES
**LESSONS:** unchanged (7/7 cap; observation: react-hooks/set-state-in-effect rule does NOT fire in this hook's effects despite same patterns — inconsistent with G4.3 useDeliveryZone where same pattern fired; tooling quirk noted, not promoted)
**Notes:** NAJOPASNIJI G4 batch — kompletan post-payment flow (Bankart hosted page → return URL → status polling loop sa retry-after sekunde i attempt cap 6+2 error). LOC delta target hit on the nose (−254 vs predicted −255). Pre-execution Opus audit + AskUserQuestion za hook scope (bankartReturn ops centralizacija). Hook input 3 callbacks (openCart/setView/setSubmitError) — sve stable refs (useState setters + memoized context fn). closeBankartReturnFlow encapsulates 3 ops (timer-clear + storage-clear + url-clean) replacing 6 lines in handleCloseDrawer. Bankart return useEffect deps `[openCart]` preserved (bankartReturnHandledRef guard prevents duplicate runs). applySuccessUiState 62 LOC byte-identical relocation (7 paymentStatus branchova). fetchBankartOrderStatus moved to module-level inside hook file (no React state needed). Post-G4.5 CartDrawer is 1056 LOC — last remaining G batch is G4.6 (useCatalogData + CheckoutView ~−370 LOC predicted) → final target ~550-650 LOC orchestrator. Pavle cost-saving smoke: admin /admin/menu cena na 0.10 EUR test item.

---

## G4.4 — 2026-05-21 — Extract useBankartPaymentJs hook → src/hooks/cart/ — DONE

**Tier:** STRICT
**SHA:** 20a05f0 (batch) / 56c7a8c (merge → main)
**Branch:** batch/g4.4-use-bankart-payment-js
**Files (2):**
  - src/hooks/cart/useBankartPaymentJs.ts — NEW; 204 LOC; custom React hook; 3 named exports (BANKART_PAYMENTJS_NUMBER_DIV_ID, BANKART_PAYMENTJS_CVV_DIV_ID, BANKART_PAYMENTJS_POLISH_CSS) + useBankartPaymentJs hook; takes {isOpen, view, paymentMethod}; returns 7 values: paymentJsRequested/MissingKey/Ready/Loading/InitError/ControllerRef/resetPaymentJs; owns: 3 useState + 1 useRef + 1 useEffect (117 LOC init effect with createBankartPaymentJs async chain, style objects, focus/blur listeners, cleanup); inline `import.meta.env as {...}` cast for VITE_BANKART_PAYMENTJS_PUBLIC_KEY/ENABLED (no ambient declare needed)
  - src/components/CartDrawer.tsx — LOCK; 1459 → 1310 LOC (net −149, recon predicted ~−150 — favorable variance); deleted: 3 module-level constants (CSS template 22 LOC + 2 ID consts) + 8 lines state/flags block (paymentJsPublicKey/FeatureEnabled/Requested/MissingKey/ControllerRef/Ready/Loading/InitError) + 2 lines paymentJs dispose from unmount cleanup + 117 LOC init useEffect + 5 lines handleCloseDrawer reset block + 5 lines isOpen reset block; added: useBankartPaymentJs + 3 constants imports + 9-LOC hook destructure + 2× resetPaymentJs() calls; removed unused imports: createBankartPaymentJs, BankartPaymentJsController (was used only for inferred local var tip), envFlagEnabled (was only for paymentJsFeatureEnabled which moved to hook)
**Verify:**
  build:     PASS(machine) — exit 0, 6.89s, 2195 modules
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 184/184, 16 files
  vercel:    PASS(human) — Bankart test-mode transaction completed successfully on preview deploy
  manual:    PASS(human) — Pavle confirmed: "sve pass, nigde nema error, transakcija prosla" (full Bankart card flow via admin-priced 0.10 EUR test item)
**SCOPE_DRIFT:** NONE — exact 2-file match EXPECTED-FILES
**LESSONS:** unchanged (7/7 cap; observation: react-hooks/set-state-in-effect rule fires only on FIRST setState in branch within complex effects — 1 disable-next-line needed vs 6 originally added, 5 removed; not promoted to lesson — tooling quirk, documented inline)
**Notes:** Largest single hook extraction so far (init effect 117 LOC byte-identical relocation incl. style objects + focus/blur listeners + Promise chain). LOC delta hits recon target on the nose (−149 vs predicted −150). Pre-execution Opus audit caught 3 plan corrections: (1) hook return reduced from 9 to 7 values — paymentJsPublicKey/FeatureEnabled unused outside hook init; (2) hook call lokacija on line ~139 (replace state block) not ~507 (before useCheckoutForm); (3) BankartPaymentJsController + envFlagEnabled would be unused in CartDrawer post-extraction → preemptively removed. Cost-saving smoke: production admin /admin/menu cena na 0.10 EUR → preview-mode test card transaction → vraćena cena. Real Bankart payment.js flow verifikovan (number+CVV iframes render + tokenize + redirect/success). Hook input semantics byte-identical (5 deps array preserved: isOpen/view/paymentMethod/paymentJsFeatureEnabled/paymentJsPublicKey).

---

## G4.3 — 2026-05-21 — Extract useDeliveryZone hook → src/hooks/cart/ — DONE

**Tier:** STRICT
**SHA:** 8e35c58 (batch) / 4265e11 (merge → main)
**Branch:** batch/g4.3-use-delivery-zone
**Files (2):**
  - src/hooks/cart/useDeliveryZone.ts — NEW; 158 LOC; custom React hook; takes items: CartItem[]; returns 16 values: deliveryZoneKey/isZoneOpen/setIsZoneOpen/deliveryFeeOverride/setDeliveryFeeOverride/selectZone/zoneBtnRef/zonePanelRef/totalItems/subtotalCents/selectedDeliveryZone/qualifiesForFreeDelivery/missingToFreeDeliveryCents/deliveryFeeCents/effectiveTotalCents; owns: 3 useState, 2 useRef, 6 useMemo, 3 useEffect (reset on zone change + reset when qualifies for free + click-outside/Escape panel)
  - src/components/CartDrawer.tsx — LOCK; 1543 → 1459 LOC (net −84); deleted: 3 useState + 2 useRef + 6 useMemo + effectiveTotalCents + 3 useEffect (zone resets × 2 + click-outside) + inline handleSelectZone body; added: useDeliveryZone import + 18-LOC hook destructure + thin handleSelectZone wrapper (selectZone + setSubmitError)
**Verify:**
  build:     PASS(machine) — exit 0, 7.84s, 2195 modules
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 184/184, 16 files
  vercel:    PASS(human) — Build Logs clean (Pavle: "sve je clean, logs pass")
  manual:    PASS(human) — Pavle confirmed: zone picker, click-outside, Escape, free delivery threshold, deliveryFeeOverride, handleCloseDrawer reset
**SCOPE_DRIFT:** NONE — exact 2-file match EXPECTED-FILES
**LESSONS:** unchanged (7/7 cap; eslint react-hooks/set-state-in-effect fires in hooks not components — reset patterns documented with disable-next-line in hook)
**Notes:** LOC delta: predicted −110 (from recon baseline ~1513), actual −84 (real post-G4.2 baseline 1543 — G4.2 was +30 above predicted). Effective variance vs actual baseline: −84 vs expected ~−110 — cosmetic; verbose 18-LOC destructure. effectiveTotalCents moved from inline const to hook return (identical semantics: subtotalCents + deliveryFeeCents). canSubmit stays in CartDrawer. G4.4 next — HIGH RISK (PaymentJS controller ref + 118 LOC init effect; Bankart test-mode checkout smoke REQUIRED pre-close).

---

## G4.2 — 2026-05-20 — Extract useCheckoutForm hook → src/hooks/cart/ — DONE

**Tier:** STRICT
**SHA:** 98bb4ab (batch) / 49a533b (merge → main)
**Branch:** batch/g4.2-use-checkout-form
**Files (2):**
  - src/hooks/cart/useCheckoutForm.ts — NEW; 352 LOC; custom React hook; 11 input params (submitAttempted, paymentMethod, paymentJsRequested/MissingKey/Loading/InitError/Ready, deliveryZoneKey, selectedDeliveryZone, qualifiesForFreeDelivery, deliveryFeeOverride); returns ~30 values (10 fields + 10 trims + 7 validities + 12 errors + 11 shouldValidate flags + 2 billing handlers + validation hint + invalidFieldLabels); owns: 10 useState (name/phone/address/orderNote/customerEmail/billingCity/billingPostcode/cardholder/expMonth/expYear), 7 useMemo validations, billingCity/PostcodeTouchedRef useRefs, checkout defaults supabase loader useEffect; imports supabase + toSiteSettingsCheckoutDefaults + formatFeeEurShort + DEFAULT_BILLING_CITY/POSTCODE + DeliveryZone/Key types
  - src/components/CartDrawer.tsx — LOCK; 1729 → 1543 LOC (net −186); deleted: 10 fields + trims + 7 validations + 2 touched refs + 2 billing handlers + checkout defaults useEffect + 11 shouldValidate flags + 12 errors + invalidFieldLabels + shouldShowValidationHint + checkoutValidationHint; added: useCheckoutForm import + 65-LOC hook destructure block (one key per line for readability); removed unused imports: toSiteSettingsCheckoutDefaults, DEFAULT_BILLING_CITY, DEFAULT_BILLING_POSTCODE; invalidFieldLabels dropped from destructure (TS6133 — unused in CartDrawer, still computed internally for checkoutValidationHint)
**Verify:**
  build:     PASS(machine) — local exit 0, 7.59s; Vercel preview 23s, 2194 modules transformed
  typecheck: PASS(machine) — exit 0 (re-verified at /close)
  test:      PASS(machine) — 184/184, 16 files (re-verified at /close)
  manual:    PASS(human) — Pavle "Mislim da treba close" post-Vercel-deploy
  vercel:    PASS(human) — Build Logs clean, 2194 modules, 23s build
**SCOPE_DRIFT:** NONE — exact 2-file match EXPECTED-FILES
**LESSONS:** unchanged (7/7 cap; pure logic relocation = no new learning)
**Notes:** Per-batch branch batch/g4.2-use-checkout-form merged main SHA 49a533b. First module in src/hooks/cart/ — directory established for G4.3 (useDeliveryZone) + G4.4 (useBankartPaymentJs) + G4.5 (useSuccessState). LOC variance: predicted target 1480-1530, actual 1543 (13 LOC above ceiling) — cause was destructure block 65 LOC (one key per line) vs recon estimate ~33 LOC; cosmetic, not behavioral; recon was conservative about destructure formatting. Pre-flight false-start: /close G4.2 invoked before G4.2 was executed; agent caught and REFUSED, then executed implementation correctly after Pavle confirmation. Hook takes 11 cross-cutting input params from CartDrawer state (paymentJS + delivery zone + submitAttempted) — coupling intentional, narrows after G4.3+G4.4 own their state.

---

## G4.1 — 2026-05-20 — Extract bankartReturnStorage helpers → src/lib/ — DONE

**Tier:** STRICT
**SHA:** f5cd267 (batch) / 666fe4b (merge → main)
**Branch:** batch/g4.1-bankart-return-storage
**Files (3):**
  - src/lib/bankartReturnStorage.ts — NEW; 133 LOC; 11 exports (3 types BankartOrderPaymentStatus/BankartOrderStatusResponse/BankartReturnStorage + 1 const BANKART_RETURN_STORAGE_KEY + 7 functions isPaymentStatusValue/isFinalPaymentStatusValue/getBankartReturnParams/readBankartReturnStorage/writeBankartReturnStorage/clearBankartReturnStorage/cleanBankartReturnUrl); byte-identical relocation from CartDrawer.tsx; imports type PaymentMethod from "../context/CartContext" + toSafeInt from "./money" (no circular deps)
  - src/components/CartDrawer.tsx — LOCK; 1848 → 1730 LOC (net −118; recon predicted −95, actual variance favorable); deleted: 3 type defs (BankartOrderPaymentStatus/Response/Storage), BANKART_RETURN_STORAGE_KEY const, 7 functions (isPaymentStatusValue..cleanBankartReturnUrl); added: 10-line import block; BANKART_PAYMENTJS_* constants RETAINED (G4.4), MenuItemData/DrawerView/PizzaVariantsMap types RETAINED; BankartReturnStorage type dropped from import block (only used inside extracted functions — TS6133 fix)
  - src/components/CartDrawerSuccessView.tsx — LOCK; ±1 LOC (1 line inline type → 1 import); F4.2 pattern dedup: BankartOrderPaymentStatus now imported from lib instead of local inline duplicate
**Verify:**
  build:     PASS(machine) — local exit 0, 7.36s; Vercel preview 24s, 2193 modules transformed
  typecheck: PASS(machine) — exit 0 (re-verified at /close)
  test:      PASS(machine) — 184/184, 16 files (re-verified at /close)
  manual:    PASS(human) — Pavle "Smoke prosao" post-Vercel-deploy
  vercel:    PASS(human) — Build Logs clean, 2193 modules, 24s build
**SCOPE_DRIFT:** NONE — exact 3-file match EXPECTED-FILES
**LESSONS:** unchanged (7/7 cap; byte-identical relocation = no new learning)
**Notes:** Per-batch branch batch/g4.1-bankart-return-storage merged main SHA 666fe4b. First G4.x execution batch (G4.0 was recon). LOC variance: recon predicted Δ−95, actual Δ−118 (favorable direction — recon was conservative about blank-line counting between extracted functions; no behavioral signal). G4.5 (useSuccessState) will re-import these lib types/functions; G4.4 (useBankartPaymentJs) keeps separate BANKART_PAYMENTJS_* const block.

---

## G4.0 — 2026-05-20 — CartDrawer structural recon — DONE

**Tier:** STRICT (recon-only, doc change)
**SHA:** 7c42e40
**Files (2):**
  - workflow/projects/padrino/DECISIONS.md — +123 LOC; new section "2026-05-20 — G4 split recon (G4.0)"; full inventar 1848 LOC CartDrawer.tsx (7 module-level + 43 component-body sekcije); split predlog G4.1..G4.6 sa EXPECTED-FILES, LOC delta, Bankart smoke scope per batch; 3 high-risk coupling points dokumentovana (paymentJsControllerRef×4 sites, applySuccessUiState×2 callers, bankartStatusTimerRef shared)
  - workflow/projects/padrino/ROADMAP.md — G4 single row razbit u G4.0 (DONE) + G4.1..G4.6 (Planned); Current Phase stale "1898→1612" korigovano u "net −319, post-G3 = 1848"; G4.6 LOC target realism noted (~550–650, not 300)
**Verify:**
  build:     PASS(machine) — exit 0, 11.33s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 16 files, 184 tests, exit 0
  manual:    N/A (no code change; doc review confirmed by /close invocation)
**SCOPE_DRIFT:** NONE — 2 fajla, exact match EXPECTED-FILES
**LESSONS:** unchanged (7/7 cap)
**Notes:** Pre-plan forensic recon (analogous to G2.0). Drift fix: G3 LOG recorded CartDrawer 1898→1612, ali wc -l shows 1848 post-G3 (G3 net delta −319 iz d2ae678 commit stat). "1898→1612" bio stale number u ROADMAP; korigovano. Realistic thin-orchestrator LOC after G4.1–G4.6 ≈ 550–650; optional G4.7 (useOrderSubmission) needed for true ~300 — Pavle decides after G4.6.

---

## G3 — 2026-05-20 — Extract CartView (item list / qty controls / addons / sauces / drinks) — DONE

**Tier:** STRICT
**SHA:** d2ae678
**Files (2):**
  - src/components/CartView.tsx — NEW; 362 LOC; 26-prop interface (4 state + 12 handlers + 4 catalogs/sets + 5 CSS class constants); no top-level null-gate (gate at call site: view === "cart"); JSX body = CartDrawer lines 1805-2129 extracted; handles: empty state, items.map (item card + qty panel + addons + sauces + per-item drinks + note), multi-item drinks catalog; drinksScrollRef owned internally (useRef — see SCOPE_DRIFT notes)
  - src/components/CartDrawer.tsx — LOCK; 1898 → 1612 LOC (−286); import CartView added; lines 1804-2130 replaced with <CartView /> call site (~30 lines); orphan imports removed (isStuffedCrustAddonName, stuffedCrustPriceForSize, SmartCartImage, SmartMiniAddonImage); restoreDrinksScroll removed; addDrinkToCart simplified (scroll logic moved to CartView); drinksScrollRef definition removed
**Verify:**
  build:     PASS(machine) — exit 0, 3.55s, 2192 modules (local) + Vercel preview clean
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 16 files, 184 tests, exit 0
  manual:    PASS(human) — Pavle smoke: cart UI fully functional on preview URL
  vercel:    PASS(human) — Build Logs clean (2192 modules, nema TS grešaka)
**SCOPE_DRIFT:** acknowledged (within 2-file boundary — no extra files; semantic drift in CartDrawer):
  react-hooks/refs v7.0.1 (eslint-plugin-react-hooks) flags ref={props.someRef} pattern in
  child components — "Cannot access refs during render." Fix: moved drinksScrollRef ownership
  to CartView (useRef internal). Scroll restoration (restoreDrinksScroll double-RAF) migrated
  into CartView Dodaj-drink click handlers. addDrinkToCart in CartDrawer simplified to pure
  addToCart call. User-observable behavior identical (same double-RAF scroll preservation).
  L8 candidate: not added — LESSONS at 7/7 cap, existing entries more broadly applicable.
**LESSONS:** unchanged (7/7 cap)
**Notes:** Per-batch branch batch/g3-cart-view; Vercel preview auto-deployed.
  CartDrawer LOC progression: ~2293 (pre-G1) → ~2090 (post-G2) → 1612 (post-G3).
  Lock zone CartDrawer.tsx: submit/tokenize/PaymentJS init useEffect/Bankart return NETAKNUTI.
  G3 closes the cart-view pillar. Only G4 (CartDrawer → thin orchestrator ~300 LOC) remains in Faza G.

---

## G2.2 — 2026-05-20 — Extract CardFields (Sigurna Bankart polja + PaymentJS UI) — DONE

**Tier:** STRICT
**SHA:** 8ecd75d
**Files (2):**
  - src/components/CardFields.tsx — NEW; 153 LOC; 20-prop interface (5 PaymentJS flags + 4 form values + 4 setters + 4 errors + 3 DOM IDs/CSS); no top-level null-gate (status panel always renders); inline expMonth/expYear transforms preserved in JSX (R8); byte-identical from CartDrawer 1723-1843
  - src/components/CartDrawer.tsx — LOCK; -121 LOC inline replaced with `<CardFields />` call site (22 lines); import added; DOM IDs/CSS passed as props (CartDrawer = source-of-truth)
**Verify:**
  build:     PASS(machine) — exit 0, 8.63s (local) + 5.74s (Vercel preview)
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 16 files, 184 tests, exit 0
  manual:    PASS(human) — Pavle smoke: status panel always visible, PaymentJS UI gated by paymentJsRequested, email/cardholder/expFields work, iframe divs present, CSS injection
  vercel:    PASS(human) — Build Logs clean (tsc-b + vite build ✓ 5.74s, nema TS grešaka)
**SCOPE_DRIFT:** none (2 fajla = exact EXPECTED-FILES; git diff --name-only HEAD~1..HEAD)
**LESSONS:** unchanged (7/7 cap; no new lesson — first-try, no surprises)
**Notes:** Per-batch branch batch/g2.2-card-fields → merged to main post-/close.
  G2 fully extracted: G2.1 BillingFields + G2.2 CardFields DONE.
  PaymentJS init useEffect + tokenize stay in CartDrawer (correct — per G2.0 recon §4 deferred).
  Lock zone CartDrawer.tsx NETAKNUT (submit/tokenize/init useEffect/Bankart return).
  CartDrawer LOC: ~2293 (pre-G1) → ~2090 net (G1 -44, G2.1 -38, G2.2 -121 = -203 LOC).

---

## G2.1 — 2026-05-20 — Extract BillingFields (Podaci za naplatu panel) — DONE

**Tier:** STRICT
**SHA:** 453c9a7
**Files (2):**
  - src/components/BillingFields.tsx — NEW; 52 LOC; 7-prop interface (paymentJsRequested/billingCity/billingPostcode/onBillingCityChange/onBillingPostcodeChange/billingCityError/billingPostcodeError); internal null-gate returns null when !paymentJsRequested; byte-identical JSX from CartDrawer 1712-1749
  - src/components/CartDrawer.tsx — LOCK; -38 LOC inline replaced with `<BillingFields />` call site; import added line 33
**Verify:**
  build:     PASS(machine) — exit 0, 9.10s (local) + 7.81s (Vercel preview)
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 16 files, 184 tests, exit 0
  manual:    PASS(human) — Pavle smoke: Vercel preview card mode → billing panel renders identically; empty billing → error display; valid billing → CardFields inline (G2.2 still inline)
  vercel:    PASS(human) — Build Logs clean (tsc-b + vite build ✓ 7.81s, nema TS grešaka)
**SCOPE_DRIFT:** none (2 fajla = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; no new lesson — first-try, no surprises)
**Notes:** Per-batch branch batch/g2.1-billing-fields → merged to main post-/close.
  Lock zone CartDrawer.tsx NETAKNUT (submit/tokenize/paymentJS init useEffect/Bankart return stays).
  Touched refs (billingCityTouchedRef/billingPostcodeTouchedRef) stay in CartDrawer via
  wrapper handlers handleBillingCityChange/handleBillingPostcodeChange.
  L7 false-green risk acknowledged — PaymentSection JSX zero test coverage; smoke is gate.

---

## G2.0 — 2026-05-20 — G2 PaymentSection forensic recon — DONE

**Tier:** LEAN
**SHA:** bc3dd12
**Files (1):**
  - docs/g2-paymentsection-recon.md — NEW; 336 LOC; pre-plan forensic mapping for G2.1 + G2.2 (JSX boundaries lines 1710-1873, state surface, PaymentJS init useEffect details, Bankart return separation, submit tokenize path, module-top constants, validation surface, test gap L7, props inventories — G2.1: 7 props, G2.2: ~20 props, risk register, next-session flow). Mirrors cartdrawer-extraction-audit.md pattern.
**Verify:**
  build:     PASS(machine) — exit 0, 6.93s
  typecheck: PASS(machine) — exit 0
  test:      NIJE POKRENUTO — LEAN tier, doc-only no behavior change
  manual:    NIJE POKRENUTO — doc-only
**SCOPE_DRIFT:** none (1 file = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap)
**Notes:** Audit-doc batch following decisions locked 2026-05-20:
  - G2 split into G2.1 (BillingFields, ~38 LOC) + G2.2 (CardFields, ~120 LOC)
  - DOM IDs/CSS: props passing (constants stay in CartDrawer)
  - G1 merged to main first (SHA e258fc3) for clean G2 baseline
  Direct commit on main (LEAN convention; no per-batch branch).
  Doc persists G2 recon across session boundary — next session /plan G2.1 reads from here.

---

## G1 — 2026-05-20 — Extract CheckoutForm (name/phone/address inputs) — DONE

**Tier:** STRICT
**SHA:** 12574ce
**Files (2):**
  - src/components/CheckoutForm.tsx — NEW; presentational; Fragment return; 9 props (name/phone/address values + setters + errors); zero imports (React 19 auto JSX runtime, no hooks, no helpers)
  - src/components/CartDrawer.tsx — import added + JSX block lines 1539-1582 replaced with `<CheckoutForm ... />` (9 explicit props); state/validation/error compute/handlers untouched
**Verify:**
  build:     PASS(machine) — exit 0, 7.00s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 16 files 184 tests
  lint:      PASS(machine) — exit 0
  manual:    PASS(human) — Vercel preview smoke 2026-05-20 (Pavle): cart→checkout, empty-submit 3 errors, valid fill, cash flow success, card flow billing/card fields intact
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; no new lesson — G1 executed clean; pre-plan recon caught JSX boundary issue proactively)
**Notes:** First STRICT extraction in Faza G CartDrawer rebuild sequence.
  G1-narrow scope chosen: only name/phone/address block (lines 1539-1582).
  Delivery zone selector, payment method panel, billing/card fields remain in CartDrawer for G2-G4.
  CartDrawer.tsx now 2281 LOC (was 2325 before G1 code commit; net -44 in lock zone).
  Per-batch branch batch/g1-checkout-form pushed; merge to main follows /close commit.

---

## F4.2 — 2026-05-19 — cartDrawerHelpers + publicBusinessSettings config dedup — DONE

**Tier:** LEAN
**SHA:** d4e8876
**Files (2):**
  - src/lib/cartDrawerHelpers.ts — inline DEFAULT_BILLING_CITY/POSTCODE consts removed; imported from ./config
  - src/lib/publicBusinessSettings.ts — DEFAULT_PUBLIC_BUSINESS_SETTINGS.default_city/postcode literals → DEFAULT_BILLING_CITY/POSTCODE import from ./config
**Verify:**
  build:     PASS(machine) — exit 0, 5.11s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 16 files 184 tests (unchanged — no new tests for LEAN)
  manual:    NIJE POKRENUTO — LEAN tier, value-identical dedup (no behavior change, value-side proven by F4.1 manual smoke)
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; F4.2 surfaces recurring "recon depth" theme — pre-plan grep scope must include src/lib/, not just src/components/. Insight noted but not lesson-grade: F4.1 plan-recon miss; same flavor as L7 first finding ("test pattern coverage"))
**Notes:** Audit-driven follow-up to F4.1 (Pavle pre-merge audit caught two-source-of-truth gap).
  src/lib/config.ts is now THE single src/ template-swap point for billing defaults.
  Audit grep verifies "Budva"/"85310" literals in src/lib/ exist ONLY in config.ts (DELIVERY_ZONES label "Budva" is zoneLabel string, semantically separate from city default).
  publicBusinessSettings.ts:39 FOOTER_ADDRESS_FALLBACK still contains "Budva" inline — out of scope (composite address string, not pure config; J1 template crystallization territory).

---

## F4.1 — 2026-05-19 — src/ Config seam mirror — DONE

**Tier:** STRICT
**SHA:** efa313e
**Files (6):**
  - src/lib/config.ts — NEW (4 exports: SITE_URL/DEFAULT_BILLING_CITY/DEFAULT_BILLING_POSTCODE + DeliveryZoneKey/DeliveryZone types + DELIVERY_ZONES array)
  - src/lib/config.test.ts — NEW (5 shape-contract tests, no literal value assertions — F4 pattern)
  - src/components/CartDrawer.tsx (LOCK) — inline DeliveryZoneKey/DeliveryZone types + DELIVERY_ZONES const + DEFAULT_BILLING_CITY/POSTCODE → import from src/lib/config
  - src/App.tsx (LOCK) — 3× "https://padrinobudva.com" literals → SITE_URL import from src/lib/config
  - src/lib/adminApiBase.ts — 1× "https://padrinobudva.com" → SITE_URL import from ./config
  - src/seo/PizzaBudvaPage.tsx — SITE_URL/PAGE_URL local consts → SITE_URL import from ../lib/config; PAGE_URL derived from SITE_URL
**Verify:**
  build:     PASS(machine) — exit 0, 7.38s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 16 files 184 tests (+5 config.test.ts shape-contract)
  manual:    PASS(human) — Pavle confirmed smoke: cart zones, admin login, /pizza-budva JSON-LD, /faq canonical
**SCOPE_DRIFT:** none (6 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; clean refactor, DeliveryZone type unused-explicit → TypeScript inference caught pre-commit — minor, not lesson-grade)
**Notes:** src/ template-swap point complete. DELIVERY_ZONES values byte-identical (8/8 verified).
  DeliveryZone type removed from CartDrawer import (inferred from DELIVERY_ZONES.find() — no explicit annotation).
  moduleResolution Bundler confirmed for src/ → L6 .js extension NOT required (api/-only constraint).
  Faza F DONE: F1✓ F1.1✓ F2 won't-execute✓ F3✓ F4✓ F4.1✓. Sledeći: Faza G (CartDrawer rebuild, STRICT).

---

## F4 — 2026-05-19 — Config seam module — DONE

**Tier:** STANDARD
**SHA:** 2fdff83
**Files (4):**
  - api/_shared/config.ts — NEW (5 exports: BANKART_FALLBACK_EMAIL/CITY/POSTCODE/BANKART_DESCRIPTION_PREFIX/DEFAULT_PUBLIC_HOST)
  - api/_shared/config.test.ts — NEW (5 shape-contract smoke tests, no literal value assertions)
  - api/create-order.ts (LOCK) — inline consts removed; BANKART_FALLBACK_EMAIL/CITY/POSTCODE/DESCRIPTION_PREFIX → config.js import; description literal updated to use BANKART_DESCRIPTION_PREFIX
  - api/_shared/public-url.ts — hardcoded "https://padrinobudva.com" → DEFAULT_PUBLIC_HOST from config.js import
**Verify:**
  build:     PASS(machine) — exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 15 files 179 tests
  preview:   PASS(machine) — Vercel Build Logs clean (SHA 2fdff83)
  manual:    PASS(human) — Pavle confirmed "proslo, /close f4"
**SCOPE_DRIFT:** none (4 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; F4 executed clean, no new recurring-mistake pattern)
**Notes:** Template-swap point established on api/ side — fork to app#2 edits config.ts + env vars,
  no other api/ change required. Tests assert shape contracts only (non-empty, correct form) —
  intentionally no literal value assertions so template-swap doesn't pay test maintenance cost.
  5th constant BANKART_DESCRIPTION_PREFIX found during pre-execution recon (initial scan missed
  create-order.ts:667 description literal). F4.1 (STRICT) deferred: src/ side mirror
  (DELIVERY_ZONES in CartDrawer.tsx, SEO URLs in App.tsx/adminApiBase.ts/PizzaBudvaPage.tsx).
  Faza F: F1✓ F1.1✓ F2 won't-execute✓ F3✓ F4✓; F4.1 next (STRICT).

---

## F3 — 2026-05-19 — api/_shared/parsing.ts formalization — DONE

**Tier:** STRICT
**SHA:** bf5d2e8
**Files (12):**
  - api/_shared/parsing.ts — NEW (4 exports: isPlainObject/normalizeText/safeInt/safeNumber)
  - api/_shared/parsing.test.ts — NEW (11 smoke tests)
  - api/admin-settings.ts — isPlainObject inline → import
  - api/admin-users.ts — isPlainObject inline → import
  - api/admin-menu.ts — isPlainObject inline → import
  - api/admin-menu-image.ts — isPlainObject inline → import
  - api/admin-update-order-status.ts — isPlainObject inline → import
  - api/admin-resend-telegram.ts — isPlainObject/normalizeText/safeInt inline → imports
  - api/create-order.ts (LOCK) — isPlainObject/normalizeText/safeInt/safeNumber inline → imports
  - api/bankart-callback.ts (LOCK) — isPlainObject/safeNumber inline → imports
  - api/bankart-order-status.ts (LOCK) — isPlainObject/safeNumber inline → imports
  - api/telegram-new-order.ts (LOCK) — isPlainObject/normalizeText/safeInt inline → imports
**Verify:**
  build:     PASS(machine) — exit 0, ✓ built in 7.36s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 14 files 174 tests
  preview:   PASS(machine) — Vercel Build Logs clean (SHA bf5d2e8), no TS2835
  manual:    PASS(human) — Pavle confirmed "stize i sve radi kako treba"
**SCOPE_DRIFT:** none (12 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; F3 executed clean, no new recurring-mistake pattern)
**Notes:** Variant A canonical isPlainObject (matches src/lib/parsing.ts:15); safeNumber
  default normalized 0→NaN (all 7 call sites pass explicit fallback — zero behavior change);
  safeInt byte-identical across 3 api/ sites (unlike src/ where semantics diverged — F1
  exclusion did not apply here). L6 .js extension on all imports, first-try. Faza F:
  F1✓ F1.1✓ F2 won't-execute✓ F3✓; F4 (Config seam module, STANDARD) next.

---

## W7 — 2026-05-19 — F2 won't-execute reconciliation — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** 9372fad
**Files (2):**
  - workflow/projects/padrino/ROADMAP.md — F2 row marked WON'T EXECUTE
    with B2 audit citation; Current Phase prose advanced F2 → F3
    (api/_shared/parsing.ts formalization); Notes section appended with
    F2 won't-execute reasoning (analogous to B5 pattern).
  - workflow/projects/padrino/DECISIONS.md — appended dated entry
    "2026-05-19 — W7: F2 (src/lib/zones.ts) WON'T EXECUTE" with full
    findings (2 zone systems / dead code / target invalid for api code
    per L6 / live-dead branch mixing in getDeliveryFeeCentsFromMeta /
    refactor-not-rewrite strategy), 4-option table (A chosen), and
    code disposition (server dead code stays; client DELIVERY_ZONES
    candidate for F4 Config seam).
**Verify:**
  build:     PASS(machine) — exit 0, 4.30s, 19 chunks
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      NIJE POKRENUTO — doc-only batch, no code changed (LEAN tier convention)
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = 9372fad)
**LESSONS:** unchanged (cap 7/7 — W7 is a scope-recon decision, not a
  recurring-mistake lesson; "audit-first before lock-zone extraction" is
  already implicit in CONTEXT lock-zone rule + memory feedback_lockzone_dedup)
**Notes:** Trigger = /plan F2 invocation. Scope recon revealed ROADMAP F2 line
  conflated server polygon (api/create-order.ts, dead per B2 2026-05-11) with
  client static list (CartDrawer DELIVERY_ZONES, F4 Config seam territory);
  target `src/lib/zones.ts` invalid for api code per L6 build boundary.
  Decision: Opcija A (skip + advance to F3), analogous to B5 won't-execute
  pattern (B5 was CONDITIONAL on B2, B2 found no bug → B5 won't execute).
  Server dead code remains in place — deletion = own STRICT batch if pursued,
  not silently absorbed here. Lock-zone safety preserved; refactor-not-rewrite
  locked strategy upheld (ROADMAP 2026-05-17 Current Phase). Close /close (b2)
  ROADMAP-update step = no-op for W7 (W has no own ROADMAP row; F2 row already
  updated by W7's own scope earlier in 9372fad). Sledeći → F3.

---

## W6 — 2026-05-19 — post-F1.1 partial-close cleanup — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** d07172d
**Files (2):**
  - workflow/projects/padrino/ROADMAP.md — Current Phase prose advanced:
    "F1 DONE 2026-05-18; F1.1 next (STRICT, lock zone — App.tsx)"
    → "F1 + F1.1 DONE 2026-05-18; F2 next (STRICT, lock zone —
    create-order.ts/CartDrawer.tsx zones extraction)".
  - workflow/LOG.md — W4 entry SHA backfilled: placeholder
    `_(filled post-commit — see git log / final report)_` → `5b55f42`
    (verified: `git log -1 5b55f42` = "workflow: close W4 ROADMAP
    reconciliation (post-orphan-files scope drift fix)").
**Verify:**
  build:     PASS(machine) — exit 0, 3.65s, 19 chunks (audit pre-W6)
  typecheck: PASS(machine) — exit 0 (audit pre-W6)
  test:      PASS(machine) — exit 0, 13 files, 163 tests (audit pre-W6)
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = d07172d)
**LESSONS:** unchanged (cap 7/7 — W6 is partial-close artifact cleanup,
  not a recurring-mistake lesson)
**Notes:** Root cause = previous /close runs interrupted by context limit
  (Pavle reported "udario sam u limit na pola poruke"). F1.1 close left
  ROADMAP Current Phase prose stale; W4 close (5b55f42) left its own SHA
  placeholder in LOG.md. **Two-commit pattern used** (vs single "workflow:
  close W6") so W6's own SHA is recorded with the close commit, not in the
  batch commit — explicitly avoiding the same placeholder trap that W4
  fell into. Branch hygiene also addressed this session:
  `git push origin --delete batch/f1.1-app-tsx-isrecord` after merge
  confirmed by `git ls-remote origin batch/f1.1-app-tsx-isrecord` →
  SHA 2548568 (already in main via 8aa321e). Suggested defensive follow-up
  (separate batch, NOT bundled here — cleanup ≠ skill enhancement):
  add partial-close detector to /audit Step 4 — flags SHA placeholders in
  last 5 LOG entries, ROADMAP Current Phase ↔ STATE "Sledeći" mismatch,
  and unmerged per-batch branches on origin.

---

## F1.1 — 2026-05-18 — src/App.tsx isRecord dedup (lock zone) — DONE

**Tier:** STRICT (lock zone: src/App.tsx; per-batch branch)
**SHA:** 2548568
**Files (1):**
  - src/App.tsx — removed local isRecord def (Variant B, lines 256-258);
    added `import { isPlainObject as isRecord } from "./lib/parsing"`.
    Alias preserves Variant-B semantics (arrays rejected). Zero call-site
    changes. Last isRecord dup after F1 eliminated.
**Verify:**
  build:     PASS(machine) — exit 0, 7.46s, 2187 modula
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 13 fajlova, 163 testa
  manual:    PASS(human) — Pavle confirmed: Vercel preview build green,
             public site OK, admin login OK
**SCOPE_DRIFT:** none (1 file = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = 2548568)
**LESSONS:** unchanged (7/7 cap — no new lesson; alias pattern already known from F1)
**Notes:** isPlainObject-as-isRecord alias pattern (established F1 for 3 Variant-B
  sites) extended to lock zone. Variant-B semantic verified pre-plan:
  App.tsx:256 had `!Array.isArray` → must alias isPlainObject, NOT import isRecord
  (Variant A — would be silent regression). ROADMAP F1.1 row updated via /close (b2).

---

## W5 — 2026-05-18 — ROADMAP DONE-status reconciliation + /close ROADMAP-update process fix — DONE

**Tier:** STANDARD (doc + workflow-process; direct commit on main)
**SHA:** 023debf
**Files (2):**
  - workflow/projects/padrino/ROADMAP.md — 6 drift points reconciled (status-only): Current Phase prose → "Faza F (Shared core) IN PROGRESS" + removed hardcoded "22 batches" (rots → drift; now points to STATE.md as authoritative); Faza E header `## Upcoming` → `## Faza E — DONE ✓` + E1–E5 DONE markers (E1–E3 2026-05-17, E4–E5 2026-05-18 from LOG dates); Faza F header `## Upcoming` → `## Faza F — IN PROGRESS` + F1 row `DONE 2026-05-18 (SHA f4c677f)`. Batch SCOPE text NETAKNUT (W4 already reconciled scope — W5 is status-only per ZABRANE).
  - .claude/skills/close/SKILL.md — Step 6 root-cause fix: added guarded sub-step (b2) ROADMAP-update + ROADMAP in git add; heading → "LOG + STATE + ROADMAP + COMMIT", "all four or none".
**Verify:**
  build:     PASS(machine) — exit 0, built 3.63s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 13 files, 163 tests
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = 023debf)
**LESSONS:** unchanged (cap 7/7 — W5 insight is structurally self-documented in close/SKILL.md (b2); not a recurring-mistake active-buffer lesson; same treatment as W4)
**Notes:** Root cause confirmed from close/SKILL.md:151 — /close Step 6 wrote only
  STATE+LOG, never ROADMAP → every phase boundary left ROADMAP stale until a manual
  W batch (W2/W3/W4 all "ROADMAP reconciliation post-X" — same loop). Surfaced when
  /kickoff smelled one stale line; thorough /audit then found 6 drift points while
  the mechanical git↔STATE↔LOG chain was fully clean (drift was purely
  ROADMAP-content vs reality). Pavle pushed back on a narrow one-line W5 → rescoped
  to fix all 6 + the process hole (one coherent "kill the recurring-drift class"
  tema). W5 is the first batch through the new (b2): correctly NO-OP (W batch has no
  ROADMAP row, no phase boundary) — fix self-tested. Next: F1.1 (STRICT, lock zone —
  App.tsx) plans against the now-reconciled ROADMAP.

---

## F1 — 2026-05-18 — src/lib/parsing.ts consolidation — DONE

**Tier:** STANDARD (direct commit on main)
**SHA:** f4c677f
**Files (12):**
  - src/lib/parsing.ts (NEW) — 4 functions: isRecord (Variant A), isPlainObject (Variant B), safeString, normalizeText. NO safeInt (W4 decision).
  - src/lib/parsing.test.ts (NEW) — 20 tests (isRecord A/B split documented, safeString, normalizeText).
  - src/lib/cartDrawerHelpers.ts — import+re-export normalizeText from parsing; local def removed.
  - src/lib/createOrder.ts — import isRecord (Variant A); local def removed.
  - src/lib/publicBusinessSettings.ts — import isPlainObject as isRecord (Variant B); local def removed.
  - src/components/AdminOrders.tsx — import isRecord+isPlainObject+safeString+normalizeText; locals removed.
  - src/sections/Menu.tsx — import normalizeText; local def removed.
  - src/pages/admin/AdminDashboard.tsx — import isRecord+safeString; safeInt→toSafeInt from money; locals removed.
  - src/pages/admin/AdminLogin.tsx — import isRecord (Variant A); local def removed.
  - src/pages/admin/AdminMenu.tsx — import isPlainObject as isRecord (Variant B) + normalizeText; locals removed.
  - src/pages/admin/AdminSettings.tsx — import isPlainObject as isRecord (Variant B); local def removed.
  - src/pages/admin/AdminUsers.tsx — import isRecord (Variant A); local def removed.
**Verify:**
  build:     PASS(machine) — exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 13 files, 163 tests; parsing.test.ts confirmed running (20 tests green)
  lint:      PASS(machine) — exit 0
**SCOPE_DRIFT:** none (12 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (cap 7/7)
**Notes:** isRecord Variant-B sites (AdminMenu:108, AdminSettings:85, publicBusinessSettings:39)
  import `isPlainObject as isRecord` — Opus self-review catch; would have been silent regression otherwise.
  cartDrawerHelpers.ts re-export preserves lock-zone consumers (CartDrawer, CartProvider) without touching them.
  Lock zone NETAKNUT. Faza F started.

---

## W4 — 2026-05-18 — ROADMAP reconciliation (post-orphan-files scope drift fix) — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** 5b55f42
**Files (1):**
  - workflow/projects/padrino/ROADMAP.md (Faza F tabela — F1/F1.1/F3):
      1. F1 ispravljen: scope `src/` non-lock-zone ONLY (~10 fajlova);
         parsing.ts vlasništvo SAMO isRecord/isPlainObject/safeString/
         normalizeText (verifikovano bajt-identični — true no-op);
         safeInt EXCLUDED — money-path mina dokumentovana; 1h → ~1.5h.
      2. F1.1 dodat (novi red): src/App.tsx:256 isRecord dedup,
         lock zone, STRICT, 30min — izdvojen iz F1.
      3. F3 pojašnjen: uključuje api/_shared/parsing.ts (~10 api/
         fajlova, 4 lock-zone, L6 .js obavezno);
         supabase/functions/payments-create-session (Deno) out per B12.
**Verify:**
  build:     PASS(machine) — exit 0, vite ✓ 7.53s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      NIJE POKRENUTO (LEAN tier)
**SCOPE_DRIFT:** none
  EXPECTED: workflow/projects/padrino/ROADMAP.md
  ACTUAL:   workflow/projects/padrino/ROADMAP.md ✓ (1/1)
**LESSONS:** nepromenjen (cap ostaje 7/7 — opcija b, Pavle odluka).
  Insight zarobljen u ROADMAP F1 noti (mesto upotrebe). Generalna
  lekcija (body-compare pre svakog util dedup-a; name ≠ semantika;
  čuvati money path) = L8 kandidat ako se ponovi van F1 — rotacija
  aktivne lekcije nije trošena za nešto već pokriveno na mestu upotrebe.
**Notes:**
  - Trigger: drugi Claude nalog kreirao src/lib/parsing.ts +
    parsing.test.ts tokom /kickoff (kickoff MORA biti read-only —
    cross-account drift incident). Orphani pregledani (24/24 vitest
    pass), git clean -f obrisani pre W4 (čisto stablo za /plan gate a).
  - Recon (grep + body-read): F1 stvarni scope ~25 dup-def sites,
    NE "4+" iz originalnog ROADMAP-a; 5 lock-zone; api/ odvojen
    build kontekst (Vercel serverless vs Vite) → pripada F3, ne F1.
  - safeInt MONEY-PATH MINA (ključni nalaz): ≥3 divergentne semantike.
    Kanon = src/lib/money.ts toSafeInt (Number()-coercion).
    createOrder.ts:76 / AdminOrders.tsx:64 već delegiraju na njega;
    AdminDashboard.tsx:32 inline kopija iste semantike → import iz money.
    publicBusinessSettings.ts:47 toSafeInt (number|null, bez fallback)
    = drugi kontrakt → OUT of F1. Orphan parsing.ts safeInt
    (string-or-number-strict) NE odgovara stvarnoj upotrebi — naivni
    dedup bi tiho promenio cenovni put.
  - normalizeText / isRecord verifikovani bajt-identični (true no-op).
  - STATE.md anticipovao W4 ("ili W4 reconciliation ako je potreban").
  - F1 sada kreće sa zaključanim poštenim scope-om bez skrivene mine.

---

## E5 — 2026-05-18 — Golden-path E2E (cart → createOrder → redirect URL) — DONE

**Tier:** STANDARD (additive test-only; direkt na main — E1/E2/E3 presedan)
**SHA:** edbdb73
**Files (1):**
  - src/components/CartDrawer.e2e.test.tsx (NEW — 205 linija, 2 golden testa)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 3.60s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 12 fajlova / 146 testa (+2 nova: G1, G2)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, lock-zone CartDrawer.tsx NETAKNUT,
             nije browser-observable (E1–E4 presedan)
**SCOPE_DRIFT:** none
  EXPECTED: src/components/CartDrawer.e2e.test.tsx
  ACTUAL:   exact match ✓ (1/1)
**LESSONS:** L7 updated (ne novi ulaz — cap ostaje 7)
  Dodat vi.stubGlobal("location")/vi.unstubAllGlobals() pattern za
  window.location.assign u jsdom (throws "Not implemented" bez stuba;
  stub mora zadržati pathname/search za CartDrawer init reads).
**Notes:**
  - E5 je "real net for Faza G" (ROADMAP) — exit-criterion #3 ZATVOREN:
    E2E green (cart → createOrder → redirect URL).
  - G1 (card-redirect golden path): real createOrder lib, fetch mock →
    { ok:true, id, flow:"card_redirect", redirect_url:URL } →
    fetchMock 1× /create-order, body.payment_method="card",
    window.location.assign(URL) 1×. Exit-criterion #3 ✓
  - G2 (cash golden path): real createOrder lib, fetch mock →
    { ok:true, id, flow:"cash" } → fetchMock 1× /create-order,
    body.payment_method="cash", window.location.assign NOT called.
  - Real createOrder lib (src/lib/createOrder.ts) drivovan bez mock-a —
    potvrđena validacijska logika + fetch chain end-to-end u tests.
  - E4 ff-merge (d380a35→005a8f1) + push + branch delete uključeni u
    ovaj batch (Step 0 iz plana — autorizovao Pavle pre egzekucije).
  - Lock zone (src/components/CartDrawer.tsx) — NETAKNUT.
  - **Faza E — DONE** ✓ (E1 E2 E3 E4 E5 sve zatvorene — safety net komplet)

---

## E4 — 2026-05-18 — DOM test harness + CartDrawer contract characterization — DONE

**Tier:** STRICT (safety net oko lock-zone CartDrawer.tsx pre Faza G;
  per-batch branch batch/E4-domharness-cartdrawer-char; lock-zone fajl
  SAM NIJE diran — samo nov .test.tsx)
**SHA:** 90de2c3
**Files (5):**
  - package.json (MODIFY — +4 devDeps: jsdom, @testing-library/react,
    @testing-library/jest-dom, @testing-library/user-event)
  - package-lock.json (MODIFY — lockfile od npm install)
  - tsconfig.app.json (MODIFY — +1 exclude "**/*.test.tsx" mirror od
    "**/*.test.ts" da tsc -b/build ostane zelen)
  - vitest.config.ts (MODIFY — include +"src/**/*.test.tsx"; SCOPE_DRIFT)
  - src/components/CartDrawer.test.tsx (NEW — 277 linija, 7 contract testova)
**Verify:**
  build:     PASS(machine) — exit 0, vite build ~3.85s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 11 files / 144 tests (+7 new)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, lock-zone CartDrawer.tsx NETAKNUT,
             nije browser-observable (E1/E2/E3 presedan)
**SCOPE_DRIFT:** acknowledged
  EXPECTED (4): package.json, package-lock.json, tsconfig.app.json,
                src/components/CartDrawer.test.tsx
  ACTUAL (5):   + vitest.config.ts
  Reason: include pattern imao samo src/**/*.test.ts → .tsx fajl nikad
          discovered = false green (0 izvršenih CartDrawer testova).
          Neophodna izmena da test uopšte radi. Pavle-approved.
**LESSONS:** rotated (cap 7)
  - L4 (safeNumber "" → 0) deprecated → DECISIONS.md "Deprecated Lessons"
    (bug fixan B4.1, pattern primenjen, preventivna vrednost potrošena)
  - L7 added (jsdom docblock: afterEach(cleanup) + .tsx include obavezni)
  - Active: 7 (L0,L1,L2,L3,L5,L6,L7); LESSONS.md 114 linija (≤200)
**Notes:**
  - 7 contract-level karakterizacionih testova (mock-boundary, ne DOM
    struktura) pre Faza G CartDrawer split:
    A1-A3 render per cart-state (isOpen=false→null, prazna→"Korpa je
    prazna", item→ime+"1 stavki");
    B1-B2 form-validation gating (blank submit→3 error poruke + 0
    createOrder; valid bez zone→"Izaberi zonu dostave." + 0 createOrder);
    C1-C2 submit-branch contract (cash+Budva→createOrder payment_method
    'cash', bez tokenize; card bez PaymentJS flag→payment_method 'card',
    transaction_token undefined, 0 createBankartPaymentJs).
  - 4 mocka: 3 behavior (useCart, bankartPaymentJs, createOrder) + 1
    infrastrukturni (supabaseClient — import-time throw guard; mora
    pokriti ceo query chain uklj. .maybeSingle()/.order()).
  - // @vitest-environment jsdom kao per-file docblock (NE globalni env —
    10 postojećih node testova ostaju netaknuti); zahteva eksplicitni
    afterEach(cleanup) (auto-cleanup ne okida sa docblock env-om).
  - Karakterizovan bug (lock-zone, NIJE fixan): loadCheckoutDefaults
    useEffect u CartDrawer.tsx ~liniji 419 nema try/catch (za razliku od
    loadCatalogs) → unhandled rejection ako supabase padne. Kandidat za
    Faza G.
  - Budva zona (feeCents:0, minCents:0) jedina testabilna bez delivery-fee
    setup-a za C1/C2.
  - Lock zone (src/components/CartDrawer.tsx) — NETAKNUT (diff: samo nov
    .test.tsx). Faza E nastavlja. Next: E5 (golden-path E2E).

---

## E3 — 2026-05-17 — Refund flow test — DONE

**Tier:** STANDARD (additive test-only; direct on main — non-lock-zone, test files only)
**SHA:** c1a8961
**Files (2):**
  - api/bankart-callback.test.ts (MODIFY — +4 refund/chargeback callback push tests
    + paidOrder const; +78 lines)
  - api/bankart-order-status.test.ts (NEW — 5 refund-sync status-poll tests; 223 lines)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 3.35s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 10 files / 137 tests (+9 new)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, non-lock-zone, not browser-observable
**SCOPE_DRIFT:** none
  EXPECTED: api/bankart-callback.test.ts, api/bankart-order-status.test.ts
  ACTUAL:   exact match ✓ (2/2)
**Notes:**
  - File 1 (callback push, +4): REFUND/OK→refunded, CHARGEBACK/OK→refunded,
    REFUND/ERROR→payment_status kept "paid" (no cancellation),
    CHARGEBACK-REVERSAL/OK on already-paid→payment_status="paid" no Telegram.
  - File 2 (status-poll, +5):
    A1: refunded order skipped — shouldSkipStatusRefreshForPaymentStatus=true,
        no Bankart fetch;
    A2: paid order NOT skipped — ed51537 proof (paid is not a skip status),
        Bankart fetch called, refreshed=true;
    B1: REFUND/SUCCESS → payment_status="refunded" (applyBankartStatusToOrder);
    B2: CHARGEBACK/SUCCESS → payment_status="refunded";
    B3: cash order → early return source=db_cash, no fetch.
  - BANKART_API_KEY set in vi.hoisted() (not in vitest.setup.ts) — needed for
    getBankartConfig() called at handler runtime (not module-load time).
  - Bankart fetch stub: { ok:true, text:()=>Promise.resolve(JSON.stringify(body)) }
    (bankart-order-status.ts uses response.text(), not .json()).
  - ResLike for status-poll: status(code)→returns Res (chaining), send(), setHeader().
  - Lock zone (api/bankart-callback.ts + api/bankart-order-status.ts) — NETAKNUTI.
  - CHARGEBACK-REVERSAL via status-poll documented as unreachable for a "refunded"
    order (shouldSkipStatusRefreshForPaymentStatus("refunded")=true → skip gate fires
    before applyBankartStatusToOrder). No test written — honesty > coverage theater.
  - Faza E continues. Next: E4 (DOM harness) or E5 (golden-path E2E).

---

## E2 — 2026-05-17 — Bankart callback integration test — DONE

**Tier:** STANDARD (additive test-only; direct on main — non-lock-zone, test file only)
**SHA:** 62dd659
**Files (1):**
  - api/bankart-callback.test.ts (MODIFY — replaced simple vi.mock with hoisted
    controllable builder; added Readable.from() stream req helper + makeSignedReq;
    +4 integration tests covering payment→DB flow)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 3.22s (2186 mod)
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 9 files / 128 tests (+4 new)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, non-lock-zone, not browser-observable
**SCOPE_DRIFT:** none
  EXPECTED: api/bankart-callback.test.ts
  ACTUAL:   exact match ✓ (1/1)
**Notes:**
  - Covers payment→DB flow (previously 0 integration tests):
    DEBIT/OK pending → payment_status=paid, Telegram notified 1×;
    DEBIT/OK duplicate (already paid) → no double-notify (idempotency);
    DEBIT/ERROR → payment_status=failed + status=cancelled, no notify;
    order-not-found → 200 OK, updateCallCount=0, fetch 0 (graceful).
  - Lock zone (api/bankart-callback.ts) untouched — handler imported & driven, not edited.
  - Mock enhanced: hoisted state captures lastUpdatePatch + updateCallCount;
    makeUpdateEqBuilder handles await .update().eq() thenable chain.
  - vitest.setup.ts pre-sets BANKART_SHARED_SECRET="test-bankart-secret" —
    existing verifyBankartCallbackSignature unit tests still green (same secret).
  - Faza E continues. Next: E3 — Refund flow test.

---

## E1 — 2026-05-17 — create-order endpoint hostile-input test — DONE

**Tier:** STANDARD (additive test-only; direct on main — non-lock-zone, no src/api change)
**SHA:** 8fc65e6
**Files (1):**
  - src/lib/createOrderEndpoint.test.ts (NEW — 11 tests: 2 transport guard,
    7 hostile-input rejection, 2 negative control; drives exported handler
    via fake req/res + hoisted @supabase/supabase-js mock)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 4.28s (2186 mod)
  typecheck: PASS(machine) — exit 0 (tsc -b; test file out of tsc scope —
             tsconfig.app excludes **/*.test.ts, R1 confirmed)
  test:      PASS(machine) — exit 0, 9 files / 124 tests
  manual:    NIJE POTREBNO — test-only, non-lock-zone, not browser-observable
**SCOPE_DRIFT:** none
  EXPECTED: src/lib/createOrderEndpoint.test.ts
  ACTUAL:   exact match ✓ (1/1)
**Notes:**
  - Closes exit-criterion #2: E1 hostile price-tamper test GREEN — server
    rejects/recomputes proven, not assumed (covers create-order.ts:1037-1090).
  - Lock zone (api/create-order.ts) untouched — handler imported & driven, not edited.
  - Within-intent simplifications vs plan (not scope creep): @upstash/* not
    mocked (getRatelimit()→null when UPSTASH_* env unset, limiter inert);
    fetchZones not mocked (no lat/lng → parseLatLngFromBody null → not called).
  - Coverage: 405/204 guards, Invalid payment_method, Invalid payload,
    Invalid item structure, Inactive/invalid menu item, Total mismatch
    (tampered total + tampered per-item price recomputed from DB), plus
    2 negative controls (matching total / omitted total accepted).
  - Faza E started (safety net). Next: E2 — Bankart callback integration test.

---

## B8 — 2026-05-17 — extract resolvePublicBaseUrl + buildTelegramPayload → api/_shared/public-url.ts — DONE

**Tier:** STRICT (3 lock-zone payment files; per-batch branch b8-shared-public-url)
**SHA:** 2bcab60
**Files (6):**
  - api/_shared/public-url.ts (NEW — shared module: resolvePublicBaseUrl + buildTelegramPayload)
  - api/_shared/public-url.test.ts (NEW — 14 tests: env precedence, Origin trust/ignore, x-fwd, fallback)
  - api/create-order.ts (MODIFY — remove local fns, import shared, trustOriginHeader: true)
  - api/bankart-order-status.ts (MODIFY — remove local fns, import shared, trustOriginHeader: true)
  - api/bankart-callback.ts (MODIFY — remove local fns, import shared, trustOriginHeader: false — SECURITY)
  - workflow/projects/padrino/DECISIONS.md (MODIFY — B8 signature refinement note req→headers)
**Verify:**
  build:     PASS(machine) — exit 0, 2186 modules, 6.85s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 8 files / 113 tests
  vercel:    PASS(human) — Pavle: Build Logs clean (no TS2835), readyState READY
  manual:    PASS(human) — Pavle: preview radi, monitoring OK, console clean
**SCOPE_DRIFT:** none
  EXPECTED: 6 fajlova (api/_shared/public-url.ts, api/_shared/public-url.test.ts,
            api/create-order.ts, api/bankart-order-status.ts, api/bankart-callback.ts,
            workflow/projects/padrino/DECISIONS.md)
  ACTUAL: exact match ✓
**Notes:**
  - Bezbednosna invarianta sačuvana: bankart-callback trustOriginHeader: false (SECURITY LOCK).
  - headerString u bankart-callback zadržan (HMAC verifikacija, linije 226/229/233 — nije orphan).
  - Signature refinement: resolvePublicBaseUrl(headers, opts) umesto (req, opts) —
    admin-auth.ts pattern, TS structural-compat risk reduction. DECISIONS.md ažuriran.
  - L6 .js import pattern potvrđen first-try (treća potvrda: B10, B10.1, B8).
  - Faza D DONE: B12 ✓ B14 ✓ B14.1 ✓ B8 ✓

---

## B14.1 — 2026-05-17 — Enable RLS on admin_users + revoke anon grants (F1 fix) — DONE

**Tier:** STRICT (schema-change; direct on main — no src/api changes)
**SHA:** 2dbc1ec
**Files (2):**
  - supabase/migrations/20260517000000_enable_rls_admin_users.sql (CREATE — F1 remediation migration)
  - workflow/projects/padrino/DECISIONS.md (MODIFY — B14.1 decision + apply status)
**Verify:**
  build:     PASS(machine) — exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 7 files / 95 tests
  DB verify: PASS(machine) — pg_tables.rowsecurity=true ✓,
             anon/authenticated grants absent (14 rows: postgres×7 + service_role×7 only) ✓
  manual:    PASS(human) — Pavle confirmed: login OK, AdminOrders OK,
             AdminUsers OK, console clean @ padrinobudva.com/admin
**SCOPE_DRIFT:** none
  EXPECTED: supabase/migrations/20260517000000_enable_rls_admin_users.sql,
            workflow/projects/padrino/DECISIONS.md
  ACTUAL:   exact match ✓
**Notes:**
  - F1 CRITICAL closed: admin_users RLS enabled + anon/authenticated grants revoked.
  - service_role bypasses RLS unconditionally → all api/admin-*.ts unaffected (confirmed).
  - Frontend has zero .from("admin_users") → no frontend impact.
  - Apply method: Supabase dashboard SQL editor (NOT db push — baseline may have drifted).
  - F2 (orders hardcoded email) deferred per Option C — vestigial, service_role bypasses it.
  - Rollback SQL documented in migration file and DECISIONS.md.

---

## B14 — 2026-05-16 — Security audit: RLS hardcoded email + admin_users RLS — DONE

**Tier:** STRICT (audit-only, doc batch — direct on main)
**SHA:** fb945bf
**Files (1):**
  - docs/rls-security-audit.md (CREATE — security audit deliverable)
**Verify:**
  build:     PASS(machine) — exit 0, 7.10s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 7 files / 95 tests
  manual:    N/A (doc-only batch, nema code/schema promene)
**SCOPE_DRIFT:** none
  EXPECTED: docs/rls-security-audit.md
  ACTUAL:   docs/rls-security-audit.md ✓
**Notes:**
  - +282/-0: novi audit dokument.
  - F1 (CRITICAL): admin_users nema RLS + GRANT ALL TO anon — privilege
    escalation via public anon key (potvrđeno od Pavle iz live DB).
  - F2 (MEDIUM): orders policies hardkoduju email — vestigialno, API
    path neafektovan (service_role bypasses RLS).
  - Remediation predložena u dokumentu; B14.1 (STRICT) = F1-only follow-up.

---

## B12 — 2026-05-16 — Edge functions dedup decision — DONE

**Tier:** STRICT (direct on main — cleanup/decision batch, no src/api changes)
**SHA:** 286ea67
**Files (4):**
  - supabase/functions/admin-orders/config.toml (DELETE — dead edge fn deploy config)
  - supabase/functions/admin-orders/index.ts (DELETE — dead edge fn, 195 lines)
  - supabase/functions/telegram-new-order/index.ts (DELETE — dead edge fn, 386 lines)
  - workflow/projects/padrino/DECISIONS.md (MODIFY — B12 decision + evidencija appended)
**Verify:**
  build:     PASS(machine) — exit 0, 3.57s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 7 files / 95 tests
  manual:    PASS(human) — Pavle confirmed (no runtime app changes;
             payments-create-session + deno.d.ts untouched)
**SCOPE_DRIFT:** acknowledged
  EXPECTED (original): 3 fajla (DECISIONS.md + 2 × index.ts)
  AMENDMENT: admin-orders/config.toml dodat uz Pavle eksplicitno odobrenje
             (STOP-and-report mid-batch; cascade cleanup iste mrtve jedinice)
  ACTUAL (4): matches amended EXPECTED ✓
**Notes:**
  - +41 / -585: admin-orders (195+1 lines) + telegram-new-order (386 lines) obrisani.
  - payments-create-session/ (LIVE, create-order.ts:476) + deno.d.ts netaknuti.
  - Ops action item (Pavle, non-blocking): proveriti Supabase dashboard → Edge Functions;
    ako admin-orders/telegram-new-order još deployovane → `supabase functions delete`.
  - Repo-wide grep: zero callers pre i posle brisanja (dead status potvrđen).

---

## B10.1 — 2026-05-16 — isAdminEmailDb dedup → api/_shared/admin-auth — DONE

**Tier:** STANDARD (branch: batch/B10.1-isadminemaildb-dedup → merged to main)
**SHA:** 0bcb7da (refactor commit); merge 61174dd
**Files (4):**
  - api/_shared/admin-auth.ts (MODIFY — dodat isAdminEmailDb export: thin wrapper nad getAdminFromDb; ažuriran header komentar)
  - api/admin-orders.ts (MODIFY — isAdminEmailDb/isFallbackAdmin/looksLikeMissingTable/normalizeEmail obrisani; import dodat; call site +supabase arg)
  - api/admin-update-order-status.ts (MODIFY — iste promene kao admin-orders.ts)
  - api/admin-resend-telegram.ts (MODIFY — iste promene; getEnv zadržan: koristi Telegram token pored Supabase client-a)
**Verify:**
  build:     PASS(machine) — exit 0, vite ~7.23s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 7 files, 95 tests
  Vercel:    PASS(human) — Build Logs bez TS2835 (L6 gate)
  smoke:     PASS(human) — Pavle: admin-orders, admin-update-order-status, admin-resend-telegram 200/403
**SCOPE_DRIFT:** none
  EXPECTED: 4 fajla
  ACTUAL:   api/_shared/admin-auth.ts, api/admin-orders.ts,
            api/admin-resend-telegram.ts, api/admin-update-order-status.ts ✓
**Notes:**
  - +21 / -108 linija: cascade-deleted isFallbackAdmin + looksLikeMissingTable +
    normalizeEmail × 3 fajla (L6: dedup → orphan-cleanup u istom batch-u, nije scope creep).
  - getEnv zadržan u sva 3 caller-a (Supabase client + Telegram token u resend fajlu).
  - isAdminEmailDb je thin wrapper: (await getAdminFromDb(supabase, e)).isAdmin —
    jedan izvor DB logike, behavior-preserving za sve 3 varijante (string/unknown).
  - L6 NEXT REVIEW ažuriran: "posle B10.1 / B8" → "posle B8" (.js pattern potvrđen
    first-try na B10.1; B8 Phase D dolazi i dalje treba L6 kao aktivan reminder).

---

## W3 — 2026-05-16 — ROADMAP reconciliation (post-B10/L6 drift fix) — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** 99c97e3
**Files (1):**
  - workflow/projects/padrino/ROADMAP.md (2 izmene):
      1. Linija 51: "Backend ESLint coverage — currently api/** is in eslint ignore" → ispravljena.
         Stvarnost (L6/B10): eslint lintuje api/ (`eslint.config.js` ignoriše samo `dist`,
         `files: **/*.{ts,tsx}`). Rezidual (globals.browser na Node api/) tačno formulisan.
      2. B10.1 formalni red dodat u Faza C tabelu (isAdminEmailDb dedup, STANDARD, 30min).
**Verify:**
  build:     PASS(machine) — exit 0, vite ~7.64s
  typecheck: PASS(machine) — exit 0
  test:      NIJE POKRENUTO (LEAN tier)
**SCOPE_DRIFT:** none
  EXPECTED: workflow/projects/padrino/ROADMAP.md
  ACTUAL:   workflow/projects/padrino/ROADMAP.md ✓
**Notes:**
  - Netačna tvrdnja bila direktan uzrok B10 ZABRANA "ne diraj lokalne helpere" (plan je
    koristio ROADMAP kao izvor — repo > dokumentacija važnija). Korekcija sprečava
    ponavljanje iste pretpostavke u budućim batchevima.
  - B10.1 sada formalno praćen u ROADMAP; sledeći /plan B10.1 ima čist polazni ROADMAP.

---

## B10 — 2026-05-16 — Consolidate getAdminFromDb → api/_shared/admin-auth — DONE

**Tier:** STRICT (first api/_shared/ module ever; branch: b10-shared-admin-auth → FF-merged to main)
**SHA:** 65a5fac (code: 3e55179 refactor + 65a5fac nodenext fix) — workflow close commit follows
**Files (7):**
  - api/_shared/admin-auth.ts (NEW — getAdminFromDb(supabase, email) + inline normalizeEmail/isFallbackAdmin/looksLikeMissingTable/isAdminRole + AdminRole/AdminLookup types)
  - api/_shared/admin-auth.test.ts (NEW — 12 tests: empty/whitespace guard, email normalization, missing-table fallback ×3, generic error, row resolution ×5)
  - api/admin-me.ts (MODIFY — getAdminRoleFromDb → shared; orphan cleanup: isFallbackAdmin/looksLikeMissingTable/isAdminRole/AdminRole/TableState)
  - api/admin-menu.ts (MODIFY — getAdminFromDb → shared; orphan cleanup: isFallbackAdmin/looksLikeMissingTable/isAdminRole/AdminRole)
  - api/admin-menu-image.ts (MODIFY — isto kao admin-menu)
  - api/admin-settings.ts (MODIFY — isto kao admin-menu)
  - api/admin-users.ts (MODIFY — getAdminFromDb → shared; orphan cleanup: samo isFallbackAdmin — ostali helperi/AdminRole i dalje korišćeni u normalizeAdminUserRow/AdminUserRow)
**Verify:**
  typecheck: PASS(machine) — exit 0 (tsc -b, Bundler resolution)
  lint:      PASS(machine) — exit 0 (bio FAIL 14 no-unused-vars → fixed orphan cleanup)
  test:      PASS(machine) — 7 files, 95/95 (+12 novih admin-auth)
  build:     PASS(machine) — exit 0, vite ~7s
  manual:    PASS(human) — Pavle (preko web Claude) potvrdio na Vercel preview commit 65a5fac: build zelen (TS2835 nestao), admin smoke prošao (login + Porudžbine/Meni/Korisnici/Podešavanja, bez 500)
**SCOPE_DRIFT:** none (file-level — 7 = 7 EXPECTED).
  SCOPE_DRIFT (acknowledged): orphan helper/type cleanup beyond plan ZABRANA.
  ZABRANA ("ne dirati lokalne helpere") bila na pogrešnoj premisi (ROADMAP
  "api/** eslint-ignored" netačno). Lint gate prinudio uklanjanje mrtvog koda
  koji je refaktor osirotio. EXPECTED-FILES nepromenjen. Dokumentovano u commit 3e55179.
**Notes:**
  - 5 duplikata (getAdminFromDb ×4 byte-identičnih + admin-me getAdminRoleFromDb varijanta) → 1 parametrizovani shared modul
  - Parametrizovan: pozivalac prosleđuje svoj per-endpoint supabase klijent → X-Client-Info očuvan (audit §6)
  - Unifikovano telo = guarded varijanta → behavior-preserving za admin-me (admin-me.ts vraća 401 na prazan email PRE poziva → empty-guard mrtva grana tamo)
  - Self-contained inline helperi → audit §7 step-1 (niži helperi) ostaje zaseban budući batch
  - **R2 materijalizovao se:** lokalni `tsc -b` (Bundler) zelen ali Vercel `@vercel/node` (nodenext) zahtevao `.js` ekstenziju → TS2835 build fail na 5 handlera; fix commit 65a5fac (`./_shared/admin-auth` → `.js`). STRICT preview smoke uhvatio ono što su sva 4 lokalna gate-a propustila → L6.
  - isAdminEmailDb (boolean varijanta, 3 fajla: admin-orders/admin-update-order-status/admin-resend-telegram) namerno odloženo → **B10.1** (novo u ROADMAP)
  - Net -200 linija
  - **Faza C — B10 DONE ✓ (Faza C KOMPLETNA)**

---

## B13 — 2026-05-16 — Mrtvi fajlovi cleanup — DONE (no-op)

**Tier:** LEAN
**SHA:** — (no code commits; no-op)
**Files:** none
**Verify:**
  typecheck: PASS(machine) — exit 0
  build:     PASS(machine) — exit 0, 4.23s
  test:      NIJE POKRENUTO — LEAN no-op, nema code delte
  manual:    NIJE POKRENUTO — nema izmena za smoke-test
**SCOPE_DRIFT:** none — 0 expected fajla, 0 izmenjenih
**Notes:**
  - B13 targetovao: padrinoo.txt + tracked *.tsbuildinfo
  - padrinoo.txt — ne postoji nigde u repo-u (glob 0 hitova)
  - *.tsbuildinfo — nijedan tracked (.gitignore:37 ih ignoriše)
  - public/robots.txt jedini .txt match → legitiman SEO fajl, netaknut
  - ROADMAP napomena "likely near-no-op" potvrđena. Kao B1.
  - **Faza C — B13 DONE** ✓

---

## B9 — 2026-05-16 — AuthProvider removal — DONE

**Tier:** LEAN (dead-code deletion; direct on main)
**SHA:** 24306a1
**Files:**
  - src/auth/AuthProvider.tsx (DELETE — 105 lines; jedini fajl u src/auth/)
  - src/main.tsx (MODIFY — uklonjen import + `<AuthProvider>` JSX wrapper)
**Verify:**
  build:     PASS(machine) — exit 0, tsc -b + vite, 7.77s
  typecheck: PASS(machine) — exit 0 (npm run typecheck)
  test:      PASS(machine) — 6 files, 83/83 (LEAN bonus gate)
  lint:      PASS(machine) — exit 0 (LEAN bonus gate)
  manual:    NIJE POKRENUTO — LEAN tier, dead-code deletion bez UI promene
**SCOPE_DRIFT:** none — tačno 2 expected fajla
**Notes:**
  - useAuth() nema potrošača u src/ — grep 0 hitova, W2 audit 2026-05-11 potvrdio
  - De-lock verifikovan: DECISIONS 2026-05-10 (uslovno), W2 audit potvrdio safe-remove
  - onAuthStateChange listener bio inertno: hranio lokalni state koji niko nije čitao
    (useAuth() nikad pozvan van AuthProvider.tsx; supabaseClient.ts netaknut)
  - Rezultat: 1 insertion(+), 108 deletions(-) — neto -107 linija
  - **Faza C — B9 DONE** ✓

---

## B7 — 2026-05-16 — Menu.tsx image resolver dedup → cartDrawerHelpers — DONE

**Tier:** STANDARD (single file, customer-facing image render; not lock zone; direct on main)
**SHA:** c3ece05
**Files:**
  - src/sections/Menu.tsx (MODIFY — import buildImageCandidates from ../lib/cartDrawerHelpers; remove 5 private resolver functions)
**Verify:**
  build:     PASS(machine) — exit 0 (tsc -b + vite), 2026-05-16 01:08
  typecheck: PASS(machine) — via npm run build (tsc -b)
  test:      PASS(machine) — 6 files, 83/83
  lint:      PASS(machine) — exit 0 (confirms no orphan/unused-import)
  manual:    PASS(human) — Pavle potvrdio: ceo meni (pizze/sosevi/dodaci/pića) renderuje, nema slomljenih pločica
**SCOPE_DRIFT:** none — tačno 1 expected fajl (src/sections/Menu.tsx)
**Notes:**
  - Uklonjeno 5 privatnih duplikata: `normalizeImagePath`, `NAME_TO_FILE`,
    `buildFileCandidatesFromFilename`, `buildFileCandidatesFromName`, `buildImageCandidates`
  - Importovan samo `buildImageCandidates` (ostala 3 simbola korišćena samo interno u uklonjenim funkcijama)
  - `normalizeText`/`stripSize` namjerno ostavljeni — i dalje korišćeni u non-image Menu logici (linije 296/310/466)
  - `normalizeImagePath` uklonjen kao orphan (koristio ga samo lokalni `buildImageCandidates`)
  - **Latentni fiks:** Menu-ov lokalni `NAME_TO_FILE` mapirao na `.png`, a `public/menu/` ima
    isključivo `.webp` (33 fajla, 0 png) → mapped-name fallback je produkovao mrtve kandidate.
    Shared helper rešava `.webp` + brand-prefix/volume logika + `padrino.webp` placeholder.
    DB `image` putanja se i dalje proba prva → DB-popunjeni redovi netaknuti (nema regresije).
  - Rezultat: 1 insertion(+), 81 deletions(-) — neto -80 linija
  - Pre-B7 housekeeping (zaseban commit 16a6f0f, NIJE B7 scope): `git rm --cached supabase/.temp/`
    — 8 tracked fajlova već u .gitignore:43 ali tracked od ranije; uklonjeni iz indexa,
    fajlovi ostaju na disku za Supabase CLI. Rešava recurring dirty-tree šum.
  - **Faza C — B7 DONE** ✓

---

## B6 — 2026-05-16 — CartProvider duplikati → cartDrawerHelpers — DONE

**Tier:** STRICT (lock zone file: src/context/CartProvider.tsx; branch: b6-cartprovider-dedup → FF-merged to main)
**SHA:** 13c57af
**Files:**
  - src/context/CartProvider.tsx (MODIFY — remove 4 duplicate local functions, import canonical versions from cartDrawerHelpers)
**Verify:**
  build:     PASS(machine) — exit 0, 7.31s
  typecheck: PASS(machine) — via npm run build (tsc -b)
  test:      PASS(machine) — 6 files, 83/83 (all passing)
  lint:      PASS(machine) — exit 0
  manual:    PASS(human) — Pavle potvrdio: smoke test pass
**SCOPE_DRIFT:** none — tačno 1 expected fajl
**Notes:**
  - Uklonjene 4 duplikat funkcije: `normalizeAddonName`, `stuffedCrustPriceForSize`, `stripSizeFromName`, `isStuffedCrustAddon`
  - Dodana 1 import linija: `{ isStuffedCrustAddonName, stripPizzaSizeFromName, stuffedCrustPriceForSize }` iz `../lib/cartDrawerHelpers`
  - 2 call-site renaming: `stripSizeFromName` → `stripPizzaSizeFromName`, `isStuffedCrustAddon` → `isStuffedCrustAddonName`
  - `normalizeAddonName` nije importovana — koristila se samo unutar uklonjene `isStuffedCrustAddon`
  - `parsePizzaSizeFromText` i `isPizzaLike` namjerno ostavljene (različite od cartDrawerHelpers verzija)
  - Rezultat: 8 insertions(+), 42 deletions(-) — neto -34 linije
  - **Faza C — B6 DONE** ✓

---

## B16 — 2026-05-15 — CAS atomicity fix in admin-update-order-status — DONE

**Tier:** STRICT (race-condition fix in payment-state machine; branch: b16-cas-atomicity-fix → FF-merged to main)
**SHA:** e797c43
**Files:**
  - api/admin-update-order-status.ts (MODIFY — add `.eq("status", fromStatus)` CAS guard + `.maybeSingle()` + 409 conflict response with re-read)
  - api/admin-update-order-status.test.ts (MODIFY — 3 new handler CAS tests: happy path 200, CAS miss 409 with current_status, identity transition guard)
**Verify:**
  build:     PASS(machine) — exit 0, tsc -b + vite 7.71s
  typecheck: PASS(machine) — via npm run build (tsc -b)
  test:      PASS(machine) — 6 files, 83/83 (80 prethodnih + 3 nova CAS testa)
  manual:    PASS(human) — Pavle potvrdio: status promjena → 200 OK
**SCOPE_DRIFT:** none — tačno 2 expected fajla
**Notes:**
  - Race window: admin READ-then-WRITE sa sekundama između. Bankart callback (api/bankart-callback.ts)
    može promijeniti status tokom tog window-a → payment-state divergence (paid ali "cancelled", ili
    refunded ali "done"). CAS guard eliminiše ovu klasu bug-ova.
  - Asimetrija namjerna: Bankart callback i create-order ostaju bez CAS (event-driven authority + atomic init).
  - 409 response vraća current_status (best-effort re-read), attempted_from, attempted_to i srpsku poruku.
    Admin osvježi listu i odlučuje — nema auto-retry u handler-u.
  - Identity transition (X → X) prošao CAS guard (`.eq("status", X)` match sopstveni red) → 200 OK, no-op.
  - **Faza B — DONE** ✓

---

## B11 — 2026-05-12 — Bankart raw error sanitization — DONE

**Tier:** STRICT (lock-zone file: api/create-order.ts; branch: b11-bankart-error-sanitize → FF-merged to main)
**SHA:** 604461f
**Files:**
  - api/create-order.ts (MODIFY — add `export function clientSafeError`, patch 2 leak sites with console.error + generic Serbian messages)
  - api/create-order.test.ts (NEW — 4 unit tests for clientSafeError: Error/string/undefined/null × both kinds)
**Verify:**
  build:     PASS(machine) — exit 0, 4.21s (tsc -b + vite, on main post-merge)
  typecheck: PASS(machine) — via npm run build
  test:      PASS(machine) — 6 files, 80/80 (76 prethodnih + 4 nova)
  manual:    PASS(human) — Opus reviewed + approved diff; Pavle okayed merge
**SCOPE_DRIFT:** none — exactly 2 expected files
**Notes:**
  - Fixed 2 leak sites in api/create-order.ts where raw error text reached browser client:
    (1) L1119-1121: insErr.message (Postgres constraint/column names) returned on DB insert failure
    (2) L1168-1170: top-level catch relayed raw Bankart/network/DB err.message to client
  - Both now: console.error for Vercel ops triage + generic Serbian message to client
  - clientSafeError(err, kind) helper exported for testability; kind param is forward-compat
    for per-kind categorization if needed later (B11.1)
  - Substring heuristic `includes("bankart")` for kind routing documented with exit strategy
  - Out-of-scope: api/bankart-callback.ts (server-to-server), api/bankart-order-status.ts (admin)
  - ROADMAP listed B11 as STANDARD; upgraded to STRICT because api/create-order.ts is lock zone

---

## B15 — 2026-05-12 — Telegram DB trigger DROP — DONE

**Tier:** LEAN (doc + migration, direct on main)
**SHA:** dcd64bc
**Files:**
  - supabase/migrations/20260512150000_drop_telegram_trigger.sql (NEW — DROP TRIGGER IF EXISTS)
  - RUNBOOK.md (MODIFY — §1.1 status "dead code"→"REMOVED (B15, 2026-05-12)" + migration ref; §4.1 test URL vercel.app→padrinobudva.com)
**Verify:**
  build:     PASS(machine) — exit 0, 3.76s (tsc -b + vite)
  typecheck: PASS(machine) — via npm run build
  test:      NIJE POKRENUTO — LEAN tier
  manual:    PASS(human) — Pavle ran SQL in Supabase Dashboard; pg_trigger confirms only `orders_set_total_price` remains on orders table; Vercel logs no longer show 401 errors for trigger URL
**SCOPE_DRIFT:** none — exactly 2 expected files
**Notes:**
  - Trigger `telegram-new-order` was calling https://padrino-pizzeria.vercel.app/api/telegram-new-order
    which returned 401 (Vercel Deployment Protection). Confirmed non-functional via 3 prod orders 2026-05-11.
  - Active Telegram flow untouched: api/create-order.ts → api/telegram-new-order direct server-to-server (12s timeout).
  - Out-of-scope flag from B3.5 (RUNBOOK §4.1 wrong URL) resolved in this batch.

---

## B4.1 — 2026-05-12 — safeNumber call-site fix — DONE

**Tier:** STRICT (branch: b4.1-safenumber-fix → merged to main, FF merge)
**SHA:** fe397ab
**Files:**
  - api/bankart-callback.ts (MODIFY — add `|| "300"` guard on getFirstEnv call, line 213)
  - api/bankart-order-status.ts (MODIFY — add `|| "15"` guard on getFirstEnv call, line 229)
  - vitest.setup.ts (MODIFY — remove 2-line BANKART_CALLBACK_MAX_SKEW_SECONDS workaround stub)
**Verify:**
  build:     PASS(machine) — exit 0, 4.05s (tsc -b + vite)
  typecheck: PASS(machine) — via npm run build
  test:      PASS(machine) — 5 files, 76/76
  manual:    PASS(human) — Pavle approved diff preview
**SCOPE_DRIFT:** none — exactly 3 expected files
**Notes:**
  - Permanent fix for L4 finding (B4): safeNumber("", fallback) returned 0 not fallback.
    Guard `|| "N"` ensures empty env string falls through to string default before safeNumber.
  - vitest.setup.ts stub was workaround; removed because code now self-defaults correctly.
  - Vercel env vars (BANKART_CALLBACK_MAX_SKEW_SECONDS=300, BANKART_STATUS_MIN_INTERVAL_SECONDS=15)
    remain set on Vercel as belt-and-suspenders (harmless, no regression risk).
  - safeNumber deduplication (3 copies in api/) still deferred to B8 (api/_shared, Faza C).

---

## B4 — 2026-05-12 — Kritični testovi (HMAC + canTransition coverage) — DONE

**Tier:** STRICT (branch: b4-critical-tests → merged to main, FF merge)
**SHA:** 2a02276
**Files:**
  - api/bankart-callback.ts (MODIFY — 5 export keywords: export type ReqLike + 4 export function; ZERO logic change)
  - api/admin-update-order-status.ts (MODIFY — 3 export keywords: export type OrderStatus + 2 export function; ZERO logic change)
  - api/bankart-callback.test.ts (NEW — 22 tests: createBankartSignature×5, safeEqualSignature×3, isDateFresh×6, verifyBankartCallbackSignature×7, handler smoke×1)
  - api/admin-update-order-status.test.ts (NEW — 22 tests: isOrderStatus×6, canTransition×14, handler smoke×2)
  - vitest.config.ts (MODIFY — added api/**/*.test.ts to include + setupFiles: [./vitest.setup.ts])
  - vitest.setup.ts (NEW — env stubs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BANKART_SHARED_SECRET, BANKART_CALLBACK_MAX_SKEW_SECONDS)
**Verify:**
  build:     PASS(machine) — exit 0, 8.05s (tsc -b + vite)
  typecheck: PASS(machine) — via npm run build (no separate typecheck script)
  test:      PASS(machine) — 5 test files, 76/76 (32 pre-existing + 44 new)
  manual:    PASS(human) — Pavle approved post Opus+Sonnet review
**SCOPE_DRIFT:** none — exactly 6 expected files (supabase/.temp/* not staged)
  Note: vitest.setup.ts has 4 env stubs (plan showed 3); 4th (BANKART_CALLBACK_MAX_SKEW_SECONDS)
  required due to L4 finding — same file, not extra file.
**Notes:**
  - L4 FINDING (expanded during B4): safeNumber("", fallback) returns 0 not fallback because
    Number("") = 0 is Number.isFinite() = true; fallback never activates for empty string input.
    Affects 2 env-var call sites:
    (1) api/bankart-callback.ts:213 — BANKART_CALLBACK_MAX_SKEW_SECONDS unset → 30s floor (intended 300s)
    (2) api/bankart-order-status.ts:229 — BANKART_STATUS_MIN_INTERVAL_SECONDS unset → 12s floor (intended 15s)
  - Mitigation: both env vars explicitly set on Vercel (Production+Preview) + deploy, 2026-05-12.
  - Permanent code fix queued: B4.1 STRICT mini-batch — add `|| "N"` guard at 2 call sites
    in lock-zone files; estimated ~4 lines diff across 3 files (2 api + vitest.setup.ts cleanup).
  - safeNumber duplicated 3× in api/ (create-order, bankart-callback, bankart-order-status);
    centralization deferred to B8 (api/_shared extraction, already in ROADMAP Faza C).

---

## W2 — 2026-05-11 — Workflow reconciliation — post-audit drift fix — DONE

**Tier:** LEAN (doc-only)
**Branch:** main
**SHA:** df62808
**Files:**
  - workflow/STATE.md (MODIFY — lock zone cleaned to 7 entries, faza progres updated, roadmap additions cleared, W2 DONE)
  - workflow/projects/padrino/CONTEXT.md (MODIFY — branch: main, removed api/_shared/* + 2 phantom hook rows from Ključni fajlovi, removed 3 phantom rows from Lock zone)
  - workflow/projects/padrino/ROADMAP.md (MODIFY — B1/B2/B3/B3.5 marked DONE; B15+B16 added to Faza B; B14 superseded to security audit; old B14 → Long-term; B8/B10 reframed as CREATE; B13 annotated near-no-op; reconciliation log section appended)
  - workflow/projects/padrino/DECISIONS.md (APPEND — Phase History RECORD-UNRELIABLE section with evidence table, D4 CAS race finding, B8/B10/B9/B14/B15/B16 action items, lock zone phantom cleanup documented)
**Verify:**
  build:     PASS(machine) — exit 0, 6.96s (includes tsc -b)
  typecheck: PASS(machine) — via npm run build
  test:      PASS(machine) — 32/32 vitest
  manual:    PASS(human) — Pavle approved
**SCOPE_DRIFT:** none — exactly 4 expected files (supabase/.temp/* not staged)
**Notes:**
  - 8 drift items (D1-D8) found in /audit 2026-05-11 — all resolved in this batch
  - D1-D3: phantom entries removed from lock zone + Ključni fajlovi + ROADMAP reframes
  - D4: CAS race → B16 STRICT batch queued
  - D5-D8: branch, B13 scope, B14 supersession, B9 confirmation — all documented
  - Pre-W0 Phase History marked REFERENCE-ONLY in DECISIONS.md (not authoritative)
  - New items in ROADMAP: B14 (security audit), B15 (trigger DROP), B16 (CAS fix)

---

## B3.5 — 2026-05-11 — Telegram flow doc correction — DONE

**Tier:** LEAN
**Branch:** main
**SHA:** 11d0f4d
**Files:**
  - RUNBOOK.md (MODIFY — §1 flow rewrite, §1.1 dead trigger note, §6 timeout 5s→12s)
  - workflow/projects/padrino/DECISIONS.md (APPEND — B3.5 audit finding)
**Verify:**
  build:     PASS(machine) — exit 0, 3.85s (includes tsc -b)
  typecheck: PASS(machine) — via npm run build
  test:      NIJE POKRENUTO — LEAN tier
  manual:    PASS(human) — Pavle approved diff pre-commit
**SCOPE_DRIFT:** none — exactly 2 expected files
**Notes:**
  - RUNBOOK §1 now names api/create-order.ts as DB writer and direct
    caller of api/telegram-new-order (server-to-server, 12s timeout)
  - §1.1 added: dead DB trigger documented (vercel.app → 401 Vercel
    Protection, confirmed 3 production orders 2026-05-11)
  - §6 timeout corrected: 5s (DB trigger value) → 12s (actual
    bestEffortTelegramNotify timeout)
  - Finding recorded in DECISIONS.md for audit trail
  - B15 queued: DROP dead trigger (LEAN, ~15min migration)
  - Out-of-scope flag: RUNBOOK §4.1 test URL still uses
    padrino-pizzeria.vercel.app (→ 401) — 1-line fix deferred to B15

---

## W1 — 2026-05-11 — Workflow merge to main + branch cleanup — DONE

**Tier:** STRICT (workflow structural change per RULES §21)
**Branch:** main
**Merge SHA:** fc05439 (merge commit, no-ff, brings in 6 commits
from workflow-v3-init: f538d40, 97ef306, e1fabad, a1f450c, 057c998,
79ba688)
**Files:**
  - workflow/STATE.md (MODIFY — branch field, faza progres entry,
    workflow v3 status, roadmap additions)
  - workflow/LOG.md (APPEND — this entry)
**Verify:**
  build:    PASS(machine) — npm run build, exit 0
  test:     PASS(machine) — 32/32 vitest
  typecheck: PASS(machine) — tsc -b passes
  drift:    PASS(machine) — only the 2 expected files in diff
  manual:   PASS(human) — Pavle verified padrinobudva.com healthy
            pre-push and post-push (Vercel deploy clean, no console
            errors, 3 independent test orders confirmed Telegram
            flow pattern across 2026-05-11 sessions)
**SCOPE_DRIFT:** none — only STATE.md and LOG.md
**Branch cleanup actions:**
  - Worktrees removed: elegant-margulis-3b4c56, practical-moser-add445
    (both at 279c6fc, Claude Code session artifacts, no work lost)
  - Branches deleted: claude/elegant-margulis-3b4c56,
    claude/practical-moser-add445, workflow-v3-init (local + origin)
  - Remaining branches: main (local), origin/main, origin/master (legacy)
**Notes:**
  - First batch under "direct on main" model. Default flow now is:
    plan → preview commit on main → Pavle approves → push → /close.
  - Per-batch feature branches reserved for STRICT-tier batches that
    touch src/** or api/** (e.g., future B6 CartProvider, B11 Bankart).
  - origin/master is legacy from initial repo creation; not used,
    deletion deferred to future housekeeping.

---

## B3 — 2026-05-11 — Schema baseline (supabase db pull) — DONE

**Tier:** STRICT
**Branch:** workflow-v3-init
**SHA:** 057c998
**Files:**
  - supabase/config.toml (NEW, 15018 bytes)
  - supabase/migrations/20260510230628_remote_schema.sql (NEW, 10906 bytes)
**Verify:**
  build:        PASS(machine) — 8.27s (includes tsc -b typecheck)
  test:         PASS(machine) — 32/32
  schema pull:  PASS(machine) — schema file written; remote migration history
                step intentionally failed (we did not want remote DB writes)
  manual:       PASS(human) — Pavle confirmed findings, no production impact
**SCOPE_DRIFT:** none — only supabase/config.toml + migrations/*.sql

**Findings (significant — not bugs, but undocumented):**

1. **DB Trigger for Telegram** (orders table):
   `CREATE TRIGGER "telegram-new-order" AFTER INSERT ON orders`
   calls https://padrino-pizzeria.vercel.app/api/telegram-new-order via
   supabase_functions.http_request (5s timeout). RUNBOOK.md was incomplete —
   it describes Telegram as Vercel-driven but actually the DB drives it.
   Doc update planned in next batch (B3.5).

2. **RLS uses hardcoded email** (orders table):
   allow_admin_select_by_email / allow_admin_update_by_email /
   allow_admin_delete_by_email policies hardcode 'pavlemitrovic01@gmail.com'.
   Does not consult admin_users table. Security debt — flagged for future
   security batch.

3. **admin_users has no RLS:**
   Table has GRANT ALL to anon and authenticated, but
   no ENABLE ROW LEVEL SECURITY. Protected only at API level via
   service_role. Anon client with Supabase JS could potentially read admin
   emails directly. Security smell — flagged for future security batch.

4. **delivery_zones NOT present** — confirms B2 finding. GPS polygon path
   in api/create-order.ts references a non-existent table; harmless because
   path is never activated (no lat/lng in payload).

**Notes:**
  - LIVE DB baseline now exists. All future schema changes MUST go through
    migrations. docs/db-schema-baseline.md "blocker" (Docker unavailable)
    is resolved.
  - Access token created in Supabase dashboard as "cli_b3" — never used
    before this run.
  - DB password and access token were used only via env vars; not committed.

---

## B2 — 2026-05-11 — Delivery fee audit — DONE

**Tier:** STRICT (read-only audit)
**Branch:** workflow-v3-init
**SHA:** e1fabad
**Files:** docs/delivery-fee-audit.md (+181 lines)
**Verify:**
  build:     PASS(machine) — 7.18s (includes tsc -b typecheck)
  test:      PASS(machine) — 32/32
  SQL query: PASS(human) — Pavle potvrdio rezultat iz Supabase SQL editora
  audit doc: PASS(human) — Pavle potvrdio nalaze ("close")
**SCOPE_DRIFT:** none — samo docs/delivery-fee-audit.md
**Notes:**
  - delivery_zones tabela NE POSTOJI u prod DB (ERROR 42P01)
  - GPS polygon path je arhitekturalno mrtav — fetchZones() nikad pozvan
  - Fee flow radi ispravno kroz meta note parsing (sve 8 zone CLEAN)
  - B5 (delivery fee fix) se NE IZVRŠAVA — nema produkcijskog baga
  - Risk R1: formatFeeEurShort rounding za buduće non-round zone (low)
  - Risk R2: Dead DB code (fetchZones, delivery_zones ref) (cosmetic)

---

## B1 — 2026-05-11 — Lint fix — DONE (no-op)

**Tier:** LEAN (no-op)
**Branch:** workflow-v3-init
**SHA:** —
**Files:** none
**Verify:** npm run lint — PASS(machine) — 0 errors
**SCOPE_DRIFT:** none
**Notes:**
  Lint je bio čist na workflow-v3-init. Hooks (useBankartPaymentJsInit,
  useDeliveryZone) ne postoje jer su preemptivno rezervisani u LOCK zoni
  za buduću ekstrakciju. Nema akcije potrebne.

---

## W0 — 2026-05-10 — Workflow v3 Init — DONE

**Tier:** STRICT (workflow bootstrap)
**Branch:** workflow-v3-init
**Files created:** workflow/STATE.md, workflow/LOG.md,
  workflow/projects/padrino/{CONTEXT,ROADMAP,DECISIONS,LESSONS}.md
**Files modified:** CLAUDE.md (refactored to bootstrap format)
**Files preserved:** RUNBOOK.md, DEPLOYMENT_CHECKLIST.md, docs/*,
  workflow/RULES.md, .claude/*
**Verification:** PASS(machine) — npm run build, npm test
**Approval:** Pavle — manual review of preview before commit
**Notes:** First Padrino batch under workflow v3. Framework files
  (RULES.md + .claude/*) imported in previous commit (f538d40) from
  cl3menza repo. Project moved from OneDrive to C:\dev\padrino prior
  to W0 to eliminate sync risk.
