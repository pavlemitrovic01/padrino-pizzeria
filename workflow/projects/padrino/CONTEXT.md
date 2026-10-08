# CONTEXT.md — Padrino Pizzeria

## Projekat

| Polje | Vrednost |
|-------|----------|
| Stack | React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.4 + Tailwind 3.4.19 + Framer Motion 12.29.0 + Vercel |
| Repo | github.com/pavlemitrovic01/padrino-pizzeria, branch: main |
| Production | https://padrinobudva.com |

## Arhitektura

- Frontend: React 19 + Vite 7 + TypeScript strict + Tailwind utility CSS
- Backend: Vercel Serverless (`api/`, 10 funkcija — Hobby limit 12, LESSON L8); nema Supabase Edge funkcija (B24)
- DB: Supabase PostgreSQL + RLS
- Auth: Supabase Auth (admin only)
- Payment: Bankart Payment.js + redirect fallback (HMAC-signed callbacks)
- Notifications: Telegram bot (best-effort, never blocks transaction) — handleri zovu `notifyNewOrder()` direktno (B24)
- Rate limiting: Upstash Redis na create-order (10/60 s po IP); bez `UPSTASH_*` env-a NEMA limita (fail-open, bez in-memory fallback-a)
- Testing: Vitest — server handleri (hostile input, Bankart, idempotency), klijent↔server parity kroz pravi checkout (`src/lib/pricingParity.test.tsx`), DOM/E2E korpe. Broj testova: poslednji LOG.md entry (ovde rotira).
- Deploy: Vercel (production: padrinobudva.com)
- Security headers: vercel.json (B25) — X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, CSP **Report-Only** (prijave → `/api/log`). HSTS daje Vercel, ne mi.

## Ključni fajlovi

| Fajl | Uloga |
|------|-------|
| `src/main.tsx` | Entry, ErrorBoundary, monitoring init |
| `src/App.tsx` | Router, mode orchestration, lazy sections — LOCK |
| `src/components/CartDrawer.tsx` | Checkout flow + payment — LOCK |
| `src/context/CartProvider.tsx` | Cart state machine — LOCK |
| `src/sections/Menu.tsx` | Menu display + add to cart |
| `api/create-order.ts` | Order flow: provere, cena iz `menu_items`, dostava po zoni, upis, Bankart — LOCK |
| `api/_shared/order-items.ts` | Pravila redova: meta vs stavka, cena, ivice, šta kuhinja vidi — LOCK |
| `api/_shared/bankart-debit.ts` | Bankart debit (potpisan zahtev, stanje plaćanja) — LOCK |
| `api/_shared/delivery-zones.ts` | Serverska tabela zona dostave (ogledalo `src/lib/config.ts`) — LOCK |
| `api/bankart-callback.ts` | HMAC-verified payment notifications — LOCK |
| `api/bankart-order-status.ts` | Bankart status sync — LOCK |
| `api/_shared/payment-status.ts` | Status plaćanja samo napred + provera iznosa — LOCK |
| `api/_shared/telegram.ts` | Telegram poruka: format, claim, slanje — LOCK |
| `src/lib/cartDrawerHelpers.ts` | Pure cart helpers (Phase 1 extracted) |

## Lock zone

| Fajl | Razlog |
|------|--------|
| `src/components/CartDrawer.tsx` | Payment flow, real money transactions |
| `src/components/CartView.tsx` | Cart UI extracted from CartDrawer (G3); promovisan za K–O period (W8 2026-05-23) |
| `src/components/CardFields.tsx` | Bankart card input UI extracted from CartDrawer (G2.2); promovisan za K–O period (W8 2026-05-23) |
| `src/context/CartProvider.tsx` | Cart state machine, regression risk |
| `src/App.tsx` | Router orchestration, hash scroll, admin shell |
| `api/create-order.ts` | Server-side pricing validation (anti-tampering) |
| `api/_shared/order-items.ts` | Row rules + pricing used by create-order |
| `api/_shared/bankart-debit.ts` | Card debit + payment state |
| `api/_shared/delivery-zones.ts` | Delivery fee (real money) |
| `api/bankart-callback.ts` | HMAC verification, payment status updates |
| `api/bankart-order-status.ts` | Bankart status sync, refund detection |
| `api/_shared/payment-status.ts` | Payment status transitions + amount check |
| `api/_shared/telegram.ts` | Telegram notification flow |

**Ovo je jedina lock lista** (B26); STATE.md „Lock zone" je kopija ove tabele.
LOCK = planski rad, STANDARD ili STRICT tier, jači verify, bez usputnih promena.
STRICT `/plan` za lock fajl mora da odgovori i na „šta može napadač sa ručno izmenjenim zahtevom?" (audit 2026-10: happy-path audit ≠ audit napadača).
CartView/CardFields lock je conditional na K–O period; po default-u će se vratiti u regular status posle N3 close.

## Project documentation

| Dokument | Tip | Kad se čita | Cap |
|----------|-----|-------------|-----|
| CONTEXT.md | Projekat istine | Na početku Padrino rada | 100 lines |
| ROADMAP.md | Execution plan | Kad planiraš batch | 600 lines |
| DECISIONS.md | Closed decisions + history | Kad trebaš context | no cap |
| LESSONS.md | Active learning buffer | Kad repetiš grešku | 200 lines, 7 entries max |

> Padrino does not have BIBLE.md — no separate brand/visual document.

## Operational docs (Padrino-specific, not workflow v3)

- `RUNBOOK.md` — production ops (Telegram, Vercel deploy, env)
- `DEPLOYMENT_CHECKLIST.md` — pre-deploy checklist
- `docs/*.md` — audit documents (refund-sync, payment-env, db-schema-baseline, large-files, admin-api-duplication, cartdrawer-extraction, etc.) — treated as authoritative for their topics until migrated.

## Source of truth

1. Trenutni repo kod
2. `workflow/STATE.md` (status)
3. Ovaj CONTEXT.md (projekat istine)
4. `workflow/RULES.md` (univerzalna pravila)
5. `RUNBOOK.md` (Padrino ops)
6. `docs/*.md` (audit history)

Repo > dokumentacija > memorija.
