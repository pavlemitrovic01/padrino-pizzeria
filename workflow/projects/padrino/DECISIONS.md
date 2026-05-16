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
