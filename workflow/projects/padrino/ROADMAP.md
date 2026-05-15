# ROADMAP.md — Padrino Pizzeria

## Current Phase

**Phase A — Stabilization & Audit** (post-W0, ready to start)

Pre-W0 history: 9 closed batches (B1-B9) under old workflow.
See `DECISIONS.md` "Phase History" for full record.

## Upcoming — Faza A (Stabilization & Audit)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B1 | Lint fix (3 React Hooks errors) | LEAN | 30min | DONE 2026-05-11 (no-op) |
| B2 | Delivery fee audit (read-only DB query) | STRICT | 30min | DONE 2026-05-11 — see docs/delivery-fee-audit.md |
| B3 | Schema baseline (`supabase db pull`) | STRICT | 30min | DONE 2026-05-11 — see supabase/migrations/20260510230628_remote_schema.sql |
| B3.5 | Telegram flow doc correction | LEAN | 15min | DONE 2026-05-11 — RUNBOOK §1 + §1.1 + DECISIONS append |
| B4 | Kritični testovi (HMAC + CAS + Bankart callback) | STANDARD | 2h | Additive tests only |

## Upcoming — Faza B (Critical fixes)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B5 | Delivery fee fix | STRICT | 2h | CONDITIONAL on B2 finding bug; B2 audit found no production bug — likely won't execute |
| B11 | Bankart raw error sanitization | STANDARD | 30min | Security smell |
| B15 | Telegram DB trigger DROP | LEAN | 15min | Single `DROP TRIGGER` migration; trigger is dead (Vercel Protection 401, see DECISIONS 2026-05-11 B3.5 entry) |
| B16 | CAS atomicity fix in admin-update-order-status.ts | STRICT | 30min | From audit 2026-05-11 D4: read-then-write race; add `.eq("status", fromStatus)` guard + 409 conflict response |

## Upcoming — Faza C (Cleanup & Consolidation)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B6 | CartProvider duplikati → cartDrawerHelpers | STANDARD | 30min | 5 functions duplicated; cartDrawerHelpers.ts exists |
| B7 | Menu.tsx NAME_TO_FILE cleanup | STANDARD | 20min | Two sources of truth (Menu.tsx + cartDrawerHelpers.ts) |
| B8 | CREATE api/_shared/ with resolvePublicBaseUrl + telegram helpers | STRICT | ~1.5-2h | DEFERRED to Phase D — design LOCKED in DECISIONS 2026-05-16. resolvePublicBaseUrl has intentional bankart-callback divergence (NO Origin branch, security). Execute only as STRICT w/ trustOriginHeader param + ReqLike/getEnv unification. Phase C continues B9. |
| B9 | AuthProvider removal | LEAN | 30min | Audit confirms useAuth() not called anywhere; safe-remove from main.tsx + delete src/auth/AuthProvider.tsx |
| B10 | CREATE api/_shared/admin-auth.ts; consolidate getAdminFromDb | STANDARD | 1h | 8+ inline copies across api handlers (admin-orders, admin-menu, admin-settings, etc.) |
| B13 | Mrtvi fajlovi cleanup | LEAN | 15min | Audit 2026-05-11: padrinoo.txt and tsbuildinfo absent; verify scope on /plan — likely near-no-op |

## Upcoming — Faza D (Architectural decisions)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B12 | Edge functions dedup decision | STRICT | 1-2h | admin-orders + telegram-new-order |
| B14 | Security audit: RLS hardcoded email + admin_users RLS | STRICT | ~2h | From B3 schema baseline finding; supersedes old B14 (CartDrawer Phase 3 — moved to Long-term) |

## Long-term (no estimate)

- **Refund sync verification** — kod je popravljen u prethodnoj fazi (commit ed51537), čeka realan refund event u produkciji za operativnu potvrdu. Neće blokirati ostatak roadmap-a.
- **CartDrawer Phase 3 + AdminOrders/AdminMenu split** — JSX cart-view i checkout-view extraction (~790 lines remaining); plus splitting AdminOrders.tsx and AdminMenu.tsx monoliths. Was old B14; deferred per W1/W2 to long-term until concrete blocker. Re-evaluate after Faza B/C complete.
- **Backend ESLint coverage** — currently `api/**` is in eslint ignore.
- **Logger server endpoint** — current logger writes to localStorage ring buffer only.
- **Build version SHA** — git SHA in monitoring init for production debug.

## Notes

- B5 is CONDITIONAL on B2. B2 audit (DONE 2026-05-11) found delivery fee flow works correctly via meta-note parsing; no production bug. B5 likely will not execute.
- Old B14+ (CartDrawer Phase 3) was gated on accumulated pain — now formally deferred to Long-term (W2 reconciliation 2026-05-11). New B14 (security audit) is concrete.
- Phase D is provisional. Re-evaluate after Phase C.

## Audit 2026-05-11 — Reconciliation log

W2 reconciled this ROADMAP with repo reality:
- Promoted B14 (security audit), B15 (trigger DROP), B16 (CAS atomicity fix — new from audit D4) from STATE "Roadmap additions" into Faza B/D tables.
- Superseded old B14 (CartDrawer Phase 3 + Admin splits) → Long-term.
- Reframed B8/B10 as CREATE api/_shared (directory does NOT exist; B8/B10 establish it).
- Annotated B13 as likely near-no-op (audit found target files absent).
- Marked B1/B2/B3/B3.5 DONE in Faza A.
See `DECISIONS.md` "2026-05-11 — Audit findings" for evidence + Phase History RECORD-UNRELIABLE markings.
