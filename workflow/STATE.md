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

**Poslednji završen:** B21 — Brisanje pre-L8.4 inline cart-editing API-ja (2026-07-27, STANDARD, SHA e1f4ece). Prethodni: B20 — Cart line identity (2026-07-27, STRICT, SHA 27a7b51, merged 5937390 + pushed, prod potvrđen)
**Sledeći:** B21 čeka merge → main + push (prod verifikacija posle deploya: korpa radi normalno — dodavanje, qty, brisanje, edit-reopen). Otvoreno iz B19: prod verifikacija radnog vremena nije zabeležena kao završena — `/admin/settings` je dokazano živ na produ (B19.1 verifikovan protiv prod `site_settings` = 11–01), ali E2E prolaz porudžbine + `/#kontakt` prikaz + zatvoreni opseg test nisu potvrđeni u dokumentaciji; zatvoreni test raditi u mirnom terminu (sajt aktivno prima porudžbine) i VRATITI pravo radno vreme. Kandidati za sledeći batch: LEAN brisanje mrtvog koda (`changeSize` + `setPizzaSizeSafe`/`addDrinkToCart`), React duplicate-key greška u meniju (nije korpa — reprodukovana sa praznom korpom). Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** sve faze i serije zaključno sa B21 — DONE.
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B21 (Brisanje pre-L8.4 inline cart-editing API-ja) — DONE 2026-07-27
  (STANDARD; 6 fajlova, +3/-243; SHA e1f4ece; changeSize + 5 addon/note mutatora
  iz lock zone + setPizzaSizeSafe/addDrinkToCart/sauceIdSet/onError iz
  useCatalogData; nedostižnost dokazana typecheck-om preko CartContextType)

- B20 (Cart line identity — 33 cm i 50 cm kao odvojeni redovi) — DONE 2026-07-27
  (STRICT; 3 fajla, +521/-100; SHA 27a7b51; ključ reda = menu item + veličina +
  dodaci + napomena; pao i overcharge na dodacima pri re-add-u; prvi CartProvider
  testovi u repo-u, 18 komada; uzrok = zaostatak L8.4 refaktora)

B19 i starije → `workflow/STATE-ARCHIVE.md` (rotirano pri B21 close-u, 2-batch cap).

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
