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

**Poslednji završen:** B23c — Server naplaćuje svaki red koji kuhinja vidi (2026-10-08, STRICT, SHA 0a2562f + 39a5012, branch `claude/vibrant-euler-oxmwb0` pushovan, Vercel preview READY; **NIJE mergovan u main**). Prethodni: B23b — Serverska provera veličine ivica (2026-10-08, STRICT, SHA ddd8846, isti branch, **NIJE mergovan u main**)
**Sledeći:** (1) Merge B23b + B23c u main (oba na `claude/vibrant-euler-oxmwb0`) + prod verifikacija: negativni smoke (50 cm + ivice 33 → 400 `crust_size_mismatch`; stavka sa količinom −1 → 400 `Invalid item structure`; ni jedan bez reda u `orders`) + SQL nad sledećim pravim porudžbinama (prolaze). (2) **B23d** (STRICT, `api/create-order.ts`, lock zona): server čuva klijentske prikazne podatke koje kuhinja čita — `name`, `size`, imena dodataka, `price_per_item`/`price` — a naplaćuje po ID-ju; ručno izmenjen zahtev: red 33 cm sa `size:"50"` → kuhinja pravi 50 cm, naplata 33 cm; besplatan dodatak nazvan „Ivice…" → kuhinja pravi ivice za 0 €; admin prikazuje klijentske cene redova. Predlog iz code review-a: server prepisuje te podatke iz `menu_items` pre upisa (menja izgled poruka u kuhinji — traži Pavlovu odluku). (3) Dostava se čita iz klijentske napomene („Dostava: X €") — proveriti da li je B2 audit (`docs/delivery-fee-audit.md`) to svesno prihvatio. Otvoreno iz B19: prod verifikacija radnog vremena nije zabeležena kao završena — `/admin/settings` je dokazano živ na produ (B19.1 verifikovan protiv prod `site_settings` = 11–01), ali E2E prolaz porudžbine + `/#kontakt` prikaz + zatvoreni opseg test nisu potvrđeni u dokumentaciji; zatvoreni test raditi u mirnom terminu (sajt aktivno prima porudžbine) i VRATITI pravo radno vreme. Ostali kandidati: React duplicate-key greška u meniju (nije korpa — reprodukovana sa praznom korpom); sheet bira veličinu samo pri otvaranju (tap na picu pre učitavanja menija → 33 cm bez izbora veličine); slika `/extras/rub.webp` postojećeg reda ivica 33 cm ne postoji u repou (admin prikaz). Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** sve faze i serije zaključno sa B23c — DONE (B23b + B23c čekaju merge u main).
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B23c (Server naplaćuje svaki red koji kuhinja vidi) — DONE 2026-10-08
  (STRICT; 2 fajla, +234/-39; SHA 0a2562f + 39a5012; „meta" po pravilu kuhinje, svaki drugi red
  mora imati cart_id, menu_item_id, količinu 1–99 i dodatke sa id + količinom 1–99 i naplaćuje se
  iz menu_items; total mora biti siguran ceo broj; ivice kao samostalna stavka odbijene; čeka merge)

- B23b (Serverska provera veličine ivica) — DONE 2026-10-08
  (STRICT; 5 fajlova, +335/-7; SHA ddd8846; server odbija ivice koje ne odgovaraju
  veličini pice — 400 `crust_size_mismatch` pre upisa i Bankart-a; veličina iz imena
  reda u bazi, ne iz klijentskog `size`; parity test klijent↔server; čeka merge)

B23a i starije → `workflow/STATE-ARCHIVE.md` (B23a rotiran pri B23c close-u, B21 pri B23b close-u; 2-batch cap).

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
