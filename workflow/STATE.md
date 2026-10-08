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

**Poslednji završen:** B23d — Server upisuje prikazne podatke reda iz menu_items (2026-10-08, STRICT, SHA d393d6d). **B23b + B23c + B23d mergovani u main** (merge c2df757, 2026-10-08; Vercel production READY `dpl_8rZWs8bMhUMZfq3T6SP8WjNt9c6p`; prod verifikacija OTVORENA). B22 (2026-10-07, STRICT, SHA 0c340dc) mergovan u `claude/wonderful-cray-5p9z2e`, **NIJE u main-u** (migracija B22 je živa na produ od 2026-10-07).
**Sledeći:** (1) Prod verifikacija B23b–d: negativni smoke (50 cm + ivice 33 → 400 `crust_size_mismatch`; stavka sa količinom −1 → 400 `Invalid item structure`; ni jedan bez reda u `orders`) + prva prava porudžbina: Telegram isti format („1x Diavolo (50)", dodaci po imenu) + SQL (`name`/`size`/imena dodataka/cene = `menu_items`). (2) Ostatak Faze S (ROADMAP): B23e (status/currency fiksni + dostava na serveru — B2 audit je proverio samo poštenog klijenta), B24, B25, B26 — rade se na `claude/wonderful-cray-5p9z2e`, review pa merge. B22 ide u main zajedno sa njima (prod smoke: porudžbina gotovinom → Telegram tačno jednom; admin lista; meni). Otvoreno iz B19: prod verifikacija radnog vremena nije zabeležena kao završena — `/admin/settings` je dokazano živ na produ (B19.1 verifikovan protiv prod `site_settings` = 11–01), ali E2E prolaz porudžbine + `/#kontakt` prikaz + zatvoreni opseg test nisu potvrđeni u dokumentaciji; zatvoreni test raditi u mirnom terminu (sajt aktivno prima porudžbine) i VRATITI pravo radno vreme. Ostali kandidati: React duplicate-key greška u meniju (nije korpa — reprodukovana sa praznom korpom); sheet bira veličinu samo pri otvaranju (tap na picu pre učitavanja menija → 33 cm bez izbora veličine); slika `/extras/rub.webp` postojećeg reda ivica 33 cm ne postoji u repou (admin prikaz). Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:** Faza S (Security & money-path hardening) IN PROGRESS — B22 + B23a–B23d DONE (u main-u: B23a–B23d; B22 čeka merge). Sve ranije faze DONE.
Puna hronologija (batch po batch, sa datumima i napomenama) je premeštena u
`workflow/STATE-ARCHIVE.md` pri B19 close-u (STATE.md je bio ~36KB, target ~8KB).
Per-batch audit trail (verify gate-ovi, fajlovi, SHA) → `workflow/LOG.md`.

- B23d (Server upisuje prikazne podatke reda iz menu_items) — DONE 2026-10-08
  (STRICT; 5 fajlova, +412/-3; SHA d393d6d; ime bez „33/50 cm", veličina iz imena reda,
  imena i cene dodataka, base_price i price_per_item upisuju se iz menu_items, ne iz zahteva;
  format za kuhinju isti — parity: upisani redovi = poslati; category ostaje klijentska; čeka merge)

- B23c (Server naplaćuje svaki red koji kuhinja vidi) — DONE 2026-10-08
  (STRICT; 2 fajla, +234/-39; SHA 0a2562f + 39a5012; „meta" po pravilu kuhinje, svaki drugi red
  mora imati cart_id, menu_item_id, količinu 1–99 i dodatke sa id + količinom 1–99 i naplaćuje se
  iz menu_items; total mora biti siguran ceo broj; ivice kao samostalna stavka odbijene; čeka merge)

B23b i starije → `workflow/STATE-ARCHIVE.md` (B23b rotiran pri B23d close-u, B23a pri B23c close-u; 2-batch cap).

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
