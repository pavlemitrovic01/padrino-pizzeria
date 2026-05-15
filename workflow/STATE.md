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

**Poslednji završen:** B16 — CAS atomicity fix in admin-update-order-status (2026-05-15)
**Sledeći:** B6 — CartProvider duplikati → cartDrawerHelpers (Faza C first batch) — needs /plan
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:**
- Pre-W0 (Padrino history): 9 closed batches B1-B9 from old workflow
  (full record in DECISIONS.md). Old workflow used ChatGPT Plan +
  Composer Execute pattern.
- W0 (Workflow v3 init) — DONE 2026-05-10
- B1 (Lint fix) — DONE no-op 2026-05-11
- B2 (Delivery fee audit) — DONE 2026-05-11
- B3 (Schema baseline) — DONE 2026-05-11
- W1 (Workflow merge to main + branch cleanup) — DONE 2026-05-11
- B3.5 (Telegram flow doc correction) — DONE 2026-05-11
- W2 (Workflow reconciliation — post-audit drift fix) — DONE 2026-05-11
- B4 (Kritični testovi — HMAC + canTransition) — DONE 2026-05-12
- B4.1 (safeNumber call-site fix) — DONE 2026-05-12
- **Faza A — DONE** ✓
- B15 (Telegram DB trigger DROP) — DONE 2026-05-12
- B11 (Bankart raw error sanitization) — DONE 2026-05-12
- B16 (CAS atomicity fix — admin-update-order-status) — DONE 2026-05-15
- **Faza B — DONE** ✓
- Faza C — next: B6

**Workflow v3 status:** live on main branch. workflow-v3-init merged
(fc05439) and removed 2026-05-11. Default model: direct commits on main
with preview-then-approve flow. Per-batch branches only for STRICT-tier
code-touching batches (e.g., src/**, api/**); doc/audit batches direct.
11 batches completed (B1 no-op, B2 audit, B3 schema baseline,
W1 housekeeping, B3.5 Telegram doc, W2 reconciliation, B4 tests, B4.1 fix,
B15 trigger drop, B11 error sanitization, B16 CAS fix).

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
