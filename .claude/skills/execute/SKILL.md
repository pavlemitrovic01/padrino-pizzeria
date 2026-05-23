---
name: execute
description: Executes a /plan-generated batch. Reads PLAN block from chat history, runs pre-flight gates, creates per-batch branch if STRICT, then begins implementation against EXPECTED-FILES. Refuses if no PLAN block visible.
model: sonnet
---

# /execute — Plan Execution (workflow v3)

## Role

Sonnet-powered wrapper around batch implementation. Komplementaran sa
/plan (Opus): /plan generiše brief + strukturisan header, /execute
preuzima i implementira.

Vrednost preko običnog "ok kreni":
1. Refuses ako nema /plan output-a u recent chat — sprečava izvršenje
   bez plana
2. Reads BATCH-ID, TIER, EXPECTED-FILES iz header-a
3. STRICT auto-branch (per-batch granu kreira automatski)
4. Scope-aware editing (warn pre touch-a fajla van EXPECTED-FILES)
5. Hand-off poruka ka /close kad implementacija završena

## Invocation

```
/execute              # uses last /plan output in chat
/execute <BATCH-ID>   # verifies BATCH-ID match before proceeding
```

---

## Process

### Step 1 — Locate /plan output

Scan recent chat history for a `/plan` output containing the structured
header block:

```
═══════════════════════════════════════════════════════
BATCH-ID: ...
TIER: ...
EXPECTED-FILES:
  ...
EXPECTED-COMMITS: ...
SCOPE-EXPANSION-RULE: STOP and report, not autonomous
═══════════════════════════════════════════════════════
```

If no such block found in recent chat: REFUSE.
> "Cannot /execute without an approved /plan. Run `/plan [task]` first,
> get Pavle approval, then `/execute`."

If `<BATCH-ID>` argument provided, verify it matches the plan's BATCH-ID.
Mismatch → REFUSE with explanation.

### Step 2 — Pre-flight gates

(a) **Working tree clean:**
    `git status --porcelain` must be empty.
    Exception: untracked `_archive/` files.
    Refusal reason: "Tree nije clean — commit or stash pending changes
    pre /execute."

(b) **Active batch state:**
    Read STATE.md "Active batch" field. Must be NONE.
    Refusal reason: "Active batch [ID] već u progress per STATE.md —
    close it first."

(c) **Tier guard for STRICT:**
    If TIER=STRICT, must create per-batch branch BEFORE first edit.
    Branch name: `batch/<batch-id-lowercase>-<short-slug>`
    Example: `batch/l1-hamburger-zindex`

### Step 3 — STRICT branch creation (if applicable)

If TIER=STRICT:

```bash
git checkout -b batch/<batch-id>-<slug>
```

Verify branch created and switched. Report branch name to user.

Skip for LEAN/STANDARD — those commit direct to main per workflow v3
default.

### Step 4 — Implementation

Iterate over EXPECTED-FILES from plan header. For each file:
- Use Read first if you haven't read it (or if it's been edited since)
- Apply Edit / Write as plan specifies
- Run verify steps progressively (build/typecheck/test za relevantne
  fajlove)

**Scope-drift guard:** If at any point you need to edit a file NOT in
EXPECTED-FILES:
1. STOP
2. Report: "Scope drift detected — need to edit [path] which is NOT in
   EXPECTED-FILES. Reason: [explanation]"
3. Wait for Pavle decision: (a) add to scope (update plan), (b) defer
   to follow-up batch, (c) revert edit

Do NOT autonomously expand scope.

### Step 5 — Verification

After implementation:

```bash
npm run typecheck
npm run test        # if test files touched
npm run build       # if STRICT or production-affecting
```

Capture exit codes. If any fail:
- Report failure
- Fix in-scope (preferred) or report blocking issue (last resort)

### Step 6 — Hand-off

When all EXPECTED-FILES touched per plan AND verification green:

Report:
- "Implementation done. Modified: [list of files with line deltas]"
- "Verify exit codes: build=0, typecheck=0, test=0"
- "STRICT branch: batch/<id>-<slug>" (if applicable)
- "Spreman si za `/code-review` (preporučeno za STRICT) pa `/close`."

Do NOT commit autonomously — /close zatvara batch + radi commit.

---

## Refusal examples

User: /execute (no plan in chat)
> REFUSE. Nema /plan output-a u recent chat-u. Run `/plan [task]` first.

User: /execute K1 (but last plan was for L1)
> REFUSE. BATCH-ID mismatch: argument K1, last plan was L1.

User: /execute (dirty tree)
> REFUSE. Working tree nije clean:
>   M src/components/Foo.tsx
>   ?? src/lib/new.ts
> Commit ili stash, pa /execute.

User: /execute (active batch K1 in STATE)
> REFUSE. STATE.md "Active batch: K1" — close it first sa /close.

---

## Anti-patterns

- Edit files outside EXPECTED-FILES (SCOPE_DRIFT — STOP and report)
- Commit autonomously (user owns /close, which commits)
- Skip pre-flight gates because "this is small"
- Continue past failing verify gate (report, don't paper over)
- Create branch for LEAN or STANDARD (only STRICT triggers branch)

---

## Workflow position

```
/plan → (Pavle reviews + approves) → /execute → (Pavle smoke + verify) → /close
 ↑                                       ↑                                 ↑
 Opus                                  Sonnet                            Sonnet
 (plans)                            (implements)                       (commits)
```

Sve u istoj Claude Code sesiji — nema "execution prompt" handoff-a
(legacy ChatGPT→Composer pattern dead per W10).
