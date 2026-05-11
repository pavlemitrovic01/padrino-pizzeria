---
name: audit
description: On-demand cross-check between git state, STATE.md, LOG.md, and ROADMAP.md. Detects drift between sources of truth. Runs full verification (build, typecheck, test). Emits structured drift report. No fixes — only detection.
---

# /audit — Cross-Source Drift Detector (workflow v3)

## Role

Manual drift hunter. Use when you suspect something is off,
or after large changes (workflow migrations, multi-batch sessions).

Different from /kickoff: /kickoff is fast (5 sec), /audit is thorough (60 sec).

## Invocation

```
/audit
```

Optional: `/audit --roadmap` to additionally cross-check ROADMAP §14
Final Done Definition against actual code state.

---

## Process

### Step 1 — Run all verification

```bash
npm run build       # capture moduli, time, exit
npm run typecheck   # capture exit
npm run test        # capture file count, test count, exit
```

### Step 2 — Git checks

```bash
git status --porcelain
git log --oneline @{u}..
git log --oneline -1 --pretty=format:"%H %s"  # last commit
git worktree list
git branch -a
```

### Step 3 — STATE ↔ LOG cross-check

Read STATE.md "Last completed batch" field.
Read LOG.md last entry (search for `## ` headers, take last).

Compare:
- BATCH-ID in STATE matches BATCH-ID in LOG last entry?
- LOG last entry has SHA?
- That SHA matches `git log -1` SHA?

If mismatch → drift between STATE and LOG.

### Step 3.5 — STATE↔git drift check

1. Run: `git log -1 --pretty=%s` — capture last commit subject
2. Read `workflow/STATE.md` "Poslednji završen" line
3. Compare:
   - Ako commit subject sadrži batch ID prefix (e.g., "B2.0", "F1.6", "Batch 12a") sa workflow conventional format (chore/docs/feat/fix(workflow): batch-id ...)
   - Parsuj batch ID iz commit subject
   - Ako STATE "Poslednji završen" ne pominje taj batch ID → DRIFT
4. Output:
   - "STATE↔git: OK" ako match
   - "STATE↔git: DRIFT — git je na [batch ID iz commita], STATE kaže [batch ID iz STATE]" ako mismatch

Razlog: Internal /audit poredi STATE↔LOG (oba mogu biti istovremeno wrong). STATE↔git je objektivna provera da workflow nije past sebe samog. F1.6 case study: bez ovog step-a, /audit bi rekao "DRIFT SUMMARY: clean" iako je git past STATE.

### Step 4 — LOG ↔ git cross-check

For each LOG entry in last 5:
- Does LOG entry's SHA exist in git log?
- Are LOG entry's listed FILES present in that commit's diff?

If mismatch → drift between LOG and git history.

### Step 5 — Doc cap check

Per active project:
- `ROADMAP.md` ≤ 600 lines
- `BIBLE.md` ≤ 1200 lines
- `LESSONS.md` ≤ 200 lines, ≤ 7 active entries
- `CONTEXT.md` ≤ 100 lines

### Step 6 — Optional ROADMAP §14 cross-check (if --roadmap flag)

Read ROADMAP.md §14 "Final Done Definition".
For each `[ ]` (unchecked) item, attempt to verify against repo state:
- Is the feature visible in src/?
- Is the file modified in last N commits?
- Note: this is best-effort, not authoritative

Output checklist of items where status seems wrong (e.g., feature
present in code but unchecked in ROADMAP, or vice versa).

### Step 7 — Drift report

Output format:

```
═══════════════════════════════
AUDIT — [date]
═══════════════════════════════

Build health
  build:     PASS(machine) — [moduli, time]
  typecheck: PASS(machine)
  test:      PASS(machine) — [files, tests]

Git state
  Dirty:    [N | clean]
  Unpushed: [N | none]
  Branches: [list]
  Worktrees: [list]

STATE ↔ LOG
  [OK | DRIFT — explanation]

LOG ↔ git
  [OK | DRIFT — list mismatches]

Doc cap
  [OK | over: [file] [N]/[max]]

ROADMAP §14 (if --roadmap)
  [N items unchecked, M items potentially-done in code, K items unclear]

═══════════════════════════════
DRIFT SUMMARY: [N drifts detected | clean]
Recommended action: [list, or "none — all clean"]
═══════════════════════════════
```

---

## Anti-patterns

- Auto-fixing drift (audit detects, doesn't fix)
- Modifying STATE.md or LOG.md from audit
- Skipping verification because "build is probably fine"
