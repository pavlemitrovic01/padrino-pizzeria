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

**Poslednji završen:** B23a — 50 cm + punjene ivice (Total mismatch) (2026-10-07, STRICT, SHA e7c907c + c6ab9c8, merged 413dc7c + pushed, migracija primenjena 2026-10-08, prod UI potvrđen). Prethodni: B21 — Brisanje pre-L8.4 inline cart-editing API-ja (2026-07-27, STANDARD, SHA e1f4ece, merged f4fb32d + pushed)
**Sledeći:** B23a, otvoreno: prva prava porudžbina 50 cm + ivice — proveriti SQL-om (stavka sa addon ID-jem `45e0b0b6-c40c-4f3d-b911-a83d8a7bd053`) ili probnom gotovinskom porudžbinom u mirnom terminu (pa otkazati u adminu); UI na produ potvrđen, merge 413dc7c, migracija primenjena 2026-10-08. Sledeći batch kandidat: B23b — serverska provera da veličina ivica odgovara veličini pice (`api/create-order.ts`, lock zona; preostali rizik −2 € samo uz ručno menjanje zahteva). Otvoreno iz B19: prod verifikacija radnog vremena nije zabeležena kao završena — `/admin/settings` je dokazano živ na produ (B19.1 verifikovan protiv prod `site_settings` = 11–01), ali E2E prolaz porudžbine + `/#kontakt` prikaz + zatvoreni opseg test nisu potvrđeni u dokumentaciji; zatvoreni test raditi u mirnom terminu (sajt aktivno prima porudžbine) i VRATITI pravo radno vreme. Ostali kandidati: React duplicate-key greška u meniju (nije korpa — reprodukovana sa praznom korpom); sheet bira veličinu samo pri otvaranju (tap na picu pre učitavanja menija → 33 cm bez izbora veličine); slika `/extras/rub.webp` postojećeg reda ivica 33 cm ne postoji u repou (admin prikaz). Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** sve faze i serije zaključno sa B23a — DONE (B23a: E2E porudžbina 50 cm + ivice još nije zabeležena).
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B23a (50 cm + punjene ivice — Total mismatch) — DONE 2026-10-07
  (STRICT; 5 fajlova, +786/-57; SHA e7c907c + c6ab9c8; ivice po veličini kao poseban
  red u meniju, korpa više ne prepisuje cene; parity test kroz pravi checkout do
  servera; merged 413dc7c; migracija primenjena 2026-10-08; prod UI potvrđen,
  E2E porudžbina otvorena)

- B21 (Brisanje pre-L8.4 inline cart-editing API-ja) — DONE 2026-07-27
  (STANDARD; 6 fajlova, +3/-243; SHA e1f4ece; changeSize + 5 addon/note mutatora
  iz lock zone + setPizzaSizeSafe/addDrinkToCart/sauceIdSet/onError iz
  useCatalogData; nedostižnost dokazana typecheck-om preko CartContextType)

B20 i starije → `workflow/STATE-ARCHIVE.md` (B20 rotiran pri B23a close-u, B19 pri B21 close-u; 2-batch cap).

---

## Lock zone

Fajlovi koje ne dirati bez STRICT tier batch-a + Pavle approval-a.
Full list with reasons in `workflow/projects/padrino/CONTEXT.md`.

- `src/components/CartDrawer.tsx`
- `src/context/CartProvider.tsx`
- `src/App.tsx`
- `api/create-order.ts`
- `api/bankart-callback.ts`
- `api/bankart-order-status.ts`
- `api/telegram-new-order.ts`

---

> Pavle: ako ovaj fajl ne odražava stvarno stanje, prijavi pre nego
> što počneš rad.
