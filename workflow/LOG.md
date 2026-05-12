# LOG.md — Batch Audit Trail

> Append-only. Updated via /close skill.
> Most recent at top.

---

## B4.1 — 2026-05-12 — safeNumber call-site fix — DONE

**Tier:** STRICT (branch: b4.1-safenumber-fix → merged to main, FF merge)
**SHA:** fe397ab
**Files:**
  - api/bankart-callback.ts (MODIFY — add `|| "300"` guard on getFirstEnv call, line 213)
  - api/bankart-order-status.ts (MODIFY — add `|| "15"` guard on getFirstEnv call, line 229)
  - vitest.setup.ts (MODIFY — remove 2-line BANKART_CALLBACK_MAX_SKEW_SECONDS workaround stub)
**Verify:**
  build:     PASS(machine) — exit 0, 4.05s (tsc -b + vite)
  typecheck: PASS(machine) — via npm run build
  test:      PASS(machine) — 5 files, 76/76
  manual:    PASS(human) — Pavle approved diff preview
**SCOPE_DRIFT:** none — exactly 3 expected files
**Notes:**
  - Permanent fix for L4 finding (B4): safeNumber("", fallback) returned 0 not fallback.
    Guard `|| "N"` ensures empty env string falls through to string default before safeNumber.
  - vitest.setup.ts stub was workaround; removed because code now self-defaults correctly.
  - Vercel env vars (BANKART_CALLBACK_MAX_SKEW_SECONDS=300, BANKART_STATUS_MIN_INTERVAL_SECONDS=15)
    remain set on Vercel as belt-and-suspenders (harmless, no regression risk).
  - safeNumber deduplication (3 copies in api/) still deferred to B8 (api/_shared, Faza C).

---

## B4 — 2026-05-12 — Kritični testovi (HMAC + canTransition coverage) — DONE

**Tier:** STRICT (branch: b4-critical-tests → merged to main, FF merge)
**SHA:** 2a02276
**Files:**
  - api/bankart-callback.ts (MODIFY — 5 export keywords: export type ReqLike + 4 export function; ZERO logic change)
  - api/admin-update-order-status.ts (MODIFY — 3 export keywords: export type OrderStatus + 2 export function; ZERO logic change)
  - api/bankart-callback.test.ts (NEW — 22 tests: createBankartSignature×5, safeEqualSignature×3, isDateFresh×6, verifyBankartCallbackSignature×7, handler smoke×1)
  - api/admin-update-order-status.test.ts (NEW — 22 tests: isOrderStatus×6, canTransition×14, handler smoke×2)
  - vitest.config.ts (MODIFY — added api/**/*.test.ts to include + setupFiles: [./vitest.setup.ts])
  - vitest.setup.ts (NEW — env stubs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BANKART_SHARED_SECRET, BANKART_CALLBACK_MAX_SKEW_SECONDS)
**Verify:**
  build:     PASS(machine) — exit 0, 8.05s (tsc -b + vite)
  typecheck: PASS(machine) — via npm run build (no separate typecheck script)
  test:      PASS(machine) — 5 test files, 76/76 (32 pre-existing + 44 new)
  manual:    PASS(human) — Pavle approved post Opus+Sonnet review
**SCOPE_DRIFT:** none — exactly 6 expected files (supabase/.temp/* not staged)
  Note: vitest.setup.ts has 4 env stubs (plan showed 3); 4th (BANKART_CALLBACK_MAX_SKEW_SECONDS)
  required due to L4 finding — same file, not extra file.
**Notes:**
  - L4 FINDING (expanded during B4): safeNumber("", fallback) returns 0 not fallback because
    Number("") = 0 is Number.isFinite() = true; fallback never activates for empty string input.
    Affects 2 env-var call sites:
    (1) api/bankart-callback.ts:213 — BANKART_CALLBACK_MAX_SKEW_SECONDS unset → 30s floor (intended 300s)
    (2) api/bankart-order-status.ts:229 — BANKART_STATUS_MIN_INTERVAL_SECONDS unset → 12s floor (intended 15s)
  - Mitigation: both env vars explicitly set on Vercel (Production+Preview) + deploy, 2026-05-12.
  - Permanent code fix queued: B4.1 STRICT mini-batch — add `|| "N"` guard at 2 call sites
    in lock-zone files; estimated ~4 lines diff across 3 files (2 api + vitest.setup.ts cleanup).
  - safeNumber duplicated 3× in api/ (create-order, bankart-callback, bankart-order-status);
    centralization deferred to B8 (api/_shared extraction, already in ROADMAP Faza C).

---

## W2 — 2026-05-11 — Workflow reconciliation — post-audit drift fix — DONE

**Tier:** LEAN (doc-only)
**Branch:** main
**SHA:** df62808
**Files:**
  - workflow/STATE.md (MODIFY — lock zone cleaned to 7 entries, faza progres updated, roadmap additions cleared, W2 DONE)
  - workflow/projects/padrino/CONTEXT.md (MODIFY — branch: main, removed api/_shared/* + 2 phantom hook rows from Ključni fajlovi, removed 3 phantom rows from Lock zone)
  - workflow/projects/padrino/ROADMAP.md (MODIFY — B1/B2/B3/B3.5 marked DONE; B15+B16 added to Faza B; B14 superseded to security audit; old B14 → Long-term; B8/B10 reframed as CREATE; B13 annotated near-no-op; reconciliation log section appended)
  - workflow/projects/padrino/DECISIONS.md (APPEND — Phase History RECORD-UNRELIABLE section with evidence table, D4 CAS race finding, B8/B10/B9/B14/B15/B16 action items, lock zone phantom cleanup documented)
**Verify:**
  build:     PASS(machine) — exit 0, 6.96s (includes tsc -b)
  typecheck: PASS(machine) — via npm run build
  test:      PASS(machine) — 32/32 vitest
  manual:    PASS(human) — Pavle approved
**SCOPE_DRIFT:** none — exactly 4 expected files (supabase/.temp/* not staged)
**Notes:**
  - 8 drift items (D1-D8) found in /audit 2026-05-11 — all resolved in this batch
  - D1-D3: phantom entries removed from lock zone + Ključni fajlovi + ROADMAP reframes
  - D4: CAS race → B16 STRICT batch queued
  - D5-D8: branch, B13 scope, B14 supersession, B9 confirmation — all documented
  - Pre-W0 Phase History marked REFERENCE-ONLY in DECISIONS.md (not authoritative)
  - New items in ROADMAP: B14 (security audit), B15 (trigger DROP), B16 (CAS fix)

---

## B3.5 — 2026-05-11 — Telegram flow doc correction — DONE

**Tier:** LEAN
**Branch:** main
**SHA:** 11d0f4d
**Files:**
  - RUNBOOK.md (MODIFY — §1 flow rewrite, §1.1 dead trigger note, §6 timeout 5s→12s)
  - workflow/projects/padrino/DECISIONS.md (APPEND — B3.5 audit finding)
**Verify:**
  build:     PASS(machine) — exit 0, 3.85s (includes tsc -b)
  typecheck: PASS(machine) — via npm run build
  test:      NIJE POKRENUTO — LEAN tier
  manual:    PASS(human) — Pavle approved diff pre-commit
**SCOPE_DRIFT:** none — exactly 2 expected files
**Notes:**
  - RUNBOOK §1 now names api/create-order.ts as DB writer and direct
    caller of api/telegram-new-order (server-to-server, 12s timeout)
  - §1.1 added: dead DB trigger documented (vercel.app → 401 Vercel
    Protection, confirmed 3 production orders 2026-05-11)
  - §6 timeout corrected: 5s (DB trigger value) → 12s (actual
    bestEffortTelegramNotify timeout)
  - Finding recorded in DECISIONS.md for audit trail
  - B15 queued: DROP dead trigger (LEAN, ~15min migration)
  - Out-of-scope flag: RUNBOOK §4.1 test URL still uses
    padrino-pizzeria.vercel.app (→ 401) — 1-line fix deferred to B15

---

## W1 — 2026-05-11 — Workflow merge to main + branch cleanup — DONE

**Tier:** STRICT (workflow structural change per RULES §21)
**Branch:** main
**Merge SHA:** fc05439 (merge commit, no-ff, brings in 6 commits
from workflow-v3-init: f538d40, 97ef306, e1fabad, a1f450c, 057c998,
79ba688)
**Files:**
  - workflow/STATE.md (MODIFY — branch field, faza progres entry,
    workflow v3 status, roadmap additions)
  - workflow/LOG.md (APPEND — this entry)
**Verify:**
  build:    PASS(machine) — npm run build, exit 0
  test:     PASS(machine) — 32/32 vitest
  typecheck: PASS(machine) — tsc -b passes
  drift:    PASS(machine) — only the 2 expected files in diff
  manual:   PASS(human) — Pavle verified padrinobudva.com healthy
            pre-push and post-push (Vercel deploy clean, no console
            errors, 3 independent test orders confirmed Telegram
            flow pattern across 2026-05-11 sessions)
**SCOPE_DRIFT:** none — only STATE.md and LOG.md
**Branch cleanup actions:**
  - Worktrees removed: elegant-margulis-3b4c56, practical-moser-add445
    (both at 279c6fc, Claude Code session artifacts, no work lost)
  - Branches deleted: claude/elegant-margulis-3b4c56,
    claude/practical-moser-add445, workflow-v3-init (local + origin)
  - Remaining branches: main (local), origin/main, origin/master (legacy)
**Notes:**
  - First batch under "direct on main" model. Default flow now is:
    plan → preview commit on main → Pavle approves → push → /close.
  - Per-batch feature branches reserved for STRICT-tier batches that
    touch src/** or api/** (e.g., future B6 CartProvider, B11 Bankart).
  - origin/master is legacy from initial repo creation; not used,
    deletion deferred to future housekeeping.

---

## B3 — 2026-05-11 — Schema baseline (supabase db pull) — DONE

**Tier:** STRICT
**Branch:** workflow-v3-init
**SHA:** 057c998
**Files:**
  - supabase/config.toml (NEW, 15018 bytes)
  - supabase/migrations/20260510230628_remote_schema.sql (NEW, 10906 bytes)
**Verify:**
  build:        PASS(machine) — 8.27s (includes tsc -b typecheck)
  test:         PASS(machine) — 32/32
  schema pull:  PASS(machine) — schema file written; remote migration history
                step intentionally failed (we did not want remote DB writes)
  manual:       PASS(human) — Pavle confirmed findings, no production impact
**SCOPE_DRIFT:** none — only supabase/config.toml + migrations/*.sql

**Findings (significant — not bugs, but undocumented):**

1. **DB Trigger for Telegram** (orders table):
   `CREATE TRIGGER "telegram-new-order" AFTER INSERT ON orders`
   calls https://padrino-pizzeria.vercel.app/api/telegram-new-order via
   supabase_functions.http_request (5s timeout). RUNBOOK.md was incomplete —
   it describes Telegram as Vercel-driven but actually the DB drives it.
   Doc update planned in next batch (B3.5).

2. **RLS uses hardcoded email** (orders table):
   allow_admin_select_by_email / allow_admin_update_by_email /
   allow_admin_delete_by_email policies hardcode 'pavlemitrovic01@gmail.com'.
   Does not consult admin_users table. Security debt — flagged for future
   security batch.

3. **admin_users has no RLS:**
   Table has GRANT ALL to anon and authenticated, but
   no ENABLE ROW LEVEL SECURITY. Protected only at API level via
   service_role. Anon client with Supabase JS could potentially read admin
   emails directly. Security smell — flagged for future security batch.

4. **delivery_zones NOT present** — confirms B2 finding. GPS polygon path
   in api/create-order.ts references a non-existent table; harmless because
   path is never activated (no lat/lng in payload).

**Notes:**
  - LIVE DB baseline now exists. All future schema changes MUST go through
    migrations. docs/db-schema-baseline.md "blocker" (Docker unavailable)
    is resolved.
  - Access token created in Supabase dashboard as "cli_b3" — never used
    before this run.
  - DB password and access token were used only via env vars; not committed.

---

## B2 — 2026-05-11 — Delivery fee audit — DONE

**Tier:** STRICT (read-only audit)
**Branch:** workflow-v3-init
**SHA:** e1fabad
**Files:** docs/delivery-fee-audit.md (+181 lines)
**Verify:**
  build:     PASS(machine) — 7.18s (includes tsc -b typecheck)
  test:      PASS(machine) — 32/32
  SQL query: PASS(human) — Pavle potvrdio rezultat iz Supabase SQL editora
  audit doc: PASS(human) — Pavle potvrdio nalaze ("close")
**SCOPE_DRIFT:** none — samo docs/delivery-fee-audit.md
**Notes:**
  - delivery_zones tabela NE POSTOJI u prod DB (ERROR 42P01)
  - GPS polygon path je arhitekturalno mrtav — fetchZones() nikad pozvan
  - Fee flow radi ispravno kroz meta note parsing (sve 8 zone CLEAN)
  - B5 (delivery fee fix) se NE IZVRŠAVA — nema produkcijskog baga
  - Risk R1: formatFeeEurShort rounding za buduće non-round zone (low)
  - Risk R2: Dead DB code (fetchZones, delivery_zones ref) (cosmetic)

---

## B1 — 2026-05-11 — Lint fix — DONE (no-op)

**Tier:** LEAN (no-op)
**Branch:** workflow-v3-init
**SHA:** —
**Files:** none
**Verify:** npm run lint — PASS(machine) — 0 errors
**SCOPE_DRIFT:** none
**Notes:**
  Lint je bio čist na workflow-v3-init. Hooks (useBankartPaymentJsInit,
  useDeliveryZone) ne postoje jer su preemptivno rezervisani u LOCK zoni
  za buduću ekstrakciju. Nema akcije potrebne.

---

## W0 — 2026-05-10 — Workflow v3 Init — DONE

**Tier:** STRICT (workflow bootstrap)
**Branch:** workflow-v3-init
**Files created:** workflow/STATE.md, workflow/LOG.md,
  workflow/projects/padrino/{CONTEXT,ROADMAP,DECISIONS,LESSONS}.md
**Files modified:** CLAUDE.md (refactored to bootstrap format)
**Files preserved:** RUNBOOK.md, DEPLOYMENT_CHECKLIST.md, docs/*,
  workflow/RULES.md, .claude/*
**Verification:** PASS(machine) — npm run build, npm test
**Approval:** Pavle — manual review of preview before commit
**Notes:** First Padrino batch under workflow v3. Framework files
  (RULES.md + .claude/*) imported in previous commit (f538d40) from
  cl3menza repo. Project moved from OneDrive to C:\dev\padrino prior
  to W0 to eliminate sync risk.
