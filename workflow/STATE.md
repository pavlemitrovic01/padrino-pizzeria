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

**Poslednji završen:** B19 — Business hours gate (porudžbine samo u radnom vremenu) (2026-07-27, STRICT, SHA c58775b, merged b8403bd + pushed) + B19.1 follow-up fix (SHA 9663df2, closed-state checkout dugme). Prethodni: B18 — Idempotent Telegram notifikacija (2026-07-12, STRICT, merged 267fba2, E2E smoke potvrđen)
**Sledeći:** B20 — cart line identity (33cm i 50cm iste pice se stakuju u jedan red korpe; STRICT, lock zone). Otvoreno iz B19: prod verifikacija radnog vremena nije zabeležena kao završena — `/admin/settings` je dokazano živ na produ (B19.1 verifikovan protiv prod `site_settings` = 11–01), ali E2E prolaz porudžbine + `/#kontakt` prikaz + zatvoreni opseg test nisu potvrđeni u dokumentaciji. Zatvoreni test raditi u mirnom terminu (sajt aktivno prima porudžbine) i VRATITI pravo radno vreme. Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** sve faze i serije zaključno sa B19 — DONE.
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B19 (Business hours gate — porudžbine samo u radnom vremenu) — DONE 2026-07-27
  (STRICT; 13 fajlova, +758/-20; SHA c58775b; migracija na produ; fail-open dizajn;
  `Europe/Podgorica` + prelazak ponoći; admin open/close = jedini izvor istine)
  - B19.1 follow-up (SHA 9663df2, 2026-07-27): closed-state checkout dugme —
    sivo, stvarno disabled, label "Trenutno ne primamo porudžbine • <sati>";
    zamenilo poseban crveni banner. Disable SAMO van radnog vremena (validacione
    greške ostaju klikabilne da bi feedback radio). Otvoren follow-up: nema testa
    koji pokriva oba stanja labele.

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
