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

**Poslednji završen:** B22 — Zaključavanje baze i tajni (2026-10-07, STRICT, SHA 0c340dc; Faza S). Prethodni: B21 — Brisanje pre-L8.4 inline cart-editing API-ja (2026-07-27, STANDARD, SHA e1f4ece, merged f4fb32d)
**Sledeći:** (1) B22 kod čeka merge `claude/keen-tesla-jprhog` → main + prod smoke (porudžbina gotovinom → Telegram tačno jednom; admin lista porudžbina; meni). Migracija je VEĆ živa na produ. (2) **B23a — 50 cm + punjene ivice** (audit #6, gubi promet od ~aprila 2026: klijent šalje 4 €, baza 2 € → `Total mismatch`) kao mali zaseban STRICT batch, pa (3) B23b — serverska validacija cena (audit #2–#4). Zatim B24 → B25 → B26 (ROADMAP Faza S). Otvoreno iz B19: prod verifikacija zatvorenog opsega radnog vremena nije zabeležena (raditi u mirnom terminu i VRATITI pravo radno vreme). React duplicate-key greška u meniju → B25.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** Faza S (Security & money-path hardening) IN PROGRESS — B22 DONE; B23–B26 čekaju. Sve ranije faze DONE.
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B22 (Zaključavanje baze i tajni — Faza S) — DONE 2026-10-07
  (STRICT; 12 fajlova, +249/-133; SHA 0c340dc; anon INSERT u orders zatvoren +
  write grantovi revokovani na prodnoj bazi (SQL Editor); CHECK status/currency;
  Origin se nikad ne koristi; Telegram endpoint fail-closed; NO FINDINGS security-review)

- B21 (Brisanje pre-L8.4 inline cart-editing API-ja) — DONE 2026-07-27
  (STANDARD; 6 fajlova, +3/-243; SHA e1f4ece; changeSize + 5 addon/note mutatora
  iz lock zone + setPizzaSizeSafe/addDrinkToCart/sauceIdSet/onError iz
  useCatalogData; nedostižnost dokazana typecheck-om preko CartContextType)

B20 i starije → `workflow/STATE-ARCHIVE.md` (rotirano pri B22 close-u, 2-batch cap).

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
