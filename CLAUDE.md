# CLAUDE.md

Bootstrap fajl. Ništa više.

---

## Na početku svake sesije pročitaj:

1. **`workflow/STATE.md`** — gde si i šta sledi (auto-injektuje se kroz session-bootstrap hook)
2. **`workflow/RULES.md`** — kako radiš
3. **`workflow/projects/padrino/CONTEXT.md`** — projekat specifičnosti

Aktivni projekat naveden je u STATE.md → "Aktivan projekat" → "Kontekst" polje.

---

## Source of truth

**Repo > dokumentacija > memorija.**

Ako root fajl, workflow fajlovi, realni repo ili STATE.md nisu međusobno usklađeni:
- STOP
- prijavi tačan konflikt
- ne nastavljaj na osnovu pretpostavke

---

## Skills

- `/plan [opis taska]` — generiše batch plan (LEAN/STANDARD/STRICT)
- `/close` — zatvara batch ili sesiju (LOG entry + STATE.md update)
- `/kickoff` — start novi batch sa drift detection
- `/audit` — provera da je trenutno stanje stabilno
- `/doc-lens [roadmap|bible] [fokus]` — extraction iz velikih dokumenata

Detalji u `workflow/RULES.md` sekcija 16.

---

## Operational docs (Padrino-specific)

Padrino-specifični fajlovi van workflow v3 sistema:

- `RUNBOOK.md` — production operations
- `DEPLOYMENT_CHECKLIST.md` — pre-deploy checklist
- `docs/*.md` — audit dokumenti, authoritative for their topics

---

## Legacy

Padrino prošlost (Batches 1-9, ChatGPT Plan + Composer Execute pattern) je u `workflow/projects/padrino/DECISIONS.md` "Phase History". Ne čitaj kao aktivan workflow — samo referenca.

---

## Session Hygiene — Reminders

Proactively remind me about these commands during our sessions:

### Context management
- **Every 20-30 minutes of active work** → suggest `/compact`
- **When you notice context is getting large** → immediately say "Context is filling up — run `/compact` now"
- **At ~75% context** → notify Pavle and suggest `/compact`
- **At ~80%+ context** → `/clear` is mandatory (after dumping progress to a .md file first)
- **When I finish a task and start a new unrelated one** → suggest `/clear`
- **Before I use `/clear` on a complex session** → remind me to ask you to dump progress into a `.md` file first
- **When session has been going long** → suggest `/rename` before closing
- **If I seem confused or you're giving worse answers than earlier** → flag it and suggest `/compact`

### Workflow skill suggestions
- **After `/plan` approval** → say "Spreman si za `/execute`"
- **After `/execute` finishes (STRICT tier)** → say "Pre `/close`-a vredi `/code-review` na trenutnom diff-u"
- **After `/execute` finishes (touched payment/Bankart/RLS files)** → say "Vredi `/security-review` pre `/close`"
- **Before `/plan` ako brief traži info iz dugog doc-a (ROADMAP > 400 lines, BIBLE, DECISIONS)** → suggest `/doc-lens [doc] '[fokus]'` prvo
- **After `/close` of STRICT batch + next task is unrelated** → suggest `/clear` + nova sesija za sledeći batch
- **After `/audit` reports drift** → say "Drift detektovan — fix prvo, /audit ponovo posle"
- **End of session / end of day** → suggest `/usage` za token billing awareness

Do not wait for me to ask. Mention these proactively, briefly, in Serbian.
