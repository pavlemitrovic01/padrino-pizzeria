# CONTEXT.md — Padrino Pizzeria

## Projekat

| Polje | Vrednost |
|-------|----------|
| Stack | React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.4 + Tailwind 3.4.19 + Framer Motion 12.29.0 + Vercel |
| Repo | github.com/pavlemitrovic01/padrino-pizzeria, branch: workflow-v3-init |
| Production | https://padrinobudva.com |

## Arhitektura

- Frontend: React 19 + Vite 7 + TypeScript strict + Tailwind utility CSS
- Backend: Vercel Serverless (`api/`) + Supabase Edge Functions (`supabase/functions/`)
- DB: Supabase PostgreSQL + RLS
- Auth: Supabase Auth (admin only)
- Payment: Bankart Payment.js + redirect fallback (HMAC-signed callbacks)
- Notifications: Telegram bot (best-effort, never blocks transaction)
- Rate limiting: Upstash Redis with in-memory fallback
- Testing: Vitest (3 test files in `src/lib/`)
- Deploy: Vercel (production: padrinobudva.com)
- Security headers: vercel.json (HSTS, X-Content-Type-Options, Permissions-Policy)

## Ključni fajlovi

| Fajl | Uloga |
|------|-------|
| `src/main.tsx` | Entry, ErrorBoundary, monitoring init |
| `src/App.tsx` | Router, mode orchestration, lazy sections — LOCK |
| `src/components/CartDrawer.tsx` | Checkout flow + payment — LOCK |
| `src/context/CartProvider.tsx` | Cart state machine — LOCK |
| `src/sections/Menu.tsx` | Menu display + add to cart |
| `api/create-order.ts` | Server-side pricing validation, order DB write — LOCK |
| `api/bankart-callback.ts` | HMAC-verified payment notifications — LOCK |
| `api/bankart-order-status.ts` | Bankart status sync — LOCK |
| `api/telegram-new-order.ts` | Telegram notification dispatch — LOCK |
| `api/_shared/*` | Shared backend utilities (env, cors, admin-auth, supabase-admin, bankart-signature) — LOCK |
| `src/hooks/useBankartPaymentJsInit.ts` | Payment.js controller — LOCK |
| `src/hooks/useDeliveryZone.ts` | Zone selection state — LOCK |
| `src/lib/cartDrawerHelpers.ts` | Pure cart helpers (Phase 1 extracted) |

## Lock zone

| Fajl | Razlog |
|------|--------|
| `src/components/CartDrawer.tsx` | Payment flow, real money transactions |
| `src/context/CartProvider.tsx` | Cart state machine, regression risk |
| `src/App.tsx` | Router orchestration, hash scroll, admin shell |
| `api/create-order.ts` | Server-side pricing validation (anti-tampering) |
| `api/bankart-callback.ts` | HMAC verification, payment status updates |
| `api/bankart-order-status.ts` | Bankart status sync, refund detection |
| `api/telegram-new-order.ts` | Telegram notification flow |
| `api/_shared/*` | Shared contracts (signature change breaks 14 files) |
| `src/hooks/useBankartPaymentJsInit.ts` | Payment.js init lifecycle |
| `src/hooks/useDeliveryZone.ts` | Zone selection state |

LOCK = planski rad, STANDARD ili STRICT tier, jači verify, bez usputnih promena.

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
