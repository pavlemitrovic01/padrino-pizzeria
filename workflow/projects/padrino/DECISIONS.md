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
