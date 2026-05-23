# ROADMAP.md — Padrino Pizzeria

## Current Phase

**Refactor-to-9 program — Faze A–J COMPLETED ✓ (J1 done; J2 deferred per strategy).**
J1 DONE 2026-05-22 (doc-only): TEMPLATE.md NEW 246 LOC + .env.example ALLOWED_ORIGINS drift fix.
Exit criterion #8 CLOSED. Self-score for Refactor-to-9: **8.5/10**
(9.0 je claim tek kad J2 uspešno klonira app#2).

**Sledeći program: Friction-reduction (Faze K–O)** — vidi sekciju ispod.
UX audit 2026-05-22 (mobile screenshots + analytics 28-day pull) →
mobile-first conversion friction reduction, NOT redesign.
**Faza K DONE ✓ (K1 GA4 events, 2026-05-23). Faza L IN PROGRESS — L1+L3 DONE 2026-05-23, L4 sledeći (STRICT, CartView lock zone). L2 (STRICT) defer-uje dok se Payment.js env ne uključi (lokalno + prod).**

Authoritative batch count + status: STATE.md.

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

## Faza G — DONE ✓ (CartDrawer rebuild — STRICT, behind E4 net)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| G1 | Extract `CheckoutForm` (customer fields + validation) | STRICT | 2-3h | **DONE 2026-05-20 (SHA 12574ce).** Lock zone. Browser smoke live checkout each step. |
| G2 | Extract `PaymentSection` (Bankart PaymentJS lifecycle) | STRICT | 3-4h | **DONE 2026-05-20.** G2.1 BillingFields (SHA 453c9a7, 7 props) + G2.2 CardFields (SHA 8ecd75d, 20 props). PaymentSection fully extracted. Init useEffect + tokenize stay in CartDrawer (deferred per recon §4). |
| G3 | Extract `CartView` (item list / qty) | STRICT | 2h | **DONE 2026-05-20 (SHA d2ae678).** Lock zone. CartView.tsx NEW 362 LOC, 26 props; CartDrawer net −319 LOC → 1848 LOC (ROADMAP stale "1612" korigovana G4.0). |
| G4.0 | CartDrawer structural recon | STRICT | — | **DONE 2026-05-20 (SHA 7c42e40).** No code change. Inventoried 1848 LOC, proposed G4.1..G4.6 split. Drift fix (stale LOC note). Full split + risks in DECISIONS 2026-05-20. |
| G4.1 | Extract `src/lib/bankartReturnStorage.ts` (helpers, types) | STRICT | 30min | **DONE 2026-05-20 (SHA f5cd267, merge 666fe4b).** 3 fajla, +145/−132 LOC; bankartReturnStorage.ts NEW 133 LOC (11 exports); CartDrawer.tsx LOCK 1848→1730 (net −118, favorable variance); CartDrawerSuccessView.tsx dedup BankartOrderPaymentStatus (F4.2 pattern); byte-identical relocation; Vercel Build Logs clean + smoke PASS. |
| G4.2 | Extract `useCheckoutForm` | STRICT | 1h | **DONE 2026-05-20 (SHA 98bb4ab, merge 49a533b).** 2 fajla, +417/−251 LOC; useCheckoutForm.ts NEW 352 LOC (11 input params → 30 returns); CartDrawer.tsx LOCK 1729→1543 (net −186, 13 LOC above predicted ceiling — verbose destructure block, cosmetic); supabase defaults loader effect + 12 errors + 11 shouldValidate flags all moved; first src/hooks/cart/ module; Vercel Build Logs clean + smoke PASS. |
| G4.3 | Extract `useDeliveryZone` | STRICT | 1h | **DONE 2026-05-21 (SHA 8e35c58).** 2 fajla, +177/−103 LOC; useDeliveryZone.ts NEW 158 LOC (16 returns: zone state + 6 useMemos + click-outside + reset effects); CartDrawer.tsx LOCK 1543→1459 (net −84); Vercel Build Logs clean + smoke PASS. |
| G4.4 | Extract `useBankartPaymentJs` | STRICT | 1-2h | **DONE 2026-05-21 (SHA 20a05f0).** 2 fajla, +222/−167 LOC; useBankartPaymentJs.ts NEW 204 LOC (7 returns + 3 constants exports); CartDrawer.tsx LOCK 1459→1310 (net −149, recon predicted ~−150); init useEffect 117 LOC byte-identical relocation; Bankart test-mode card transaction PASS; Opus pre-execution audit corrected 3 plan points. |
| G4.5 | Extract `useSuccessState` (Bankart return) | STRICT | 1-2h | **DONE 2026-05-21 (SHA b7d989d).** 2 fajla, +356/−276 LOC; useSuccessState.ts NEW 334 LOC (16 returns: 9 state + 3 setters + 4 actions); CartDrawer.tsx LOCK 1310→1056 (net −254, recon target ~−255 hit on the nose); applySuccessUiState 62 LOC + Bankart return useEffect 109 LOC byte-identical relocation; Bankart card_redirect → return → paid polling smoke PASS. |
| G4.6 | Extract `useCatalogData` + `CheckoutView` | STRICT | 2-3h | **DONE 2026-05-21 (SHA 17025f4).** 3 fajla, +700/−448; useCatalogData.ts NEW 136 LOC (4 catalog state slots + sauceIdSet/setPizzaSizeSafe/addDrinkToCart, exports PizzaVariantsMap, useCart() interno, onErrorRef pattern); CheckoutView.tsx NEW 429 LOC (~40 props, flat per konvencija, deliveryZoneKey: DeliveryZoneKey|""); CartDrawer.tsx LOCK 946→688 (net −258); Vercel Build Logs clean + full golden-path smoke PASS. |

## Faza H — DONE ✓ (Admin monoliths)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| H1 | AdminOrders split (table/detail/export/grouping → lib) | STANDARD | 2-3h | **DONE 2026-05-21 (SHA 916e017).** NEW src/lib/adminOrdersLib.ts 565 LOC (28 helpers + 3 API fns + 7 types); AdminOrders.tsx 1165→637 LOC. |
| H2 | AdminMenu split (editor/image-upload/list) | STANDARD | 2-3h | **DONE 2026-05-22 (SHA 0c96ced).** NEW src/lib/adminMenuLib.ts 449 LOC (types/helpers/API fns); AdminMenu.tsx 1353→939 LOC. Note: 939 LOC iznad exit-kriterijuma #1 (800); H2.1 komponentno splitting needed. |
| H2.1 | AdminMenu component split (MenuItemList + MenuEditorPanel) | STRICT | 1h | **DONE 2026-05-22 (SHA a379a06, merge 643dea7).** NEW MenuItemList.tsx 179 LOC + MenuEditorPanel.tsx 372 LOC; AdminMenu.tsx 939→548 LOC. Exit criterion #1 CLOSED for AdminMenu. |

## Faza I — DONE ✓ (Security + observability → 9)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| I1 | F2 RLS — admin_users membership policy | STRICT | 1-2h | **DONE 2026-05-21 (SHA 88c3967).** DROP 3 allow_admin_*_by_email policies + CREATE allow_self_read on admin_users + CREATE 3 EXISTS-based membership policies on orders. Live verification PASS + admin smoke PASS. pavlemitrovic01@gmail.com out of DB. |
| I2 | CORS allowlist — LOCK handlers (env-driven origins) | STRICT | 1.5h | **DONE 2026-05-21 (SHA 5b0ff6c).** Scope corrected 2026-05-21 /plan: same antipattern in 11 handlers, split into I2 (LOCK 3) + I2.1 (admin 8). NEW api/_shared/cors.ts + cors.test.ts. Migrated create-order.ts, bankart-order-status.ts, telegram-new-order.ts. |
| I2.1 | CORS allowlist — admin handlers migration | STANDARD | 1h | **DONE 2026-05-21 (SHA 3979261).** Reuse api/_shared/cors.ts (from I2). Migrated 8 admin handlers; allowHeaders includes authorization (Bearer token). CORS allowlist coverage complete: all 11 handlers. |
| I2.2 | Hobby plan slot reclaim — consolidate admin handlers | STRICT | 1h | **DONE 2026-05-21 (SHA 5b9d716).** Vercel Hobby limit 12 functions hit (I3 pushed to 13). admin-menu-image→admin-menu (?op=image) + admin-resend-telegram→admin-orders (?op=resend-telegram). Count: 13→10. L8 added. |
| I3 | Logger server sink (`api/log`) | STANDARD | 2h | **DONE 2026-05-21 (SHA 8f9a0a8).** NEW api/log.ts; error-level events fire-and-forget to Vercel Runtime Logs via console.error; no DB, no auth; localStorage ring buffer unchanged. |
| I4 | Build SHA in monitoring init | LEAN | 30min | **DONE 2026-05-21 (SHA da8145b).** VERCEL_GIT_COMMIT_SHA → Vite define → VITE_BUILD_SHA → initClientMonitoring version. Exit criteria #5 closed. |

## Upcoming — Faza J (Template crystallization)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| J1 | `TEMPLATE.md` + canonical env manifest | STANDARD | 2h | **DONE 2026-05-22 (doc-only).** TEMPLATE.md NEW 246 LOC; .env.example ALLOWED_ORIGINS added; 26 env vars grep-verified; exit criterion #8 CLOSED. |
| J2 | Extract true shared template | deferred | — | Only AFTER app#2 exists. Template = what Padrino + app#2 actually share. Do NOT pre-abstract. |

---

# Friction-reduction program (Faze K–O) — UX/conversion

UX audit 2026-05-22 (mobile screenshots + analytics 28-day pull) findings:
- 379 active users / 28 dana, 1m03s avg engagement (zdrav baseline)
- 11 `gateway.bankart.si` return sessions (payment se koristi, conversion postoji)
- `add_to_cart` GA4 event = 0 → tracking broken
- Multi-lang traffic (EN/DE/NL/FR/TR) — turisti dominantno; chatgpt.com referral 12 (LLM-driven discovery)
- Mobile UX prioritetno (~80% pizzeria traffic procena)
- Bankart iframe-i = crne kutije bez vidljivih border-a/placeholder-a (#1 conversion friction)

**Strategic decision (2026-05-23): friction reduction, NOT redesign.**
Sajt na kraju K–O izgleda 80% isto (chef hat logo, dark+yellow paleta,
postojeće pizza fotke, about story sa Godfather posterom u lokalu,
kontakt struktura). Promene su targeted UX friction tačke + brand-coherent
copy + instrumentation. **NE pravimo:** novi design system, nove fotosesije
kao K obavezu, novu paletu, dvojezičnost (postoji već kroz multi-lang SEO).
Lock zone (CartDrawer, CardFields, CartView, CartProvider, App.tsx, api/*)
tretira se istom STRICT disciplinom kao u Refactor-to-9. CardFields.tsx
i CartView.tsx promovisani u lock zone za K–O period (real money path UI).

## Exit criteria for "K–O done" (falsifiable)

Hard (mehanički proverljivo):
1. GA4 `add_to_cart` event > 0 u 7-dnevnom prozoru posle K1 deploy.
2. Bankart iframe polja imaju vidljiv border + placeholder text (DOM-inspectable).
3. Mobile cart editor — sticky bottom ne preklapa addons (visual proof).
4. Hero/landing copy NE sadrži reč "Premium"/"premium" (grep clean).
5. Zona dostave UI = chip selection, NE `<select>` element (DOM).
6. Checkout header se menja po step-u (3 različita string-a, ne fiksno "Plaćanje").
7. Bankart sekcija sadrži ≤ 1 trust messaging block (grep).
8. Hamburger menu overlay covers logo at higher z-index (no provirivanje).
9. Lock zone integrity preserved (CartDrawer/CardFields/CartView/CartProvider/App.tsx/api/*).

Soft (post-deploy, 14-day window):
- Add-to-cart rate > 0 (baseline je sad 0 zbog GA4 bug-a; treba bilo koji broj > 0 da potvrdi tracking radi)
- Avg engagement ≥ 1m03s (no regression)
- gateway.bankart.si return ≥ trenutnih 11/28dan (no payment regression)

Self-score target: **8.0/10 UX** (mobile-focus). 9.0 NIJE meta — to bi
tražilo nove fotke + brand identity work koji ovaj program eksplicitno
isključuje.

## Faza K — DONE ✓ (Instrumentation prerequisite)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| K1 | GA4 enhanced ecommerce events (`add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`) | STRICT | 2-3h | **DONE 2026-05-23 (SHA f2047cb).** Tier upgraded STANDARD→STRICT (2 lock-zone fajla). analytics.ts: Ga4CartItem type + 5 ecommerce helpera. CartProvider LOCK: add_to_cart/remove_from_cart/add_payment_info. CartDrawer LOCK: begin_checkout + totalCents pass. useSuccessState: hasFiredPurchaseRef dedup + purchase (cash+card). GA4 DebugView smoke PASS. |

## Faza L — Mobile friction critical (lock-zone heavy)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| L1 | Hamburger menu z-index fix (logo provirivanje) | LEAN | 30min | **DONE 2026-05-23 (SHA 3a5dfe0).** Navbar.tsx single file; mobile dropdown wrapper `relative z-[60]` iznad logo z-[55] + logo conditional `opacity-0 pointer-events-none` kad mobileOpen=true (md:opacity-100 preserves desktop); transition-opacity 200ms + aria-hidden. DevTools mobile view + real phone smoke PASS. |
| L2 | Bankart iframe styling (light bg, jasne border, focus state, font-size 16px iOS no-zoom) | STRICT | 3-4h | Lock zone: CardFields.tsx, CartDrawer.tsx. Bankart Payment.js `style` config override. Full test-mode card transaction smoke required. **#1 conversion priority.** |
| L3 | Trust messaging reduction (3→1 blocks) | LEAN | 1h | **DONE 2026-05-23 (SHA a2bbfea).** CardFields.tsx -8 LOC; Block 1 verbose "Sigurna Bankart polja"+3-variant dynamic subtitle+emerald badge → single row "🔒 Plaćanje kroz Bankart — sigurno i šifrovano" + inline VISA/Mastercard/Maestro pills (style-mirror from Footer PAYMENT_BADGES, NO logo SVGs exist); Block 2 "Secure entry" micro-label removed; Block 3 bottom pills removed; payment logic LOCKED. DevTools mobile view smoke PASS. Note: paymentJsRequested=false lokalno (VITE_BANKART_PAYMENTJS_ENABLED/PUBLIC_KEY not set) → redirect flow; copy honest u oba flow-a. |
| L4 | Cart item editor mobile compact | STRICT | 4-6h | Lock zone: CartView.tsx, CartDrawer.tsx. Briši duplicate "Ukupno: X €" pill, "Nazad na meni" button, smanji header height, X color sivo umesto crveno. Target: sticky bottom ne preklapa addons. |
| L5 | Checkout step indicator + header renaming (1. Korpa → 2. Dostava → 3. Plaćanje) | STRICT | 4-6h | Lock zone: CheckoutView.tsx, CartDrawer.tsx. Header dinamičan po step state-u; breadcrumb na vrhu. |
| L6 | Zona dostave chips + "Pozovi +382" demote | STANDARD | 2-3h | CheckoutView.tsx. `<select>` → chip array koristeci DELIVERY_ZONES iz src/lib/config. "Pozovi" sa žute CTA → tekstualni link "Nemaš zonu? Pozovi nas →". |

## Faza M — Brand & copy alignment

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| M1 | Hero/SEO copy rewrite — "Premium" out, "PIZZA · BUDVA · DOSTAVA" hero, porodična brand pull | STRICT | 2-3h | App.tsx LOCK + index.html meta + OG tags. **Locked copy (Pavle 2026-05-23):** Pill = "PIZZA · BUDVA · DOSTAVA"; H1 = "PADRINO PIZZERIA" (netaknut); Sub = "Sveže pečena pizza, brza dostava u Budvi i okolini. Porodični recepti od 2021, ljubav na svaki zalogaj." SEO targets: `pizza budva` + `dostava` + `pizzeria budva` + tourist EN intent retained via meta description. Pre-execution grep: ukloniti SVE "premium"/"Premium" pojave iz src/ + index.html + meta tags. DECISIONS entry sa rationale ulazi u M1 /plan. |
| M2 | "Vidi sliku" touch behavior + menu drawer header compact | STANDARD | 2-3h | Menu.tsx / sections/Menu.tsx: hover-only overlay na touch device → tap-to-zoom ili stalno vidljivo bez "Vidi sliku" texta. Menu drawer: smaller pill+header, "Idi na korpu" CTA u sticky bottom umesto centriranog. |

## Faza N — Conversion engine (data-informed, post-L+M baseline)

| ID | Naslov | Tier | Estimate | Notes |
|----|--------|------|----------|-------|
| N1 | Filter chips za menu (vegetarijanske / picante / calzone / svi) | STANDARD | 3-4h | Menu.tsx + sections/Menu.tsx. Static taxonomy iz config; postoji li `category` field u menu_items DB schemi? Verovatno ne — treba B-side mapping iz adminMenuLib ili cartDrawerHelpers. Provjeri pre /plan. |
| N2 | Signature pizza highlight (Margherita "Klasik" + Padrino brand pizza) | STANDARD | 2-3h | Visual badge na 2 kartice; "Najprodavanije" / "Naš signature". Statički markup u Menu.tsx, ne admin-driven (zasad). |
| N3 | Krofne/Piće kao "Možda još i ovo?" upsell sekcija | STANDARD | 3-4h | CartView.tsx: razdvoj impulse hooks od pizza addons; separate "🎯 Možda još i ovo?" sekcija ispod glavnih addons. Preserve postojeću marketing strategiju (intentional Pavle decision), samo vizuelno jasnije. |

## Faza O — Optional, data-triggered

Pre-empty intentionally. Triggered by N-end measurement reading 14 dana
posle N3 deploy. Mogući kandidati: search za menu, OG image audit,
bundle audit (lazy-load Supabase za public landing), secret rotation
kadenc u RUNBOOK, mobile retention probe. Cap: 3 batch-a max.

## K–O strategic notes

- **Mobile-first**: ~80% pizzeria traffic procena. Svaki L batch koji menja layout mora prvo verifikovati mobile (Pavlov telefon), pa desktop.
- **Bankart smoke je gate za L2**: bez real test-mode card transaction (Pavle) ne mergujemo L2 u main.
- **L paralelizacija**: L1 + L3 mogu paralelno (LEAN, ne dotiču isti fajl). L2/L4/L5 sekvencijalno (svi dotiču CartDrawer lock zone, jedan po jedan).
- **K1 paralelno sa L mogućno**: GA4 changes u CartProvider/main su tracking-only, ne blokiraju UI work. Ali poželjno da K1 stoji bar 3-4 dana pre nego što L promene UI (želimo bar parcijalni baseline).
- **M1 = Pavle copy approval already locked** (2026-05-23): kombinacija je u M1 row notes; DECISIONS entry sa rationale ulazi u M1 /plan.
- **N je conditional**: ne planirati N batch-eve pre L+M close-a. N pretpostavlja baseline iz K1 → ako add-to-cart rate ne uplift posle L+M deploy-a, prvo `/audit` zašto, ne preskočiti N.
- **"premium" grep mandatory pre M1 close**: src/, index.html, meta tags, OG tags, vercel.json — sve mora biti clean.

---

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
