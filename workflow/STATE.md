# STATE.md — Trenutno stanje

> Jedini source of truth za "gde sam sada".
> Claude Code čita ovo na početku svake sesije (auto-inject via session-bootstrap hook).
> Overwrituje se na kraju svake sesije kroz `/close` skill.
> **Ne ažuriraj ručno** — ide samo kroz `/close`.

---

## Aktivan projekat

| Polje | Vrednost |
|-------|----------|
| Ime | padrino-budva |
| Stack | React 19.2 + TypeScript 5.9 + Vite 7.2 + Tailwind 3.4 + Framer Motion 12 + Vercel |
| Repo | github.com/pavlemitrovic01/padrino-pizzeria, branch: main |
| Production | https://padrinobudva.com |
| Aktivni plan | `workflow/projects/padrino/ROADMAP.md` |
| Kontekst | `workflow/projects/padrino/CONTEXT.md` |

---

## Gde sam sada

**Poslednji završen:** B8 — extract resolvePublicBaseUrl + buildTelegramPayload → api/_shared/ (2026-05-17, STRICT)
**Sledeći:** awaiting /plan (Faza D DONE; Long-term items next)
**Aktivan batch:** NONE
**Blocker:** NONE

**Faza progres:**
- Pre-W0 (Padrino history): 9 closed batches B1-B9 from old workflow
  (full record in DECISIONS.md). Old workflow used ChatGPT Plan +
  Composer Execute pattern.
- W0 (Workflow v3 init) — DONE 2026-05-10
- B1 (Lint fix) — DONE no-op 2026-05-11
- B2 (Delivery fee audit) — DONE 2026-05-11
- B3 (Schema baseline) — DONE 2026-05-11
- W1 (Workflow merge to main + branch cleanup) — DONE 2026-05-11
- B3.5 (Telegram flow doc correction) — DONE 2026-05-11
- W2 (Workflow reconciliation — post-audit drift fix) — DONE 2026-05-11
- B4 (Kritični testovi — HMAC + canTransition) — DONE 2026-05-12
- B4.1 (safeNumber call-site fix) — DONE 2026-05-12
- **Faza A — DONE** ✓
- B15 (Telegram DB trigger DROP) — DONE 2026-05-12
- B11 (Bankart raw error sanitization) — DONE 2026-05-12
- B16 (CAS atomicity fix — admin-update-order-status) — DONE 2026-05-15
- **Faza B — DONE** ✓
- B6 (CartProvider dedup → cartDrawerHelpers) — DONE 2026-05-16
- B7 (Menu.tsx image resolver dedup → cartDrawerHelpers) — DONE 2026-05-16
- B8 (extract resolvePublicBaseUrl + buildTelegramPayload → api/_shared/public-url.ts) — DONE 2026-05-17
  (STRICT; 6 fajlova, +266/-58; bankart-callback trustOriginHeader:false SECURITY LOCK;
  headers param umesto req — admin-auth pattern; L6 .js first-try ×3; Faza D DONE)
- B9 (AuthProvider removal) — DONE 2026-05-16
- B13 (Mrtvi fajlovi cleanup) — DONE no-op 2026-05-16
- B10 (Consolidate getAdminFromDb → api/_shared/admin-auth) — DONE 2026-05-16
  (STRICT; first api/_shared/ module; R2 materialized → nodenext .js fix
  commit 65a5fac caught by preview smoke → L6; isAdminEmailDb → B10.1)
- W3 (ROADMAP reconciliation — post-B10/L6 drift fix) — DONE 2026-05-16
  (LEAN; fixed false eslint-ignore claim linija 51; added B10.1 formal row)
- B10.1 (isAdminEmailDb dedup → api/_shared/admin-auth) — DONE 2026-05-16
  (STANDARD; 4 fajla, +21/-108; cascade-deleted 3×(isFallbackAdmin+looksLikeMissingTable+normalizeEmail);
  Vercel build logs pass + smoke pass; L6 .js pattern potvrđen first-try)
- **Faza C — DONE** ✓ (B6, B7, B9, B13, B10, B10.1 done; B8 deferred to Phase D)
- B12 (Edge functions dedup decision) — DONE 2026-05-16
  (STRICT; deleted supabase/functions/admin-orders/ + telegram-new-order/;
  payments-create-session kept; decision + ops caveat in DECISIONS.md)
- B14 (Security audit: RLS hardcoded email + admin_users RLS) — DONE 2026-05-16
  (STRICT; audit-only; F1 CRITICAL potvrđen iz live DB — admin_users nema RLS + GRANT ALL TO anon;
  remediation u docs/rls-security-audit.md; B14.1 = F1-only execution follow-up)
- B14.1 (Enable RLS on admin_users + revoke anon grants) — DONE 2026-05-17
  (STRICT; F1 CRITICAL fix applied to production; rowsecurity=true, anon/authenticated
  grants revoked, service_role retained; admin smoke PASS; F2 deferred per Option C)
- **Faza D — DONE** ✓ (B12, B14, B14.1, B8 — all done 2026-05-17)

**Workflow v3 status:** live on main branch. workflow-v3-init merged
(fc05439) and removed 2026-05-11. Default model: direct commits on main
with preview-then-approve flow. Per-batch branches only for STRICT-tier
code-touching batches (e.g., src/**, api/**); doc/audit batches direct.
22 batches completed (B1 no-op, B2 audit, B3 schema baseline,
W1 housekeeping, B3.5 Telegram doc, W2 reconciliation, B4 tests, B4.1 fix,
B15 trigger drop, B11 error sanitization, B16 CAS fix, B6 CartProvider dedup,
B7 Menu.tsx image resolver dedup, B9 AuthProvider removal, B13 Mrtvi fajlovi no-op,
B10 admin-auth dedup → api/_shared/, W3 ROADMAP reconciliation post-B10/L6,
B10.1 isAdminEmailDb dedup → api/_shared/, B12 edge functions dedup decision,
B14 RLS security audit, B14.1 RLS admin_users F1 fix,
B8 resolvePublicBaseUrl + buildTelegramPayload → api/_shared/public-url.ts).
Plus pre-B7 housekeeping commit 16a6f0f (supabase/.temp/ untrack — not a batch).

---

## Lock zone

Fajlovi koje ne dirati bez STRICT tier batch-a + Pavle approval-a.
Full list with reasons in `workflow/projects/padrino/CONTEXT.md`.

- `src/components/CartDrawer.tsx`
- `src/context/CartProvider.tsx`
- `src/App.tsx`
- `api/create-order.ts`
- `api/bankart-callback.ts`
- `api/bankart-order-status.ts`
- `api/telegram-new-order.ts`

---

> Pavle: ako ovaj fajl ne odražava stvarno stanje, prijavi pre nego
> što počneš rad.
