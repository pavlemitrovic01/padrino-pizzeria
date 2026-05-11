---
name: close
description: Closes an active batch with machine-verified gates. Internally runs build/typecheck/test, captures exit codes, refuses PASS labels without exit-0 evidence. Compares git diff to EXPECTED-FILES (SCOPE_DRIFT detection). Forces commit of STATE.md + LOG.md as part of closure. Enforces LESSONS.md rotation cap.
---

# /close — Batch Closure Gate (workflow v3)

## Role

Zatvara aktivan batch. Verifikacija je shell exit code, ne labela.
Ne dozvoljava PASS(machine) bez stvarnog izvršenja komandi.

## Invocation

```
/close
```

No arguments — reads active batch from STATE.md.

---

## Process

### Step 0 — Identify active batch

Read STATE.md. Extract:
- Active batch ID
- Active batch tier (LEAN/STANDARD/STRICT)
- EXPECTED-FILES from the plan (must be in STATE.md or active plan reference)

If no active batch in STATE.md, REFUSE:
> No active batch to close. Run /plan first.

### Step 1 — Run verification commands (machine-verified gates)

Execute based on tier:

**LEAN:**
```bash
npm run build
npm run typecheck
```

**STANDARD:**
```bash
npm run build
npm run typecheck
npm run test
```

**STRICT:**
```bash
npm run build
npm run typecheck
npm run test
```
Plus: ask Pavle for manual smoke checklist confirmation.

For each command, capture exit code.

### Step 2 — Apply verification labels

For each command run:
- Exit code 0 → `PASS(machine)` with timestamp
- Exit code ≠ 0 → `FAIL(<command>)` with first 3 lines of error output
- Skipped intentionally (e.g., test for LEAN) → `NIJE POKRENUTO` with reason

If ANY command resulted in FAIL:
- LOG entry status: `BLOCKED`
- DO NOT proceed to commit step
- Report failure to Pavle, ask whether to:
  (a) Retry after fix
  (b) Mark batch as BLOCKED in LOG and stop
  (c) Override with explicit "ok skip verify" (LEAN only, requires explicit acknowledgment)

### Step 3 — SCOPE_DRIFT detection

Compare actual diff to plan:

```bash
git diff --name-only HEAD~N..HEAD  # N = commits in this batch
```

Sort. Compare to EXPECTED-FILES from plan.

- **Exact match** → no drift, proceed
- **Subset of EXPECTED** → no drift (planned file wasn't touched, OK)
- **Files outside EXPECTED** → SCOPE_DRIFT detected

If drift, report to Pavle:
> SCOPE_DRIFT detected.
> Plan said: [N] files
> Diff has: [M] files
> Extra: [list]
>
> Reason for these additions?
> Options:
>   (a) Approved drift — explain in commit message
>   (b) Revert extra files
>   (c) Restart batch with corrected plan

Wait for Pavle decision before continuing.

If approved drift, append to LOG entry:
`SCOPE_DRIFT (acknowledged): added [files] — [reason]`

### Step 4 — LESSONS rotation check (RULES §20)

If this batch produced a new lesson worth recording:
- Read LESSONS.md
- If currently 7 active entries, REFUSE to add new without rotation:
  > LESSONS.md at cap (7 active). To add new, first move oldest
  > to DECISIONS.md as deprecated. Which entry to deprecate?
- Pavle picks one. Move to DECISIONS.md with reason
  ("deprecated 2026-MM-DD: [reason]"). Add new lesson to LESSONS.md.

If no new lesson, skip this step.

### Step 5 — Confirm with Pavle

Present full DONE report draft:
- Verify results (PASS/FAIL labels with exit codes)
- SCOPE_DRIFT status (none or acknowledged)
- LESSONS changes (if any)
- Diff summary (files changed, +/- lines)

Wait for Pavle: "ok", "potvrdi", "close".

### Step 6 — Write LOG + STATE + COMMIT

This is atomic — all three or none.

(a) Append CLOSE entry to `workflow/LOG.md`. Format:

```
[BATCH-ID] — [Title] — [TIER]
Date: [YYYY-MM-DD]
Status: DONE | BLOCKED
SHA: [will be filled after commit]
Verify:
  build:     PASS(machine) — [moduli, time]
  typecheck: PASS(machine)
  test:      PASS(machine) — [N files, M tests]
  manual:    PASS(human) — [Pavle confirmed]
Files: [list from diff]
SCOPE_DRIFT: [none | acknowledged: [details]]
Notes: [optional]
```

(b) Update `workflow/STATE.md`:
- "Last completed batch" → this batch
- "Active batch" → NONE
- "Next" → leave blank or specify if obvious

(c) Stage and commit:
```bash
git add workflow/STATE.md workflow/LOG.md
git commit -m "workflow: close [BATCH-ID] [Title]"
```

(d) NO push. Pavle decides when to push (workflow commits batch up).

### Step 7 — Final report

Output format:

```
═══════════════════════════════
[BATCH-ID] — CLOSED
═══════════════════════════════
Status: DONE
SHA: [hash from git log -1]
Verify: build PASS / typecheck PASS / test PASS / manual PASS
SCOPE_DRIFT: [none | acknowledged]
LESSONS: [unchanged | added: ... | rotated: ...]
Next: [from STATE.md or "awaiting /plan"]
═══════════════════════════════
```

---

## Refusal examples

If `npm run test` exits non-zero:
> Cannot mark PASS(machine). `npm run test` exit code 1.
> First error:
>   FAIL src/__tests__/App.integration.test.tsx
>   useMotionValue is not defined
> Batch is BLOCKED. Options: fix and retry /close, or accept BLOCKED status.

If diff has unplanned file:
> SCOPE_DRIFT detected. EXPECTED-FILES had 3 paths.
> Actual diff has 4 (extra: src/styles/landing.css).
> Reason for adding landing.css?

If LESSONS.md has 7 entries and batch produced new lesson:
> LESSONS.md at cap. Pick oldest to deprecate to DECISIONS.md:
>   1. [date] — [title]
>   2. ...

---

## Anti-patterns

- Marking PASS(machine) without running the command
- Skipping SCOPE_DRIFT check on STANDARD/STRICT batches
- Committing STATE+LOG without first running verify
- Adding to LESSONS.md without rotation when at cap
