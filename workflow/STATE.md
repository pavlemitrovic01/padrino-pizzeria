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

**Poslednji završen:** W1 — Workflow merge to main + branch cleanup (2026-05-11)
**Sledeći:** B3.5 — Doc update for Telegram DB trigger (LEAN)
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
- Faza A — Stabilization & Audit (B4) — remaining

**Roadmap additions (decided 2026-05-11):**

Note: B14 in ROADMAP.md (CartDrawer Phase 3 + AdminOrders/AdminMenu
split, Faza D) is superseded by B14 below (security audit). Old
CartDrawer item deferred to B16+ "Long-term, defer until concrete
blocker". Full ROADMAP.md reconciliation deferred to a future
workflow housekeeping batch.

- **B3.5** — Telegram flow doc correction (LEAN, doc-only) — NEXT
- **B14** — Security audit: RLS hardcoded email + admin_users RLS
  (STRICT, ~2h) — after Faza A complete
- **B15** — Telegram DB trigger DROP (LEAN, ~15min) — single
  migration to drop dead `telegram-new-order` trigger. Real Telegram
  delivery is via `api/create-order.ts`; trigger hits vercel.app URL
  which is under Vercel Protection (401, see LESSONS L2) and sends
  empty body. Fix-in-place rejected (would need 3 coordinated
  changes for redundant functionality). Schedule after B3.5 doc
  update is committed.

**Workflow v3 status:** live on main branch. workflow-v3-init merged
(fc05439) and removed 2026-05-11. Default model: direct commits on main
with preview-then-approve flow. Per-batch branches only for STRICT-tier
code-touching batches (e.g., src/**, api/**); doc/audit batches direct.
4 batches completed (B1 no-op, B2 audit, B3 schema baseline, W1 housekeeping).

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
- `api/_shared/*`
- `src/hooks/useBankartPaymentJsInit.ts`
- `src/hooks/useDeliveryZone.ts`

---

> Pavle: ako ovaj fajl ne odražava stvarno stanje, prijavi pre nego
> što počneš rad.
