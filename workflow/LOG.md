# LOG.md — Batch Audit Trail

> Append-only. Updated via /close skill.
> Most recent at top.

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
