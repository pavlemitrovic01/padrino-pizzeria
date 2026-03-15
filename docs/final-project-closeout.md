# Padrino Budva — Final Project Closeout

**Datum:** PSCP final closeout.  
**Projekat:** Padrino Pizzeria Budva.

---

## Current stable checkpoint commits

| Commit | Opis |
|--------|------|
| `f53f157` | docs: add PSCP audit artifacts |
| `fe816c4` | CartDrawer Phase 2 presentational extraction |
| `b7a34f8` | CartDrawer Phase 1 helper extraction |
| `936ed1f` | Menu loading skeleton |
| `ed51537` | Refund status-path fix (Bankart) |
| `c23851a` | 3-batch closeout: payment/env, large-files, SEO, DB docs |

---

## Šta je završeno

- Refund status-path fix (paid orders no longer hard-skipped)
- Menu loading skeleton
- CartDrawer Phase 1: 20 pure helpers → `src/lib/cartDrawerHelpers.ts`
- CartDrawer Phase 2: SmartCartImage, SmartMiniAddonImage → `src/components/CartDrawerImage.tsx`
- PSCP audit docs (admin-api, cartdrawer, phase1/2, refund-sync)
- Payment/env audit, large-files audit, SEO cleanup
- DB schema baseline policy (docs/db-schema-baseline.md)

---

## Source of truth

- Local repo / latest remote state
- LOCK fajlovi: CartDrawer.tsx, api/create-order.ts, api/bankart-*.ts, api/telegram-new-order.ts

---

## LOCK delovi (ne dirati bez odobrenja)

| Fajl | Napomena |
|------|----------|
| `src/components/CartDrawer.tsx` | LOCK |
| `api/create-order.ts` | LOCK — serverska validacija cena |
| `api/bankart-callback.ts` | LOCK — Bankart flow |
| `api/bankart-order-status.ts` | LOCK — Bankart flow |
| `api/telegram-new-order.ts` | LOCK — Telegram logika |

---

## Verify pending

- **Browser smoke:** CartDrawer/UI (open cart, add/remove, images, addons, sauces, drinks, stuffed crust, fallback)
- **Operational:** Real refund scenario verify when it happens — does not block technical closeout

---

## Operational note

Real refund scenario verify when it happens. Does not block technical closeout.

---

## LIVE DB baseline

**Status:** Pending. Blocker: Docker Desktop nije dostupan. `supabase db pull` zahteva Docker.

**Kada rešiti:** Instalirati Docker Desktop, zatim `supabase db pull` za pravi baseline iz LIVE baze.
