---
name: plan
description: Generates LEAN/STANDARD/STRICT batch plan with structured header for Claude Code handoff. Enforces clean working tree, doc cap, and one-active-batch invariants before planning. Refuses to plan if any guard fails.
---

# /plan — Batch Plan Generator (workflow v3)

## Role

Pretvara opis taska u execution brief sa strukturiranim header-om
koji /close kasnije mašinski poredi sa stvarnim git diff-om.

Sprečava scope creep PRE nego što kod krene.

## Invocation

```
/plan [task description]
```

Optional: `bugfix`, `feature`, `polish`, `refactor`, `docs`.

---

## Process

### Step 0 — Read state files

Always read directly (no scout):
1. `workflow/STATE.md` — active batch, lock zone
2. `workflow/projects/[active-project]/CONTEXT.md` — project truths
3. `workflow/projects/[active-project]/ROADMAP.md` — current phase, upcoming

### Step 1 — Pre-flight gates (REFUSE if any fails)

Run these checks. If any fails, REFUSE to plan and report which:

(a) **Working tree clean:**
    `git status --porcelain` must be empty.
    Exception: untracked files in `_archive/` or `workflow/` reference docs.
    Refuse reason: "Cannot plan with dirty tree. Commit or stash first."

(b) **No active batch:**
    Read STATE.md. "Active batch" field must be NONE.
    Refuse reason: "Active batch [ID] still open. Close with /close first."

(c) **Doc cap (RULES §19):**
    Per active project, check:
    - `ROADMAP.md` ≤ 600 lines
    - `BIBLE.md` ≤ 1200 lines
    - `LESSONS.md` ≤ 200 lines AND ≤ 7 active entries
    - `CONTEXT.md` ≤ 100 lines
    Refuse reason: "Doc cap exceeded: [file] is [N] lines (max [M]). Trim before planning."

(d) **No unpushed commits older than 1 day (advisory, not blocking):**
    `git log --oneline @{u}.. --since="1 day ago"` count vs total `git log @{u}..` count
    If older unpushed exists, warn but don't refuse.

If all pass, proceed.

### Step 2 — Tier determination

Ask Pavle (if not specified):
- **LEAN** — single file, ≤50 lines, no logic change (e.g. CSS tweak, doc fix)
- **STANDARD** — ≤5 files, scoped feature (most batches)
- **STRICT** — touches lock zone, architecture change, or system-wide impact

### Step 3 — Generate plan with structured header

Output format MUST start with this header (filled in):

```
═══════════════════════════════════════════════════════
BATCH-ID: [next available, e.g. B2.3 or F1.4]
TIER: [LEAN | STANDARD | STRICT]
EXPECTED-FILES:
  [path/to/file1]
  [path/to/file2]
EXPECTED-COMMITS: [N, usually 1]
SCOPE-EXPANSION-RULE: STOP and report, not autonomous
═══════════════════════════════════════════════════════
```

Then standard plan body (CILJ, PLAN, RIZIK, VERIFY, ZABRANE).

### Step 4 — Wait for explicit approval

Show the plan. Wait for Pavle to say one of: "ok", "piši", "važi", "kreni".

DO NOT write the Claude Code prompt until approval.

### Step 5 — On approval, write Claude Code prompt

Use the structured header verbatim at the top.
Include numbered steps, ZABRANE block, output format.

---

## Refusal examples

User: /plan add hover state to cards

If working tree has 2 modified files:
> REFUSE. Cannot plan with dirty tree.
> `git status --porcelain` shows:
>   M src/styles/landing.css
>   M src/components/landing/LandingHero.tsx
> Commit or stash these first, then re-invoke /plan.

If active batch is B2.3:
> REFUSE. Active batch B2.3 (Reward System v1) still open per STATE.md.
> Close it with /close first.

If ROADMAP.md is 642 lines:
> REFUSE. ROADMAP.md is 642 lines (cap 600 per RULES §19).
> Move closed sections to DECISIONS.md before planning.

---

## Anti-patterns (what /plan must NOT do)

- Generate plan without reading STATE.md first
- Skip pre-flight gates because "this is a small task"
- Write Claude Code prompt before Pavle approves
- Plan two unrelated topics in one batch (RULES §1: 1 tema = 1 batch)
- Use approximate file lists in EXPECTED-FILES — must be exact paths
