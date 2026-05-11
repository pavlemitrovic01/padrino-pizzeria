# ROADMAP.md — Padrino Pizzeria

## Current Phase

**Phase A — Stabilization & Audit** (post-W0, ready to start)

Pre-W0 history: 9 closed batches (B1-B9) under old workflow.
See `DECISIONS.md` "Phase History" for full record.

## Upcoming — Faza A (Stabilization & Audit)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B1 | Lint fix (3 React Hooks errors) | LEAN | 30min | useBankartPaymentJsInit + useDeliveryZone |
| B2 | Delivery fee audit (read-only DB query) | STRICT | 30min | NO code changes — investigate flow |
| B3 | Schema baseline (`supabase db pull`) | STRICT | 30min + Docker | Disaster recovery insurance |
| B4 | Kritični testovi (HMAC + CAS + Bankart callback) | STANDARD | 2h | Additive tests only |

## Upcoming — Faza B (Critical fixes)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B5 | Delivery fee fix | STRICT | 2h | CONDITIONAL on B2 finding bug |
| B11 | Bankart raw error sanitization | STANDARD | 30min | Security smell |

## Upcoming — Faza C (Cleanup & Consolidation)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B6 | CartProvider duplikati → cartDrawerHelpers | STANDARD | 30min | 5 functions duplicated |
| B7 | Menu.tsx NAME_TO_FILE cleanup | STANDARD | 20min | Two sources of truth |
| B8 | resolvePublicBaseUrl + telegram → api/_shared | STANDARD | 45min | 3-file duplication |
| B9 | AuthProvider verification + uklanjanje | LEAN | 30min | useAuth() not called |
| B10 | getAdminFromDb shared (8 files) | STANDARD | 1h | Inline copies in 8 admin handlers |
| B13 | Mrtvi fajlovi cleanup | LEAN | 15min | padrinoo.txt, deprecated env, tsbuildinfo |

## Upcoming — Faza D (Architectural decisions)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B12 | Edge functions dedup decision | STRICT | 1-2h | admin-orders + telegram-new-order |
| B14+ | CartDrawer Phase 3 + AdminOrders/AdminMenu split | STRICT | TBD | Only if monoliths block real work |

## Long-term (no estimate)

- **Refund sync verification** — kod je popravljen u prethodnoj fazi (commit ed51537), čeka realan refund event u produkciji za operativnu potvrdu. Neće blokirati ostatak roadmap-a.
- **CartDrawer Phase 3** — JSX cart-view i checkout-view extraction (~790 lines remaining). Defer until B1-B13 done and concrete pain.
- **Backend ESLint coverage** — currently `api/**` is in eslint ignore.
- **Logger server endpoint** — current logger writes to localStorage ring buffer only.
- **Build version SHA** — git SHA in monitoring init for production debug.

## Notes

- B5 is CONDITIONAL on B2. If B2 SQL audit shows delivery fee mismatch is silently failing → execute B5. If audit shows flow works differently than code suggests → revise hypothesis, do not fix.
- B14+ is gated on accumulated pain. Don't refactor monoliths preemptively.
- Phase D is provisional. Re-evaluate after Phase C.
