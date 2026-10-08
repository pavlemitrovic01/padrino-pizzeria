# STATE.md — Trenutno stanje

> Jedini source of truth za "gde sam sada".
> Claude Code čita ovo na početku svake sesije (auto-inject via session-bootstrap hook).
> Overwrituje se na kraju svake sesije kroz `/close` skill.
> **Ne ažuriraj ručno** — ide samo kroz `/close`.

---

## Aktivan projekat

| Polje | Vrednost |
|-------|----------|
| Ime | padrino-budva |
| Stack | React 19.2 + TypeScript 5.9 + Vite 7.2 + Tailwind 3.4 + Framer Motion 12 + Vercel |
| Repo | github.com/pavlemitrovic01/padrino-pizzeria, branch: main |
| Production | https://padrinobudva.com |
| Aktivni plan | `workflow/projects/padrino/ROADMAP.md` |
| Kontekst | `workflow/projects/padrino/CONTEXT.md` |

---

## Gde sam sada

**Poslednji završen:** Faza S u main-u i na produ — merge 9499183 (2026-10-08 23:30 UTC; B22 + B23e + B24 + B25 + B26 + review), Vercel production READY `dpl_7ifRfYN7ZtEXcRDgKxxy4Vj5yErF`; migracije `orders_idempotency_key` + `menu_items_hygiene` primenjene i proverene. Rollback: `dpl_8rZWs8bMhUMZfq3T6SP8WjNt9c6p` (c2df757). **Prod smoke OTVOREN** (container ne dopire do sajta).
**Sledeći (Pavle, redom):**
(1) **Prod smoke** (prvi radni sat): porudžbina gotovinom Budva (Telegram tačno jednom, „Plaćanje: Gotovina", „Zona: Budva, Dostava: 0€", „1x … (50)"); Bečići ispod 15 € (dostava 3 € naplaćena); kartica (redirect → paid → Telegram); admin lista + „Pošalji ponovo"; meni + slike; DevTools Console (CSP samo prijavljuje). Pa javi — SQL nad tim porudžbinama (total, meta red, `idempotency_key`, imena iz menija) radim ja i upisujem PASS.
(2) Vercel: postavi `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (bez njih create-order NEMA rate limit); proveri koja imena env-a projekat koristi (`SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_KEY`, `BANKART_*` vs `NLB_*`) — tek onda brisanje aliasa; obriši nekorišćene `TELEGRAM_WEBHOOK_SECRET`, `PAYMENTS_EDGE_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY`.
(3) Supabase: ugasi edge funkciju `payments-create-session`. Posle ~7 dana CSP prijava („[csp-report]" u Vercel logovima) → CSP na enforce.
(4) **Odluke:** GA4 consent; Supabase Auth signup OFF + `shouldCreateUser:false` (lomi dodavanje osoblja); LESSONS na cap-u 7 — koju rotirati za „audit happy-path ≠ audit napadača"; React duplicate-key — stek iz konzole.
Otvoreno iz B19: prod verifikacija radnog vremena nije zabeležena kao završena — `/admin/settings` je dokazano živ na produ (B19.1 verifikovan protiv prod `site_settings` = 11–01), ali E2E prolaz porudžbine + `/#kontakt` prikaz + zatvoreni opseg test nisu potvrđeni u dokumentaciji; zatvoreni test raditi u mirnom terminu (sajt aktivno prima porudžbine) i VRATITI pravo radno vreme. Ostali kandidati: React duplicate-key greška u meniju (nije korpa — reprodukovana sa praznom korpom); sheet bira veličinu samo pri otvaranju (tap na picu pre učitavanja menija → 33 cm bez izbora veličine); slika `/extras/rub.webp` postojećeg reda ivica 33 cm ne postoji u repou (admin prikaz). Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** Faza S (Security & money-path hardening) — B22–B26 DONE i u main-u (9499183), prod smoke otvoren. Sve ranije faze DONE.
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B26 (Čišćenje koda i istina u dokumentaciji) — DONE 2026-10-08
  (STRICT; SHA 4e2048d + 77c16c4 + ad3e9e9 + 7cd6097; jedna kopija env/supabase/json helpera,
  create-order.ts 1235 → 510 (order-items + bankart-debit u api/_shared), docs bez netačnih tvrdnji,
  /close gate-uje lint, /plan NAPADAČ, /audit nespojeni batch-evi; merged 9499183)

- B25 (Frontend hardening, performanse, menu podaci) — DONE 2026-10-08
  (STANDARD; SHA 25e15d3; security headeri + CSP Report-Only → /api/log, limiti na /api/log,
  upload samo JPEG/PNG/WebP po bajtovima, 38 slika u pravi WebP (~4,9 → ~1,9 MB), menu migracija
  primenjena 2026-10-08; merged 9499183)

B24 i starije → `workflow/STATE-ARCHIVE.md` (B23c, B23d, B23e, B24 rotirani pri B26 close-u; 2-batch cap).

---

## Lock zone

Fajlovi koje ne dirati bez STRICT tier batch-a + Pavle approval-a.
Kopija liste iz `workflow/projects/padrino/CONTEXT.md` (jedina lista, B26) — razlozi tamo.

- `src/components/CartDrawer.tsx`
- `src/components/CartView.tsx` (K–O period)
- `src/components/CardFields.tsx` (K–O period)
- `src/context/CartProvider.tsx`
- `src/App.tsx`
- `api/create-order.ts`
- `api/_shared/order-items.ts`
- `api/_shared/bankart-debit.ts`
- `api/_shared/delivery-zones.ts`
- `api/bankart-callback.ts`
- `api/bankart-order-status.ts`
- `api/_shared/payment-status.ts`
- `api/_shared/telegram.ts`

---

> Pavle: ako ovaj fajl ne odražava stvarno stanje, prijavi pre nego
> što počneš rad.
