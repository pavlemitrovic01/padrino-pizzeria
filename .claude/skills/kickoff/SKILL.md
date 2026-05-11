---
name: kickoff
description: Session start drift hunter. Reads STATE.md, LESSONS.md (top 7), and ROADMAP.md current phase. Checks git status, unpushed commits, runs npm run typecheck. Reports consolidated session status. If drift detected (dirty tree, stale unpushed, typecheck fail), requires explicit Pavle ack before any other skill can proceed.
---

# /kickoff — Session Start Drift Hunter (workflow v3)

## Role

First skill called at session start. Catches drift between
"last session memory" and "actual repo state".

If you forget to call /kickoff, the next /plan or /close will
remind you (refuse until kickoff has run this session).

## Invocation

```
/kickoff
```

---

## Process

### Step 1 — State reads

Read directly:
1. `workflow/STATE.md`
2. `workflow/projects/[active-project]/LESSONS.md`
3. `workflow/projects/[active-project]/ROADMAP.md` — section "Current Phase"

### Step 2 — Git state checks

Run silently (capture output):
```bash
git status --porcelain
git log --oneline @{u}..
git worktree list
```

### Step 3 — Quick regression check

```bash
npm run typecheck
```

This is fast (~2s). Catches "yesterday I left something broken".

### Step 4 — Consolidated status report

Output format:

```
═══════════════════════════════
SESSION KICKOFF
═══════════════════════════════
Date: [today]
Active project: [from STATE]

State
Last completed: [batch ID + title]
Active batch:   [NONE | ID]
Next:           [from STATE or "awaiting /plan"]

Git
Dirty:    [N files | clean]
Unpushed: [N commits | none]
Worktrees: [count, usually just main]

Quick health
typecheck: [PASS | FAIL — first error]

Active LESSONS (top 7)
[bulleted list]

Drift alerts
[list of issues, or "none"]
═══════════════════════════════
[Status: READY | BLOCKED — fix drift first]
```

### Step 5 — Drift handling

If any of these is true → DRIFT:
- Working tree dirty (excluding _archive untracked)
- Unpushed commits older than 7 days
- Typecheck fails
- Active batch in STATE but no plan visible
- More than 1 worktree
- STATE batch ID iz "Poslednji završen" ne pojavljuje se u git log poslednjeg commit subject-a (`git log -1 --pretty=%s`). Razlog: workflow past STATE — catch-up batch potreban pre /plan.

Report DRIFT clearly. State that next /plan or /close
should not proceed until Pavle acknowledges drift
(verbal "ok kickoff" + commitment to fix).

---

## Anti-patterns

- Running other skills before /kickoff in a fresh session
- Suppressing typecheck errors as "small"
- Treating drift as warning instead of blocker
