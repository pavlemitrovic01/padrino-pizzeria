# ROADMAP.md — Padrino Pizzeria

## Current Phase

**Refactor-to-9 program — Faza G (CartDrawer rebuild) IN PROGRESS.** Faze
A–F DONE; G1 DONE 2026-05-20; G2 DONE 2026-05-20 (G2.1 BillingFields SHA
453c9a7 + G2.2 CardFields SHA 8ecd75d — PaymentSection fully extracted).
Next: G3 Extract CartView (STRICT). Authoritative batch count + status: STATE.md.

Faze A–E DONE (Stabilization, Critical fixes, Cleanup, Architectural
decisions, Safety net — see STATE.md / LOG.md for the authoritative
batch count; not hardcoded here to avoid drift). Project audited
2026-05-17: **7.0/10**. Goal: reach **9.0/10** AND turn Padrino into a
clean reference repo for future ordering/payment apps.

**Strategic decision (2026-05-17): refactor, NOT rewrite.** Server-side
price validation verified correct (`create-order.ts:1037-1142`), HMAC
timing-safe + skew-bounded, critical RLS closed (B14.1). The hard and
dangerous core is done and proven; the real debt is 4 monolith files +
util duplication — a refactor target, not a rewrite trigger. A rewrite
would re-pay every LESSON (L2/L4/L6) and re-discover production
hardening with real money and no safety net. The true shared template
crystallizes from cleaned-Padrino + app#2 — not from premature
abstraction (deferred to Faza J).

Pre-W0 history: 9 closed batches (B1-B9) under old workflow.
See `DECISIONS.md` "Phase History" for full record.

## Faza A — DONE ✓ (Stabilization & Audit)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B1 | Lint fix (3 React Hooks errors) | LEAN | 30min | DONE 2026-05-11 (no-op) |
| B2 | Delivery fee audit (read-only DB query) | STRICT | 30min | DONE 2026-05-11 — see docs/delivery-fee-audit.md |
| B3 | Schema baseline (`supabase db pull`) | STRICT | 30min | DONE 2026-05-11 — see supabase/migrations/20260510230628_remote_schema.sql |
| B3.5 | Telegram flow doc correction | LEAN | 15min | DONE 2026-05-11 — RUNBOOK §1 + §1.1 + DECISIONS append |
| B4 | Kritični testovi (HMAC + CAS + Bankart callback) | STANDARD | 2h | Additive tests only |

## Faza B — DONE ✓ (Critical fixes)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B5 | Delivery fee fix | STRICT | 2h | CONDITIONAL on B2 finding bug; B2 audit found no production bug — likely won't execute |
| B11 | Bankart raw error sanitization | STANDARD | 30min | Security smell |
| B15 | Telegram DB trigger DROP | LEAN | 15min | Single `DROP TRIGGER` migration; trigger is dead (Vercel Protection 401, see DECISIONS 2026-05-11 B3.5 entry) |
| B16 | CAS atomicity fix in admin-update-order-status.ts | STRICT | 30min | From audit 2026-05-11 D4: read-then-write race; add `.eq("status", fromStatus)` guard + 409 conflict response |

## Faza C — DONE ✓ (Cleanup & Consolidation)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B6 | CartProvider duplikati → cartDrawerHelpers | STANDARD | 30min | 5 functions duplicated; cartDrawerHelpers.ts exists |
| B7 | Menu.tsx NAME_TO_FILE cleanup | STANDARD | 20min | Two sources of truth (Menu.tsx + cartDrawerHelpers.ts) |
| B8 | CREATE api/_shared/ with resolvePublicBaseUrl + telegram helpers | STRICT | ~1.5-2h | DEFERRED to Phase D — design LOCKED in DECISIONS 2026-05-16. resolvePublicBaseUrl has intentional bankart-callback divergence (NO Origin branch, security). Execute only as STRICT w/ trustOriginHeader param + ReqLike/getEnv unification. Phase C continues B9. |
| B9 | AuthProvider removal | LEAN | 30min | Audit confirms useAuth() not called anywhere; safe-remove from main.tsx + delete src/auth/AuthProvider.tsx |
| B10 | CREATE api/_shared/admin-auth.ts; consolidate getAdminFromDb | STANDARD | 1h | 8+ inline copies across api handlers (admin-orders, admin-menu, admin-settings, etc.) |
| B13 | Mrtvi fajlovi cleanup | LEAN | 15min | Audit 2026-05-11: padrinoo.txt and tsbuildinfo absent; verify scope on /plan — likely near-no-op |
| B10.1 | isAdminEmailDb dedup → api/_shared/admin-auth | STANDARD | 30min | Follow-up to B10 (identified during B10 exec). isAdminEmailDb inline-duplicated in admin-orders.ts, admin-update-order-status.ts, admin-resend-telegram.ts; consolidate into existing api/_shared/admin-auth.ts. `.js` import per L6. |

## Faza D — DONE ✓ (Architectural decisions)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| B12 | Edge functions dedup decision | STRICT | 1-2h | admin-orders + telegram-new-order |
| B14 | Security audit: RLS hardcoded email + admin_users RLS | STRICT | ~2h | From B3 schema baseline finding; supersedes old B14 (CartDrawer Phase 3 — moved to Long-term) |

---

# Refactor-to-9 program (Faze E–J)

Audit 2026-05-17: **7.0/10 → target 9.0/10**, template-grade.
Order logic: **safety net first, then climb.** No payment-system
refactor without tests as the net. Each batch reversible + gated.

**Estimate column = human hand-coding reference ONLY.** With agentic
execution coding time ≈ 0; the real wall clock is the STRICT gate loop:
per-batch branch → Vercel preview deploy → Build Logs check (L6) →
Pavle manual browser/Bankart smoke (preview tool cannot render this
app) → /close. Fast-track (E/F/H/I/J — additive, non-lock-zone): a few
focused sessions. **Faza G (4 STRICT payment-UI batches) is the real
clock** — bounded by N manual Bankart test-mode checkouts + deploy
round-trips, NOT by coding speed. Rushing G without that verification
discards the exact safety this plan exists for.

## Exit criteria for "real 9.0/10" (falsifiable — not a vibe)

9.0 is NOT "E–J closed". It is ALL of:
1. No source file > 800 LOC (CartDrawer / AdminMenu / AdminOrders / create-order all split).
2. E1 hostile price-tamper test GREEN (server rejects/recomputes — proven, not assumed).
3. E5 golden-path E2E GREEN (cart → create-order → redirect URL returned).
4. F2 RLS closed (admin_users membership policy; no hardcoded personal email).
5. Build SHA visible in production monitoring (I4).
6. Logger flushes error-level to server sink (I3), not localStorage-only.
7. Zero `any`/`@ts-ignore`; lint + typecheck + test + build all green.
8. `TEMPLATE.md` exists with canonical env manifest (J1).

Conditional last 0.5: a "9/10 TEMPLATE" is a CLAIM until app#2 is
successfully cloned from cleaned-Padrino (J2). Until then max honest
self-score = **8.5** even with 1–8 all met.

## Faza E — DONE ✓ (Safety net — was PREREQ for everything)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| E1 | create-order endpoint hostile-input test | STANDARD | 1-2h | **DONE 2026-05-17.** #1 audit gap. Tampered price rejected, total mismatch, invalid items. Cheapest, highest ROI. Proves the price-validation defense I verified at create-order.ts:1037-1142. |
| E2 | Bankart callback integration test | STANDARD | 2h | **DONE 2026-05-17.** Duplicate-callback idempotency, paid→paid no double-notify, ERROR path → cancelled. Covers payment→DB flow (currently 0 tests). |
| E3 | Refund flow test | STANDARD | 1-2h | **DONE 2026-05-17.** Refund init + REFUND/CHARGEBACK callback handling. Currently zero. Covers test side of long-term refund-sync item. |
| E4 | DOM test harness + CartDrawer characterization | STRICT | 2-3h | **DONE 2026-05-18.** **Prereq not in stack:** add jsdom + @testing-library/react (no component-test infra exists today). Then capture CartDrawer render/submit behavior per cart state BEFORE Faza G split. Honest: this is the weakest net — partly substituted by E2/E5 + manual smoke. |
| E5 | Golden-path E2E (cart → create-order → redirect) | STANDARD | 2-3h | **DONE 2026-05-18.** Drives cart add → checkout submit → asserts create-order returns valid redirect URL. Stops at Bankart hosted-page boundary (external gateway not driven). The real net for Faza G. Exit-criteria #3. |

## Faza F — DONE ✓ (Shared core — template foundation, low risk)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| F1 | `src/lib/parsing.ts` consolidation | STANDARD | ~1.5h | **DONE 2026-05-18 (SHA f4c677f).** **parsing.ts owns ONLY: isRecord, isPlainObject, safeString, normalizeText** — verified byte-identical across dup sites (true no-op). **`safeInt` EXCLUDED from parsing.ts**: ≥3 divergent semantics exist; canonical = `src/lib/money.ts toSafeInt` (`Number()`-coercion, money-path-trusted). createOrder.ts:76 / AdminOrders.tsx:64 already delegate to it — leave untouched. AdminDashboard.tsx:32 inline copy (same semantics) → `import { toSafeInt } from money`. `publicBusinessSettings.ts:47 toSafeInt` (`number\|null`, no fallback) = different contract → OUT of F1. **Scope: `src/` non-lock-zone ONLY** (~10 files: AdminDashboard, AdminOrders, AdminMenu, AdminLogin, AdminSettings, AdminUsers, sections/Menu.tsx, lib/createOrder.ts [isRecord only], lib/publicBusinessSettings.ts [isRecord only], lib/cartDrawerHelpers.ts). Does NOT touch lock zone or `api/**`. Scope corrected + safeInt money-path landmine flagged W4 2026-05-18 (grep+body recon: ~25 dup-def sites, safeInt non-uniform across money path). |
| F1.1 | `src/App.tsx` isRecord dedup (lock zone) | STRICT | 30min | **DONE 2026-05-18 (SHA 2548568).** 1 dup (`App.tsx:256`) → import from `src/lib/parsing.ts`. App.tsx is lock zone → STRICT + explicit Pavle approval. Standalone or folded into another App.tsx-touching batch. Split out of F1 by W4 2026-05-18. |
| F2 | `src/lib/zones.ts` extraction | STRICT | 2h | **WON'T EXECUTE 2026-05-19 (W7).** B2 audit (docs/delivery-fee-audit.md, 2026-05-11) confirmed `delivery_zones` table absent in prod DB and GPS polygon path architecturally dead (client never sends lat/lng → `fetchZones()` never called). Extracting dead lock-zone code violates "refactor not rewrite" strategy. Target `src/lib/zones.ts` also invalid for api code per L6. Analogous to B5 (CONDITIONAL on B2, won't-execute). Detail: DECISIONS 2026-05-19. Client `DELIVERY_ZONES` may fold into F4 (Config seam) if/when F4 executes. |
| F3 | `api/_shared/` reusable surface formalization | STRICT | 2h | **DONE 2026-05-19 (SHA bf5d2e8).** Continue B8/B10 line — payment/admin shared modules as the template seam. **Includes `api/_shared/parsing.ts`**: ~10 `api/**` files (incl. 4 lock-zone: create-order, bankart-callback, bankart-order-status, telegram-new-order) with isPlainObject/safeInt/normalizeText dup. Separate build context from `src/` (Vercel serverless vs Vite) — own shared module required. L6 `.js` extension mandatory. Scope clarified W4 2026-05-18. `supabase/functions/payments-create-session/index.ts` (Deno) out of scope — consistent with B12 edge-function decision. |
| F4 | Config seam module | STANDARD | 1-2h | **DONE 2026-05-19 (SHA 2fdff83).** Padrino-specifics (fallback email/city/postcode, domain, Telegram) → one config module = explicit template swap point. api/ side complete; F4.1 (STRICT) covers src/ side mirror (DELIVERY_ZONES, SEO URLs). |
| F4.1 | `src/` Config seam mirror | STRICT | 1-2h | **DONE 2026-05-19 (SHA efa313e).** Src/ side of F4. DELIVERY_ZONES const (CartDrawer.tsx LOCK) + SEO URL literals (App.tsx LOCK, adminApiBase.ts, PizzaBudvaPage.tsx) → src/lib/config.ts. DELIVERY_ZONES byte-identical 8/8. Both template-swap points (api/ + src/) now complete. |

## Faza G — IN PROGRESS (CartDrawer rebuild — STRICT, behind E4 net)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| G1 | Extract `CheckoutForm` (customer fields + validation) | STRICT | 2-3h | **DONE 2026-05-20 (SHA 12574ce).** Lock zone. Browser smoke live checkout each step. |
| G2 | Extract `PaymentSection` (Bankart PaymentJS lifecycle) | STRICT | 3-4h | **DONE 2026-05-20.** G2.1 BillingFields (SHA 453c9a7, 7 props) + G2.2 CardFields (SHA 8ecd75d, 20 props). PaymentSection fully extracted. Init useEffect + tokenize stay in CartDrawer (deferred per recon §4). |
| G3 | Extract `CartView` (item list / qty) | STRICT | 2h | Lock zone. |
| G4 | CartDrawer → thin orchestrator (~300 LOC) | STRICT | 2h | Final assembly; full checkout smoke. |

## Upcoming — Faza H (Admin monoliths)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| H1 | AdminOrders split (table/detail/export/grouping → lib) | STANDARD | 2-3h | 1193 LOC; reuses F1 parsing lib. |
| H2 | AdminMenu split (editor/image-upload/list) | STANDARD | 2-3h | 1368 LOC. |

## Upcoming — Faza I (Security + observability → 9)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| I1 | F2 RLS — admin_users membership policy | STRICT | 1-2h | Kill hardcoded email (Option A, docs/rls-security-audit.md). Schema migration + live verify. Template win: no personal email baked in. |
| I2 | CORS allowlist (env-driven origins) | STANDARD | 1h | Replace reflect-any-origin in create-order.ts setCors. |
| I3 | Logger server sink (`api/log`) | STANDARD | 2h | Flush error-level ring buffer to server. Supersedes long-term "Logger server endpoint". |
| I4 | Build SHA in monitoring init | LEAN | 30min | git SHA for prod debug. Supersedes long-term "Build version SHA". |

## Upcoming — Faza J (Template crystallization)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| J1 | `TEMPLATE.md` + canonical env manifest | STANDARD | 2h | Reusable vs project-specific map; clone-and-adapt guide. Doc-only. |
| J2 | Extract true shared template | deferred | — | Only AFTER app#2 exists. Template = what Padrino + app#2 actually share. Do NOT pre-abstract. |

## Long-term (no estimate)

- **Refund sync verification (operational)** — kod popravljen (commit ed51537); E3 pokriva test stranu. Ostaje operativna potvrda na realan refund event u produkciji. Ne blokira roadmap.
- **Backend ESLint env precision** — `api/**` JESTE pokriven eslint-om (`eslint.config.js` ignoriše samo `dist`, `files: **/*.{ts,tsx}`; potvrđeno B10/L6). Rezidual: `languageOptions.globals` = `globals.browser` se primenjuje i na Node `api/**` (nema node-globals blok) — bezopasno (typescript-eslint gasi `no-undef`, TS tipizira `process`/`Buffer` preko @types/node), opcioni nice-to-have.

> Superseded into Faze E–J (2026-05-17): CartDrawer Phase 3 + Admin
> splits → Faze G/H; Logger server endpoint → I3; Build version SHA → I4.

## Notes

- B5 is CONDITIONAL on B2. B2 audit (DONE 2026-05-11) found delivery fee flow works correctly via meta-note parsing; no production bug. B5 will not execute.
- F2 (zones.ts extraction) is WON'T-EXECUTE on B2 audit. B2 (DONE 2026-05-11, `docs/delivery-fee-audit.md`) confirmed `delivery_zones` table absent from prod DB and GPS polygon path architecturally dead. Extracting dead lock-zone code violates the refactor-not-rewrite strategy (Current Phase). Closed 2026-05-19 via W7. See DECISIONS 2026-05-19 for full reasoning. Client `DELIVERY_ZONES` const stays in CartDrawer until F4 (Config seam module) — may fold there as a template seam.
- Faze A–D DONE 2026-05-17 (22 batches). Faze E–J = refactor-to-9 program.
- Refactor-NOT-rewrite is a LOCKED strategic decision (2026-05-17): the dangerous core (server price validation, HMAC, RLS) is done + verified; debt is structural (4 monolith files), not foundational. Rationale in Current Phase block.
- Template goal: future projects are similar ordering/payment apps. Faza F builds the reusable seam; Faza J crystallizes the real template only after app#2 (no premature abstraction).
- Old B14+ (CartDrawer Phase 3 + Admin splits) promoted into Faze G/H — no longer a vague long-term deferral.

## Audit 2026-05-11 — Reconciliation log

W2 reconciled this ROADMAP with repo reality:
- Promoted B14 (security audit), B15 (trigger DROP), B16 (CAS atomicity fix — new from audit D4) from STATE "Roadmap additions" into Faza B/D tables.
- Superseded old B14 (CartDrawer Phase 3 + Admin splits) → Long-term.
- Reframed B8/B10 as CREATE api/_shared (directory does NOT exist; B8/B10 establish it).
- Annotated B13 as likely near-no-op (audit found target files absent).
- Marked B1/B2/B3/B3.5 DONE in Faza A.
See `DECISIONS.md` "2026-05-11 — Audit findings" for evidence + Phase History RECORD-UNRELIABLE markings.
