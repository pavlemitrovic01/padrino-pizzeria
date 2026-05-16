# LOG.md — Batch Audit Trail

> Append-only. Updated via /close skill.
> Most recent at top.

---

## B13 — 2026-05-16 — Mrtvi fajlovi cleanup — DONE (no-op)

**Tier:** LEAN
**SHA:** — (no code commits; no-op)
**Files:** none
**Verify:**
  typecheck: PASS(machine) — exit 0
  build:     PASS(machine) — exit 0, 4.23s
  test:      NIJE POKRENUTO — LEAN no-op, nema code delte
  manual:    NIJE POKRENUTO — nema izmena za smoke-test
**SCOPE_DRIFT:** none — 0 expected fajla, 0 izmenjenih
**Notes:**
  - B13 targetovao: padrinoo.txt + tracked *.tsbuildinfo
  - padrinoo.txt — ne postoji nigde u repo-u (glob 0 hitova)
  - *.tsbuildinfo — nijedan tracked (.gitignore:37 ih ignoriše)
  - public/robots.txt jedini .txt match → legitiman SEO fajl, netaknut
  - ROADMAP napomena "likely near-no-op" potvrđena. Kao B1.
  - **Faza C — B13 DONE** ✓

---

## B9 — 2026-05-16 — AuthProvider removal — DONE

**Tier:** LEAN (dead-code deletion; direct on main)
**SHA:** 24306a1
**Files:**
  - src/auth/AuthProvider.tsx (DELETE — 105 lines; jedini fajl u src/auth/)
  - src/main.tsx (MODIFY — uklonjen import + `<AuthProvider>` JSX wrapper)
**Verify:**
  build:     PASS(machine) — exit 0, tsc -b + vite, 7.77s
  typecheck: PASS(machine) — exit 0 (npm run typecheck)
  test:      PASS(machine) — 6 files, 83/83 (LEAN bonus gate)
  lint:      PASS(machine) — exit 0 (LEAN bonus gate)
  manual:    NIJE POKRENUTO — LEAN tier, dead-code deletion bez UI promene
**SCOPE_DRIFT:** none — tačno 2 expected fajla
**Notes:**
  - useAuth() nema potrošača u src/ — grep 0 hitova, W2 audit 2026-05-11 potvrdio
  - De-lock verifikovan: DECISIONS 2026-05-10 (uslovno), W2 audit potvrdio safe-remove
  - onAuthStateChange listener bio inertno: hranio lokalni state koji niko nije čitao
    (useAuth() nikad pozvan van AuthProvider.tsx; supabaseClient.ts netaknut)
  - Rezultat: 1 insertion(+), 108 deletions(-) — neto -107 linija
  - **Faza C — B9 DONE** ✓

---

## B7 — 2026-05-16 — Menu.tsx image resolver dedup → cartDrawerHelpers — DONE

**Tier:** STANDARD (single file, customer-facing image render; not lock zone; direct on main)
**SHA:** c3ece05
**Files:**
  - src/sections/Menu.tsx (MODIFY — import buildImageCandidates from ../lib/cartDrawerHelpers; remove 5 private resolver functions)
**Verify:**
  build:     PASS(machine) — exit 0 (tsc -b + vite), 2026-05-16 01:08
  typecheck: PASS(machine) — via npm run build (tsc -b)
  test:      PASS(machine) — 6 files, 83/83
  lint:      PASS(machine) — exit 0 (confirms no orphan/unused-import)
  manual:    PASS(human) — Pavle potvrdio: ceo meni (pizze/sosevi/dodaci/pića) renderuje, nema slomljenih pločica
**SCOPE_DRIFT:** none — tačno 1 expected fajl (src/sections/Menu.tsx)
**Notes:**
  - Uklonjeno 5 privatnih duplikata: `normalizeImagePath`, `NAME_TO_FILE`,
    `buildFileCandidatesFromFilename`, `buildFileCandidatesFromName`, `buildImageCandidates`
  - Importovan samo `buildImageCandidates` (ostala 3 simbola korišćena samo interno u uklonjenim funkcijama)
  - `normalizeText`/`stripSize` namjerno ostavljeni — i dalje korišćeni u non-image Menu logici (linije 296/310/466)
  - `normalizeImagePath` uklonjen kao orphan (koristio ga samo lokalni `buildImageCandidates`)
  - **Latentni fiks:** Menu-ov lokalni `NAME_TO_FILE` mapirao na `.png`, a `public/menu/` ima
    isključivo `.webp` (33 fajla, 0 png) → mapped-name fallback je produkovao mrtve kandidate.
    Shared helper rešava `.webp` + brand-prefix/volume logika + `padrino.webp` placeholder.
    DB `image` putanja se i dalje proba prva → DB-popunjeni redovi netaknuti (nema regresije).
  - Rezultat: 1 insertion(+), 81 deletions(-) — neto -80 linija
  - Pre-B7 housekeeping (zaseban commit 16a6f0f, NIJE B7 scope): `git rm --cached supabase/.temp/`
    — 8 tracked fajlova već u .gitignore:43 ali tracked od ranije; uklonjeni iz indexa,
    fajlovi ostaju na disku za Supabase CLI. Rešava recurring dirty-tree šum.
  - **Faza C — B7 DONE** ✓

---

## B6 — 2026-05-16 — CartProvider duplikati → cartDrawerHelpers — DONE

**Tier:** STRICT (lock zone file: src/context/CartProvider.tsx; branch: b6-cartprovider-dedup → FF-merged to main)
**SHA:** 13c57af
**Files:**
  - src/context/CartProvider.tsx (MODIFY — remove 4 duplicate local functions, import canonical versions from cartDrawerHelpers)
**Verify:**
  build:     PASS(machine) — exit 0, 7.31s
  typecheck: PASS(machine) — via npm run build (tsc -b)
  test:      PASS(machine) — 6 files, 83/83 (all passing)
  lint:      PASS(machine) — exit 0
  manual:    PASS(human) — Pavle potvrdio: smoke test pass
**SCOPE_DRIFT:** none — tačno 1 expected fajl
**Notes:**
  - Uklonjene 4 duplikat funkcije: `normalizeAddonName`, `stuffedCrustPriceForSize`, `stripSizeFromName`, `isStuffedCrustAddon`
  - Dodana 1 import linija: `{ isStuffedCrustAddonName, stripPizzaSizeFromName, stuffedCrustPriceForSize }` iz `../lib/cartDrawerHelpers`
  - 2 call-site renaming: `stripSizeFromName` → `stripPizzaSizeFromName`, `isStuffedCrustAddon` → `isStuffedCrustAddonName`
  - `normalizeAddonName` nije importovana — koristila se samo unutar uklonjene `isStuffedCrustAddon`
  - `parsePizzaSizeFromText` i `isPizzaLike` namjerno ostavljene (različite od cartDrawerHelpers verzija)
  - Rezultat: 8 insertions(+), 42 deletions(-) — neto -34 linije
  - **Faza C — B6 DONE** ✓

---

## B16 — 2026-05-15 — CAS atomicity fix in admin-update-order-status — DONE

**Tier:** STRICT (race-condition fix in payment-state machine; branch: b16-cas-atomicity-fix → FF-merged to main)
**SHA:** e797c43
**Files:**
  - api/admin-update-order-status.ts (MODIFY — add `.eq("status", fromStatus)` CAS guard + `.maybeSingle()` + 409 conflict response with re-read)
  - api/admin-update-order-status.test.ts (MODIFY — 3 new handler CAS tests: happy path 200, CAS miss 409 with current_status, identity transition guard)
**Verify:**
  build:     PASS(machine) — exit 0, tsc -b + vite 7.71s
  typecheck: PASS(machine) — via npm run build (tsc -b)
  test:      PASS(machine) — 6 files, 83/83 (80 prethodnih + 3 nova CAS testa)
  manual:    PASS(human) — Pavle potvrdio: status promjena → 200 OK
**SCOPE_DRIFT:** none — tačno 2 expected fajla
**Notes:**
  - Race window: admin READ-then-WRITE sa sekundama između. Bankart callback (api/bankart-callback.ts)
    može promijeniti status tokom tog window-a → payment-state divergence (paid ali "cancelled", ili
    refunded ali "done"). CAS guard eliminiše ovu klasu bug-ova.
  - Asimetrija namjerna: Bankart callback i create-order ostaju bez CAS (event-driven authority + atomic init).
  - 409 response vraća current_status (best-effort re-read), attempted_from, attempted_to i srpsku poruku.
    Admin osvježi listu i odlučuje — nema auto-retry u handler-u.
  - Identity transition (X → X) prošao CAS guard (`.eq("status", X)` match sopstveni red) → 200 OK, no-op.
  - **Faza B — DONE** ✓

---

## B11 — 2026-05-12 — Bankart raw error sanitization — DONE

**Tier:** STRICT (lock-zone file: api/create-order.ts; branch: b11-bankart-error-sanitize → FF-merged to main)
**SHA:** 604461f
**Files:**
  - api/create-order.ts (MODIFY — add `export function clientSafeError`, patch 2 leak sites with console.error + generic Serbian messages)
  - api/create-order.test.ts (NEW — 4 unit tests for clientSafeError: Error/string/undefined/null × both kinds)
**Verify:**
  build:     PASS(machine) — exit 0, 4.21s (tsc -b + vite, on main post-merge)
  typecheck: PASS(machine) — via npm run build
  test:      PASS(machine) — 6 files, 80/80 (76 prethodnih + 4 nova)
  manual:    PASS(human) — Opus reviewed + approved diff; Pavle okayed merge
**SCOPE_DRIFT:** none — exactly 2 expected files
**Notes:**
  - Fixed 2 leak sites in api/create-order.ts where raw error text reached browser client:
    (1) L1119-1121: insErr.message (Postgres constraint/column names) returned on DB insert failure
    (2) L1168-1170: top-level catch relayed raw Bankart/network/DB err.message to client
  - Both now: console.error for Vercel ops triage + generic Serbian message to client
  - clientSafeError(err, kind) helper exported for testability; kind param is forward-compat
    for per-kind categorization if needed later (B11.1)
  - Substring heuristic `includes("bankart")` for kind routing documented with exit strategy
  - Out-of-scope: api/bankart-callback.ts (server-to-server), api/bankart-order-status.ts (admin)
  - ROADMAP listed B11 as STANDARD; upgraded to STRICT because api/create-order.ts is lock zone

---

## B15 — 2026-05-12 — Telegram DB trigger DROP — DONE

**Tier:** LEAN (doc + migration, direct on main)
**SHA:** dcd64bc
**Files:**
  - supabase/migrations/20260512150000_drop_telegram_trigger.sql (NEW — DROP TRIGGER IF EXISTS)
  - RUNBOOK.md (MODIFY — §1.1 status "dead code"→"REMOVED (B15, 2026-05-12)" + migration ref; §4.1 test URL vercel.app→padrinobudva.com)
**Verify:**
  build:     PASS(machine) — exit 0, 3.76s (tsc -b + vite)
  typecheck: PASS(machine) — via npm run build
  test:      NIJE POKRENUTO — LEAN tier
  manual:    PASS(human) — Pavle ran SQL in Supabase Dashboard; pg_trigger confirms only `orders_set_total_price` remains on orders table; Vercel logs no longer show 401 errors for trigger URL
**SCOPE_DRIFT:** none — exactly 2 expected files
**Notes:**
  - Trigger `telegram-new-order` was calling https://padrino-pizzeria.vercel.app/api/telegram-new-order
    which returned 401 (Vercel Deployment Protection). Confirmed non-functional via 3 prod orders 2026-05-11.
  - Active Telegram flow untouched: api/create-order.ts → api/telegram-new-order direct server-to-server (12s timeout).
  - Out-of-scope flag from B3.5 (RUNBOOK §4.1 wrong URL) resolved in this batch.

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
