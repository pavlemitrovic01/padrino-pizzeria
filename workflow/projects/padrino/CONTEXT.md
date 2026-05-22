# CONTEXT.md — Padrino Pizzeria

## Projekat

| Polje | Vrednost |
|-------|----------|
| Stack | React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.4 + Tailwind 3.4.19 + Framer Motion 12.29.0 + Vercel |
| Repo | github.com/pavlemitrovic01/padrino-pizzeria, branch: main |
| Production | https://padrinobudva.com |

## Arhitektura

- Frontend: React 19 + Vite 7 + TypeScript strict + Tailwind utility CSS
- Backend: Vercel Serverless (`api/`) + Supabase Edge Functions (`supabase/functions/`)
- DB: Supabase PostgreSQL + RLS
- Auth: Supabase Auth (admin only)
- Payment: Bankart Payment.js + redirect fallback (HMAC-signed callbacks)
- Notifications: Telegram bot (best-effort, never blocks transaction)
- Rate limiting: Upstash Redis with in-memory fallback
- Testing: Vitest (17 test files, 206 tests — covers money path + API _shared + DOM characterization + golden path E2E)
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
| `api/bankart-callback.ts` | HMAC verification, payment status updates |
| `api/bankart-order-status.ts` | Bankart status sync, refund detection |
| `api/telegram-new-order.ts` | Telegram notification flow |

LOCK = planski rad, STANDARD ili STRICT tier, jači verify, bez usputnih promena.
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
