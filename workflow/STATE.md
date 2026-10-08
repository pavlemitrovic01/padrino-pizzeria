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

**Poslednji završen:** B23b — Serverska provera veličine ivica (2026-10-08, STRICT, SHA ddd8846, branch `claude/vibrant-euler-oxmwb0` pushovan, Vercel preview READY; **NIJE mergovan u main** — prod provera čeka merge). Prethodni: B23a — 50 cm + punjene ivice (Total mismatch) (2026-10-07, STRICT, SHA e7c907c + c6ab9c8, merged 413dc7c + pushed, migracija primenjena 2026-10-08, prod potvrđen — UI + E2E porudžbina 2026-10-08)
**Sledeći:** (1) Merge B23b u main + prod verifikacija: negativni smoke (50 cm + ivice 33 → 400 `crust_size_mismatch`, bez reda u `orders`) + SQL nad sledećim pravim porudžbinama sa ivicama (prolaze). (2) **B23c** (STRICT, `api/create-order.ts`, lock zona): stavka sa `menu_item_id` a bez `price_per_item` upisuje se u porudžbinu ali se NE naplaćuje — nađeno u B23b i dokazano testom (3× pica 50 cm uz kolu → 200 ok, naplaćeno 2,50 €); prvi korak proveriti da li takva stavka stiže do kuhinje (Telegram/admin). Otvoreno iz B19: prod verifikacija radnog vremena nije zabeležena kao završena — `/admin/settings` je dokazano živ na produ (B19.1 verifikovan protiv prod `site_settings` = 11–01), ali E2E prolaz porudžbine + `/#kontakt` prikaz + zatvoreni opseg test nisu potvrđeni u dokumentaciji; zatvoreni test raditi u mirnom terminu (sajt aktivno prima porudžbine) i VRATITI pravo radno vreme. Ostali kandidati: React duplicate-key greška u meniju (nije korpa — reprodukovana sa praznom korpom); sheet bira veličinu samo pri otvaranju (tap na picu pre učitavanja menija → 33 cm bez izbora veličine); slika `/extras/rub.webp` postojećeg reda ivica 33 cm ne postoji u repou (admin prikaz). Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** sve faze i serije zaključno sa B23b — DONE (B23b čeka merge u main).
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B23b (Serverska provera veličine ivica) — DONE 2026-10-08
  (STRICT; 5 fajlova, +335/-7; SHA ddd8846; server odbija ivice koje ne odgovaraju
  veličini pice — 400 `crust_size_mismatch` pre upisa i Bankart-a; veličina iz imena
  reda u bazi, ne iz klijentskog `size`; parity test klijent↔server; čeka merge)

- B23a (50 cm + punjene ivice — Total mismatch) — DONE 2026-10-07
  (STRICT; 5 fajlova, +786/-57; SHA e7c907c + c6ab9c8; ivice po veličini kao poseban
  red u meniju, korpa više ne prepisuje cene; parity test kroz pravi checkout do
  servera; merged 413dc7c; migracija primenjena 2026-10-08; prod potvrđen —
  UI + E2E porudžbina)

B21 i starije → `workflow/STATE-ARCHIVE.md` (B21 rotiran pri B23b close-u, B20 pri B23a close-u; 2-batch cap).

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
