# DECISIONS.md — Padrino Pizzeria

> Append-only history. Closed decisions, deprecated lessons, phase
> history. No cap.

---

## 2026-01-10 — Project initiated

First VSCode session. Pavle's first development project ever. Stack: React + TypeScript + Vite + Supabase + Vercel. Bankart for payments (Montenegrin market support).

## 2026-03-05 — First production deploy

padrinobudva.com live. Real customer orders begin processing.

## 2026-03-20 — Closed batches (Phase History)

Old workflow (ChatGPT Plan + Composer Execute pattern, pre-workflow-v3):

| Batch | Scope | Status |
|-------|-------|--------|
| 1 | Config + static cleanup | DONE |
| 2A | API shared helpers extraction (`api/_shared/`) | DONE |
| 2C | CORS whitelist | DONE |
| 3A | `normalizeText` centralizacija | DONE |
| 3B-1 | Unknown primitives (`safeString`, `safeNumberOrNull`) | DONE |
| 3B-2 | Object guards (`isPlainObject`, `isNonNullObject`) | DONE |
| 3B-2b | `publicBusinessSettings` cleanup | DONE |
| 4C | Admin status TOCTOU — atomic update + conflict handling | DONE |
| 4B-core | `create-order` initial status always `"pending"` | DONE |
| 5 | CartProvider + AuthProvider optimization | DONE |
| 9 | Edge / admin / env hardening | CODE-APPROVED, manual verify pending |

Batch 9 still pending manual/post-deploy verification per old CLAUDE.md (as of 2026-03-22 — verify in next batch if needed).

### Batch 9 details (CODE-APPROVED, manual verify pending)

Code changes per old CLAUDE.md (2026-03-22):

- `payments-create-session`: migracija na `Deno.serve`
- `telegram-new-order`: migracija na `Deno.serve` (uklonjen std `serve` import)
- `admin-orders` (edge): uklonjen hardkodovan admin email; provera preko `admin_users`; podrazumevana paginacija (`limit`/`offset`, default limit 50); `isRecord` sa `!Array.isArray`
- `adminApiBase.ts`: podrška za `VITE_ADMIN_API_BASE`; bez automatskog fallback-a na produkcioni domen u dev-u

Pending manual verification:

- Browser: admin UI — lista porudžbina, PATCH/status update
- Posle deploy-a: edge runtime (`payments-create-session`, `telegram-new-order`, `admin-orders`)
- JWT: valid admin / non-admin na deployovanim edge funkcijama

## 2026-03-22 — Local admin login pitfall resolved

Issue: `VITE_ADMIN_API_BASE` not in actual Vite-loaded env file. Symptom: admin-me requests went to `localhost/.../api/admin-me` (relative). Resolution: env must be in `.env.local` or `.env` at app root, restart Vite after changes. Captured as `LESSONS.md` L1.

## 2026-04 — Refund status-path fix (commit ed51537)

Issue: paid orders were hard-skipped from Bankart status refresh, refund events never detected. Fix: status refresh considers paid orders eligible for sync. Operational verification pending real refund event.

## 2026-05-10 — Workflow v3 introduced (W0)

Migrated from ChatGPT/Composer dual-AI pattern to cl3menza-style workflow v3. Imported `workflow/RULES.md` + `.claude/*` in commit f538d40. Generated Padrino-specific STATE/LOG/CONTEXT/ROADMAP/DECISIONS/LESSONS in W0. Refactored CLAUDE.md to bootstrap format. Project moved out of OneDrive to `C:\dev\padrino` prior to W0.

## 2026-05-10 — AuthProvider lock status changed

Old CLAUDE.md (2026-03-22) listed `src/auth/AuthProvider.tsx` as LOCK.
W0 CONTEXT.md does NOT include AuthProvider in the lock list.

Reasoning:
- `useAuth()` is not called anywhere in the codebase (verified during audit phase prior to W0)
- `AuthProvider` wraps `App` in `src/main.tsx` but provides no consumed value
- Roadmap B9 proposes AuthProvider removal as dead code (LEAN tier, ~30min, "useAuth() not called")

If B9 removal does not happen (e.g., audit reveals hidden usage that grep missed), AuthProvider must be re-added to the lock list as it touches Supabase auth subscriptions.

Status: lock removed conditionally pending B9 outcome.

---

## Closed Patterns

Established patterns. Reference for future work:

- **api/_shared/ pattern**: env, headers, numbers, json, cors, admin-auth, supabase-admin, bankart-signature
- **Frontend shared lib**: `normalizeText.ts`, `objectGuards.ts`, `unknownPrimitives.ts`, `publicBusinessSettings.ts`, `money.ts`
- **CORS whitelist policy**: padrinobudva.com, www.padrinobudva.com, localhost:5173, 127.0.0.1:5173, plus `CORS_EXTRA_ORIGINS` env
- **Bankart callback intentionally has NO CORS** — signature verification replaces origin check
- **X-Frame-Options ALLOWALL** — required for portfolio iframe embed
- **AdminApiBase no-fallback dev** — no automatic production fallback in dev environment
- **Build process**: `tsc -b && vite build` — TypeScript strict checks before bundle

---

## References — docs/ folder

Padrino has audit documents in `docs/`. Treated as authoritative for their topics. Not migrated yet — will be triaged in later batch when stable.

- `docs/admin-api-duplication-audit.md`
- `docs/cartdrawer-extraction-audit.md`
- `docs/db-schema-baseline.md`
- `docs/final-project-closeout.md`
- `docs/large-files-audit.md`
- `docs/payment-env-audit.md`
- `docs/phase1-execution-plan.md`
- `docs/phase1-implementation-brief.md`
- `docs/phase2-implementation-brief.md`
- `docs/phase2-presentational-extraction-audit.md`
- `docs/refund-sync-audit.md`

---

### 2026-05-11 — B3.5: Telegram flow audit — DB trigger is dead code

**Finding:** Supabase DB trigger `telegram-new-order` fires AFTER INSERT on
`orders` and POSTs `{}` to `https://padrino-pizzeria.vercel.app/api/telegram-new-order`.
That URL is under Vercel Deployment Protection → 401 before request reaches
endpoint code. Trigger has never successfully sent a Telegram notification.

**Live evidence (production, 2026-05-11, 3 independent orders):**
- padrinobudva.com /api/telegram-new-order → 200 (create-order.ts caller)
- padrino-pizzeria.vercel.app /api/telegram-new-order → 401 (DB trigger)

**Actual flow:** `api/create-order.ts` → `bestEffortTelegramNotify()` →
POST `{ order_id }` → `padrinobudva.com/api/telegram-new-order` (12s timeout).

**Pattern:** Matches LESSONS L2 (PUBLIC_SITE_URL never VERCEL_URL).

**Decision:** Trigger left in place for now — removal requires schema migration.
Scheduled DROP: B15 (LEAN, ~15min, single migration).

**RUNBOOK:** §1 corrected in this batch (B3.5).

---

### 2026-05-11 — Audit findings — Phase History RECORD-UNRELIABLE

**Finding:** /audit 2026-05-11 (post-B3.5) discovered that several
pre-W0 batches recorded as DONE in this file's "Phase History" do
not match repo evidence:

| Batch | Claim | Evidence |
|-------|-------|----------|
| 2A | API shared helpers extraction (`api/_shared/`) | `git log --all -- "api/_shared/*"` returns ZERO commits. Directory has NEVER existed in this repo. |
| 3A | `normalizeText` centralization | `src/lib/normalizeText.ts` is MISSING |
| 3B-1 | Unknown primitives (`safeString`, `safeNumberOrNull`) extraction | `src/lib/unknownPrimitives.ts` is MISSING |
| 3B-2 | Object guards (`isPlainObject`, `isNonNullObject`) extraction | `src/lib/objectGuards.ts` is MISSING |
| 4C | Admin status TOCTOU atomic update + conflict handling | `api/admin-update-order-status.ts` L159-186 has SELECT-then-UPDATE WITHOUT `.eq("status", fromStatus)` guard. Classic read-then-write race; NOT atomic. |

**Most plausible explanation:** Old workflow (ChatGPT Plan + Composer
Execute) generated "DONE" tags optimistically. Code may have existed
in a separate repo/branch that was never merged here, or the work
was never actually executed.

**Decision:**
- Pre-W0 "Phase History" treated as **REFERENCE-ONLY**, not
  authoritative.
- Source of truth going forward: workflow v3 `LOG.md` + git history
  (W0 onward, 2026-05-10+).
- Existing Phase History text PRESERVED (this file is append-only) —
  this entry marks it unreliable without deletion.

**Action items materialized in `ROADMAP.md` via W2:**

- **B14** (Security audit, STRICT, ~2h) — Faza D table. Supersedes
  old B14 (CartDrawer Phase 3, now Long-term).
- **B15** (Telegram DB trigger DROP, LEAN, ~15min) — Faza B table.
- **B16** (CAS atomicity fix, STRICT, ~30min) — Faza B table. NEW
  from this audit (D4): real production race in
  `api/admin-update-order-status.ts`.

**Items reframed in ROADMAP:**

- **B8** — explicitly CREATE `api/_shared/` (not "consolidate INTO").
- **B10** — explicitly CREATE `api/_shared/admin-auth.ts`.

**Items confirmed:**

- **B9** (AuthProvider removal) — audit confirmed `useAuth()` defined
  in `src/auth/AuthProvider.tsx` line 98 but called nowhere else in
  `src/`. Wrap at `src/main.tsx` line 136 provides no consumed value.
  Safe-remove confirmed.

**Items lock-zone cleaned (STATE + CONTEXT):**

- Removed `api/_shared/*`, `src/hooks/useBankartPaymentJsInit.ts`,
  `src/hooks/useDeliveryZone.ts` from lock zone — all phantom
  references with no underlying files.

**Production health at time of audit:** padrinobudva.com healthy,
build PASS, 32/32 tests pass, no observed runtime regressions. No
customer impact from these doc-level drifts. D4 (CAS race) is the
only real production concern; tracked as B16.

---

## 2026-05-16 — B8 deferred + locked shared design (ChatGPT-confirmed)

**Finding:** `resolvePublicBaseUrl(req)` exists in 3 lock-zone files.
NOT a clean duplicate:
- `api/create-order.ts` + `api/bankart-order-status.ts`: env → **Origin
  branch** → x-forwarded → fallback, via `headerStringCI`.
- `api/bankart-callback.ts`: env → x-forwarded → fallback, **NO Origin
  branch**, via lowercase-forcing `headerString`.
`buildTelegramPayload` IS byte-identical across all 3 but calls
`resolvePublicBaseUrl` internally → cannot extract independently.

**Verdict (ChatGPT, original Padrino author context, 2026-05-16):**
- bankart-callback Origin omission = **intentional/correct, MUST be
  preserved**. Server-to-server HMAC callback must not trust
  browser-controlled `Origin` to build `notify_url` (security). Backed
  by `VERCEL_URL` 401 history (env canonical URL is source of truth;
  callback must not improvise via browser headers). No verbatim
  "security decision" record found, but inferred firmly from
  architecture.
- `headerString` vs `headerStringCI` = accidental drift; may
  canonicalize to `headerStringCI` — but canonicalization MUST NOT add
  Origin to callback.

**Locked shared design (for whenever B8 executes):**

    resolvePublicBaseUrl(req, { trustOriginHeader = false })  // safe default
    // order: env (PUBLIC_SITE_URL|SITE_URL|APP_URL|NEXT_PUBLIC_SITE_URL)
    //        → Origin (only if trustOriginHeader) → x-fwd-proto+host/host
    //        → https://padrinobudva.com
    // create-order.ts          → trustOriginHeader: true
    // bankart-order-status.ts  → trustOriginHeader: true
    // bankart-callback.ts      → trustOriginHeader: false

**Decision:** B8 DEFERRED to Phase D character. Tier corrected
STANDARD→**STRICT** (3 lock-zone files; B11 precedent). Re-estimate
~1.5–2h (must unify divergent `ReqLike`×3, `getEnv`, header helpers).
Not "drop" — executable later with this locked spec. Phase C continues
with B9.

**Lock-zone rule:** Bankart callback must not trust `Origin` for public
base URL. Origin fallback allowed only on browser-facing endpoints, only
as fallback behind env canonical URL.

**B8 execution refinement (2026-05-17):** Locked signature
`resolvePublicBaseUrl(req, …)` refined to `resolvePublicBaseUrl(headers, …)`
(caller passes `req.headers`, not the whole request). Matches
`api/_shared/admin-auth.ts` pattern (primitives, no handler coupling);
lowers TS structural-compat risk under Vercel nodenext. Behavior +
`trustOriginHeader` semantics unchanged. Repo > docs (RULES source-of-truth).
Pavle-approved 2026-05-17.

---

### 2026-05-16 — B12: Edge functions dedup decision (STRICT)

**Finding:** `supabase/functions/` sadrži 3 edge funkcije. Dve su mrtve
legacy duplikati Vercel `api/` ruta iz pre-W0 edge-first arhitekture
(Batch 9, 2026-03 — `telegram-new-order`/`admin-orders` migrirani na
`Deno.serve`, kasnije superseded Vercel `api/`):

| Edge funkcija | Status | Autoritativni put | Evidencija |
|---------------|--------|-------------------|------------|
| `payments-create-session` | **LIVE** | (nema Vercel ekvivalenta) | pozvana iz `api/create-order.ts:476` `https://<ref>.supabase.co/functions/v1/payments-create-session` |
| `admin-orders` | **DEAD** | `api/admin-orders.ts` | frontend koristi `${ADMIN_API_BASE}/api/admin-orders` (`AdminOrders.tsx:333`, `AdminDashboard.tsx:96`); edge verzija unreferenced |
| `telegram-new-order` | **DEAD** | `api/telegram-new-order.ts` | `create-order.ts` → `bestEffortTelegramNotify()` → Vercel `api/`; jedini DB trigger gađao Vercel URL i dropnut u B15 |

**Verifikacija mrtvog statusa (repo-wide grep, B12):**
- Nula referenci na `functions/v1/(admin-orders|telegram-new-order)`,
  `supabase.invoke(...)`, ili `supabase/functions/(admin-orders|telegram-new-order)`
  van samih edge dir-a.
- `supabase/config.toml` nema `[functions.*]` deklaracija.
- B3 schema baseline + migracije: jedini edge-relevantan trigger bio
  `telegram-new-order` → **Vercel** URL (ne edge), dropnut B15.
- RUNBOOK dokumentuje isključivo Vercel `api/` rute.

**Decision:** DELETE `supabase/functions/admin-orders/` i
`supabase/functions/telegram-new-order/` iz repo-a. KEEP
`supabase/functions/payments-create-session/` (LIVE) i
`supabase/functions/deno.d.ts` (deljen sa payments-create-session).

**Ops caveat (NIJE deo ovog repo-only batcha):** brisanje iz repo-a NE
radi Supabase undeploy. Ako su `admin-orders`/`telegram-new-order` edge
funkcije i dalje deployovane na Supabase projektu, manuelni
`supabase functions delete admin-orders` /
`supabase functions delete telegram-new-order` je odvojen ops korak za
Pavla. Bez akcije: deployovane mrtve funkcije su unreferenced i bezopasne
(niko ih ne poziva), ali ostaju surface area.

**Action item (Pavle, ops, non-blocking):** proveriti Supabase dashboard
→ Edge Functions; ako `admin-orders`/`telegram-new-order` postoje,
`supabase functions delete` da se ukloni dead deployed surface.

---

### 2026-05-17 — B14.1: F1 remediation — RLS on admin_users (STRICT)

**Source:** `docs/rls-security-audit.md` (B14, finding F1 — CRITICAL).

**Decision:** Apply RLS hardening to `admin_users` via new migration
`supabase/migrations/20260517000000_enable_rls_admin_users.sql`:

```sql
alter table "public"."admin_users" enable row level security;
revoke all on table "public"."admin_users" from "anon";
revoke all on table "public"."admin_users" from "authenticated";
```

**Rationale:** `admin_users` (the admin allowlist) had RLS disabled and
`GRANT ALL TO anon`. The Supabase anon key is public (frontend bundle), so
the allowlist was readable/writable via PostgREST → privilege escalation +
admin DoS. Confirmed against live DB (Pavle, 2026-05-16: "u supabase nam
je disableovan ROW level security").

**Anti-regression (no code path broken):** every `admin_users` access uses
the `service_role` key, which bypasses RLS unconditionally:
- `api/admin-users.ts` — `buildSupabaseAdmin()` → `SERVICE_ROLE` (line 80)
- `api/_shared/admin-auth.ts` — caller passes its service_role client (line 83)
- `supabase/functions/payments-create-session` — service_role; does NOT
  touch `admin_users`
- frontend `src/` — ZERO `.from("admin_users")` (UI strings only)

**Apply method:** Supabase dashboard SQL editor. NOT `supabase db push`
(the 20260510 baseline is a db-pull snapshot that may have drifted from
live; a push could attempt a full reconcile). Same operational caution as
B12 ops caveat.

**Rollback (3 lines, in migration footer + here):**
```sql
alter table "public"."admin_users" disable row level security;
grant all on table "public"."admin_users" to "anon";
grant all on table "public"."admin_users" to "authenticated";
```

**F2 (orders hardcoded-email policies):** NOT addressed. Deferred per audit
Option C — vestigial (service_role bypasses it; no production effect). Only
revisit if staff accounts ever get direct Supabase Auth sessions (→ B14.2).

**Apply status:** APPLIED & VERIFIED on production 2026-05-17 (Pavle, via
Supabase dashboard SQL editor). Post-apply verification confirmed:
- `pg_tables.rowsecurity` for `admin_users` = `true`
- `information_schema.role_table_grants`: `anon` ABSENT, `authenticated`
  ABSENT; `postgres` (owner) + `service_role` retain all (14 rows)
- Admin smoke PASS: login + AdminOrders + AdminUsers load, console clean
  (service_role path unaffected by RLS, as predicted by anti-regression)

---

### 2026-05-19 — W7: F2 (`src/lib/zones.ts`) WON'T EXECUTE

**Trigger:** /plan F2 invocation 2026-05-19. Pre-flight gates passed, but
scope recon revealed ROADMAP F2 line conflated two unrelated systems and
targeted dead code in a lock zone.

**Findings:**

1. **Two unrelated "zone" systems sharing only the word:**
   - Server (`api/create-order.ts:224-412`): `Zone { polygon: number[][] }`,
     `fetchZones()` from `delivery_zones` table, `isPointInPolygon()`
     ray-casting, `getDeliveryFeeCentsFromMeta()` GPS resolution.
   - Client (`src/components/CartDrawer.tsx:80-107`): `DeliveryZoneKey`
     union + `DELIVERY_ZONES` static array (8 named zones with hardcoded
     `feeCents`/`minCents`). No polygon math — UI dropdown selection.

2. **Server polygon path is DEAD CODE** (B2 audit 2026-05-11,
   `docs/delivery-fee-audit.md`): `delivery_zones` table absent in prod DB
   (ERROR 42P01); client never sends `lat`/`lng` → `point = null` →
   `fetchZones()` never called. Zero real orders activate this branch.

3. **Target `src/lib/zones.ts` invalid for server code** (L6 build
   boundary): api code cannot import from `src/` — Vercel serverless
   build (nodenext, `.js` ext) ≠ Vite build (Bundler). B8/B10/B10.1
   precedent: api shared code lives in `api/_shared/`.

4. **`getDeliveryFeeCentsFromMeta` mixes live and dead branches:** GPS
   branch (dead) + meta-note "Zona:"/"Dostava:" regex parsing (live — real
   production path when `point = null`). Extraction would bundle dead
   with live code in one module; dead rots inside the module instead of
   staying visible at its origin.

5. **"Refactor not rewrite" locked strategy** (ROADMAP 2026-05-17, Current
   Phase): real debt is structural (4 monolith files + util duplication),
   not foundational. Lock-zone touch for cosmetic dead-code shuffling
   violates this principle.

**Options considered:**

| Opt | Action | Verdict |
|-----|--------|---------|
| A | Skip F2 (won't-execute), advance to F3 | **CHOSEN.** Honest about dead-code reality; preserves lock-zone safety; zero risk. |
| B | Server polygon → `api/_shared/zones.ts` | Mechanical ROADMAP-following; extracts dead code into lock-zone-adjacent module; ~190 LOC win on create-order.ts but file still > 800 LOC exit-criterion #1 cap. Negative risk/reward. |
| C | Client `DELIVERY_ZONES` → `src/lib/deliveryZones.ts` | Real template seam (zones-as-config) but technically F4 ("Config seam module") territory; conflates F2/F4. |
| D | Both extractions in one batch | Violates 1-tema-1-batch (RULES §1); doubles lock-zone risk for unclear gain. |

**Decision:** F2 WON'T EXECUTE. Marked in ROADMAP F2 row + Notes section.
Current Phase prose advanced F2 → F3.

**Code disposition (out of W7 scope, recorded for future):**

- Server dead code (`fetchZones`/`isPointInPolygon`/`Zone` type/GPS branch
  in `getDeliveryFeeCentsFromMeta`): **remains in place**. Deletion needs
  its own STRICT batch with own plan + smoke gate.
- Client `DELIVERY_ZONES` static array: **stays in CartDrawer** until F4
  (Config seam module); candidate seam for the template-swap point.

**Analogous precedent:** B5 (CONDITIONAL on B2; B2 found no production
bug → B5 won't execute). Same pattern: audit dictated the right scope.

**Pavle approval:** 2026-05-19 (Opcija A confirmed verbally + /plan W7 ok).

---

## Deprecated Lessons

> Rotated out of `LESSONS.md` (cap: 7 active entries, RULES §20).
> Kept here for the record; no longer in active rotation.

### L4 — safeNumber("", fallback) vraća 0, ne fallback

**Deprecated 2026-05-18** (E4 close — LESSONS.md at cap, L4 selected for
rotation: bug fixed in code B4.1, pattern documented + applied at both
call-sites, Vercel env vars set belt-and-suspenders, preventive value
fully realized — lowest residual value of the 7 vs. still-live L0/L2/L5/L6).

**PROBLEM:** `safeNumber(getFirstEnv("BANKART_CALLBACK_MAX_SKEW_SECONDS"), 300)` vraća 0 kada
env var nije postavljen. Razlog: `getFirstEnv()` vraća `""`, `Number("") = 0`,
`Number.isFinite(0) = true` → fallback 300 nikada ne aktivira. Efektivno:
skew prozor srušen na `Math.max(30, 0) = 30s`, ne 300s. Otkriven u B4 kada
je test "60s in past" padao bez BANKART_CALLBACK_MAX_SKEW_SECONDS stub-a.
Isti bug na 2 call sites: bankart-callback.ts (skew) i bankart-order-status.ts
(rate limit interval).

**LEKCIJA:** `Number("") === 0` u JavaScript-u. `safeNumber(v, fallback)` fallback
se aktivira samo za NaN/Infinity — ne za prazan string. Empty string env var
prolazi kao 0, ne kao defaultna vrednost. Guard pattern koji radi:
`safeNumber(getEnv("X") || "300", 300)` — prazan string pada na string "300"
pre prosleđivanja u safeNumber.

**PRIMENA:** Svaki numerički env var gde 0 nije validna vrednost (timeout, skew,
rate-limit, interval): koristiti `getEnv("X") || "defaultVrednost"` pre
prosleđivanja u safeNumber. Ili eksplicitno setovati env var na Vercel.
Ne oslanjati se na fallback argument safeNumber za env-var-derived stringove.

**STATUS pri deprekaciji:** ACTIVE — B4.1 DONE (2026-05-12). Code fix deployed.
Vercel env vars BANKART_CALLBACK_MAX_SKEW_SECONDS=300 i
BANKART_STATUS_MIN_INTERVAL_SECONDS=15 ostavljeni kao belt-and-suspenders.

---

## 2026-05-20 — G4 split recon (G4.0)

**CILJ RECON-A:** CartDrawer.tsx je 1848 LOC (ne 1612 kako je ROADMAP tvrdio —
G3 net delta bio je -319, pre-G3 stanje ~2167, post-G3 = 1848). Target "thin
orchestrator ~300 LOC" zahteva ~1550 LOC ekstrakcije. Recon mapira sve sekcije
i predlaže split u G4.1..G4.6 STRICT pod-batcheve.

### Inventar sekcija

**Module-level (linije 1–211, ukupno ~211 LOC)**

| Linijski opseg | Sadržaj | Predlog ekstrakcije |
|----------------|---------|---------------------|
| 1–37 | imports | ostaje (CartDrawer imports) |
| 39–45 | declare global ImportMetaEnv | ostaje |
| 47–84 | types: MenuItemData, DrawerView, BankartOrderPaymentStatus, BankartOrderStatusResponse, BankartReturnStorage | → bankartReturnStorage.ts |
| 86–107 | constants: BANKART_RETURN_STORAGE_KEY, BANKART_PAYMENTJS_NUMBER_DIV_ID, BANKART_PAYMENTJS_CVV_DIV_ID, BANKART_PAYMENTJS_POLISH_CSS | returnStorage const → bankartReturnStorage.ts; paymentJS consts → useBankartPaymentJs.ts |
| 109–122 | fn isPaymentStatusValue, fn isFinalPaymentStatusValue | → bankartReturnStorage.ts |
| 124–208 | fn getBankartReturnParams, readBankartReturnStorage, writeBankartReturnStorage, clearBankartReturnStorage, cleanBankartReturnUrl | → bankartReturnStorage.ts |
| 210 | type PizzaVariantsMap | → useCatalogData.ts |

**Komponenta body (linije 212–1402, ~1191 LOC)**

| Linijski opseg | LOC | Sadržaj | Predlog ekstrakcije |
|----------------|-----|---------|---------------------|
| 213–234 | 22 | useCart() destructure (20 cart context values) | ostaje u CartDrawer |
| 236–251 | 16 | BTN_*/CARD/ROW/PHONE_* string constants | ostaje (inline style tokens, low priority) |
| 253–274 | 22 | 10 field useState + 10 trim derivatives | → useCheckoutForm |
| 276–312 | 37 | 7 useMemo validations (isNameValid .. isExpYearValid) | → useCheckoutForm |
| 314–327 | 14 | PaymentJS state: env flags, refs, ready/loading/error | → useBankartPaymentJs |
| 329–341 | 13 | handleSetPaymentMethod, handleBillingCityChange, handleBillingPostcodeChange, touched refs | → useBankartPaymentJs (handlers) + useCheckoutForm (touched refs) |
| 345–372 | 28 | zone state + submit state + ALL success* states + successCopied | → useDeliveryZone (zone) + useSuccessState (success*) + useOrderSubmission (submit*) |
| 374–376 | 3 | useEffect: successCopied reset on orderId change | → useSuccessState |
| 378–385 | 8 | useEffect: unmount cleanup (timers + paymentJs.dispose) | → useSuccessState |
| 387–415 | 29 | useEffect: checkout defaults loader (supabase site_settings) | → useCheckoutForm |
| 417–534 | 118 | useEffect: Bankart PaymentJS init (NAGY — style injection, focus handlers, active flag) | → useBankartPaymentJs **[LOCK]** |
| 536–560 | 25 | fn copySuccessOrderId (clipboard + fallback) | → useSuccessState |
| 562–623 | 62 | fn applySuccessUiState (payment status → UI strings mapping) | → useSuccessState (exposed for submitOrder) **[LOCK]** |
| 625–638 | 14 | fn fetchBankartOrderStatus (fetch /api/bankart-order-status) | → useSuccessState |
| 640–658 | 19 | catalog state + bankartHandledRef + bankartStatusTimerRef | → useCatalogData (catalog) + useSuccessState (bankartRefs) |
| 660–698 | 39 | sauceIdSet, setPizzaSizeSafe, totalItems, subtotalCents useMemos | → useCatalogData (sauceIdSet/setPizzaSizeSafe) + useDeliveryZone (totalItems/subtotalCents) |
| 699–727 | 29 | canSubmit, selectedDeliveryZone, qualifiesForFreeDelivery, missingToFreeDelivery, deliveryFeeCents, effectiveTotalCents | → useDeliveryZone |
| 729–745 | 17 | canConfirmOrder (complex cross-domain boolean) | ostaje ili → useOrderSubmission |
| 747–892 | 146 | shouldValidate flags (11) + error strings (12) + invalidFieldLabels + validationHint | → useCheckoutForm |
| 894–910 | 17 | backToCart, resetSuccessState | backToCart ostaje; resetSuccessState → useSuccessState |
| 912–968 | 57 | handleCloseDrawer, handleGoToMenu, handleSelectZone, addDrinkToCart | closeDrawer/GoToMenu ostaje; handleSelectZone → useDeliveryZone; addDrinkToCart → useCatalogData |
| 970–988 | 19 | useEffect: isOpen → reset all state | ostaje ili refaktoriše uz hook.reset() calls |
| 990–1098 | 109 | useEffect: Bankart return URL + status polling loop **[NAJOPASNIJA SEKCIJA]** | → useSuccessState **[LOCK, FULL BANKART SMOKE REQUIRED]** |
| 1100–1138 | 39 | useEffect: deliveryFeeOverride reset (x2) + zone click-outside | → useDeliveryZone |
| 1140–1213 | 74 | useEffect: catalog loader (supabase menu_items, pizza variants, drinks) | → useCatalogData |
| 1215–1402 | 188 | proceedToCheckout, submitOrder (176 LOC), onSubmitOrder | proceedToCheckout ostaje; submitOrder → useOrderSubmission (ili ostaje) **[LOCK]** |

**JSX render (linije 1404–1848, ~445 LOC)**

| Linijski opseg | LOC | Sadržaj | Predlog ekstrakcije |
|----------------|-----|---------|---------------------|
| 1404–1408 | 5 | isOpen early return + derived labels | ostaje |
| 1409–1463 | 55 | drawer chrome + header (KORPA/Plaćanje/Porudžbina + close/back buttons) | ostaje u CartDrawer |
| 1464–1480 | 17 | view="success" → `<CartDrawerSuccessView>` (ALREADY EXTRACTED) | ostaje |
| 1482–1779 | 298 | view="checkout" inline JSX (zone picker, payment method toggle, BillingFields, CardFields, napomena, submit button) | → `<CheckoutView>` NEW component **[LOCK]** |
| 1782–1811 | 30 | view="cart" → `<CartView>` (ALREADY EXTRACTED) | ostaje |
| 1814–1843 | 30 | cart footer (Ukupno + Poruči + Nazad na meni) | ostaje |
| 1844–1848 | 5 | closing tags | ostaje |

### Split predlog

Redosled: od najmanjeg rizika ka najvećem (nezavisni moduli → stateful hooks → Bankart-touching hooks).

| Batch | Naslov | Novi fajlovi | Delta LOC (CartDrawer) | Bankart dodir | Smoke scope |
|-------|--------|-------------|------------------------|---------------|-------------|
| G4.1 | Bankart helpers → `src/lib/` | `src/lib/bankartReturnStorage.ts` | ~−95 | TypeRef only (no behavior) | typecheck + build |
| G4.2 | `useCheckoutForm` | `src/hooks/cart/useCheckoutForm.ts` | ~−240 | NE | checkout form display + validation UX |
| G4.3 | `useDeliveryZone` | `src/hooks/cart/useDeliveryZone.ts` | ~−110 | NE (delivery fee, ne payment) | zone picker UI + delivery rules |
| G4.4 | `useBankartPaymentJs` | `src/hooks/cart/useBankartPaymentJs.ts` | ~−150 | DA (PaymentJS init + controller ref) | card checkout → Bankart test-mode checkout |
| G4.5 | `useSuccessState` + Bankart return | `src/hooks/cart/useSuccessState.ts` | ~−255 | DA — NAJOPASNIJA SEKCIJA | Bankart test-mode card redirect → return URL → status polling |
| G4.6 | `useCatalogData` + `CheckoutView` | `src/hooks/cart/useCatalogData.ts`, `src/components/cart/CheckoutView.tsx` | ~−370 | DA (checkout contains payment fields) | full golden-path + both payment methods |

**Predviđeni LOC nakon svakog batch-a:**
G4.0 → 1848 | G4.1 → ~1753 | G4.2 → ~1513 | G4.3 → ~1403 | G4.4 → ~1253 | G4.5 → ~998 | G4.6 → ~628

**NAPOMENA — LOC target realism:** ROADMAP-ov "~300 LOC" je dostižan SAMO ako se i `submitOrder` (176 LOC) ekstrahuje i/ili BTN_*/CARD/ROW konstante premeste. Nakon G4.1–G4.6, realan minimum je **~550–650 LOC**. Thin orchestrator sa ~300 LOC zahteva dodatan G4.7 (useOrderSubmission ekstrakcija + konstante). Pavle odlučuje nakon G4.6 rezultata.

### Rizici po batchu

**G4.1 (bankartReturnStorage.ts)** — nizak rizik.
- `readBankartReturnStorage` poziva `toSafeInt` iz `src/lib/money.ts`. Import chain: bankartReturnStorage → money.ts. Proveriti da nema circular dep (money.ts ne importuje CartDrawer).
- `BankartOrderStatusResponse` type se koristi i u useSuccessState (G4.5) — mora biti re-exportovan.

**G4.2 (useCheckoutForm)** — srednji rizik.
- Hook vraća ~30 vrednosti (10 field settera + 10 trims + 7 validity flags + 12 errors + 11 shouldValidate flags + validation hint). Proporcionalan interfejs — čitljiv ali glomazan.
- `submitOrder` (G4.6 ili ostaje) referentira 17+ vrednosti iz ovog hooka. API hook-a mora ostati stabilan između G4.2 i G4.6.
- `billingCityTouchedRef` i `billingPostcodeTouchedRef` su `useRef` — moraju biti unutar hooka, ne u CartDrawer.

**G4.3 (useDeliveryZone)** — srednji rizik.
- `deliveryFeeCents` i `effectiveTotalCents` ulaze u submit payload. Ako hook promeni logiku, submit greši.
- `zoneBtnRef` i `zonePanelRef` su DOM refs koji se koriste u JSX. Hook ih mora vraćati kao mutable refs.
- click-outside useEffect za zone dropdown: event listeneri na `document` — mora imati cleanup i ne sme interferirati sa drugim event listenerima.

**G4.4 (useBankartPaymentJs)** — VISOK rizik.
- `paymentJsControllerRef` se koristi u `submitOrder` (tokenize) + `handleCloseDrawer` (dispose) + `isOpen` reset effect. Mora biti eksponovan iz hooka kao `ref` objekat (ne vrednost) da bi CartDrawer i submitOrder mogli direktno pristupiti kontroleru bez re-renderinga.
- Init useEffect (118 LOC): deps su `[isOpen, view, paymentMethod, paymentJsFeatureEnabled, paymentJsPublicKey]`. `isOpen` i `view` dolaze iz CartDrawer — hook ih prima kao props/params. Promeniti dep listu na prethodni zahteva eksplicitne parametre hooka.
- BANKART_PAYMENTJS_POLISH_CSS inline u useEffect (22 linije CSS-a): ove linije se ubacuju u `<style>` tag. Moraju ostati uz init effect.
- Smoke: puna Bankart test-mode kartica checkout je OBAVEZNA za G4.4 close.

**G4.5 (useSuccessState)** — VISOK rizik — NAJOPASNIJA EKSTRAKCIJA.
- `applySuccessUiState` se poziva iz DVA mesta: unutar Bankart return useEffect (useSuccessState scope) I iz `submitOrder` (CartDrawer scope). Mora biti eksponovan iz hooka, a submitOrder mora je pozvati. Coupling je intentionalan — treba paźiti da ne dođe do stale closure.
- Bankart return useEffect (109 LOC): poziva `openCart` (iz useCart) i `applySuccessUiState` i `clearBankartReturnStorage` (iz G4.1 lib). Hook prima `openCart` kao param. Dep lista `[openCart]` mora ostati stabilna.
- Status polling timer (`bankartStatusTimerRef`): shared između return effect i unmount cleanup. Mora ostati unutar hooka scope-a.
- `bankartReturnHandledRef`: mora biti `useRef(false)` unutar hooka da ostane stabilan između renderinga.
- Smoke: OBAVEZNA puna Bankart test-mode checkout sa card redirect → return na /checkout/success URL → otvorena korpa sa status polling.

**G4.6 (useCatalogData + CheckoutView)** — VISOK rizik.
- `CheckoutView` prima ~25 props (sve checkout state vrednosti). Tačan prop interfejs mora biti određen iz finalnog stanja CartDrawer.tsx posle G4.1–G4.5.
- `submitOrder` ako ostaje u CartDrawer: i dalje referentira ~20+ vrednosti iz različitih hookova. Mora biti definisat unutar komponente da bi closure bio svež pri svakom render-u.
- `useCatalogData` loader koristi supabase direktno — ima isti `active` flag pattern kao checkout defaults loader. Mora imati cleanup.
- Smoke: full golden-path E2E (cart → checkout → submit) + oba payment methoda.

### Tracking napomena

G4.5 je najopasniji batch — jedini koji direktno dotiče Bankart return URL handling i status polling (real-money post-payment flow). Svaki G4.x batch koji ima "DA" Bankart dodir zahteva Pavle-ov ručni Bankart test-mode checkout pre /close-a. Ne preskakati smoke ni kada agentic build zelenuje.
