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

**Poslednji završen:** G2.0 — G2 PaymentSection forensic recon (2026-05-20, LEAN)
**Sledeći:** G2.1 — Extract BillingFields (STRICT) — see docs/g2-paymentsection-recon.md
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
- E1 (create-order endpoint hostile-input test) — DONE 2026-05-17
  (STANDARD; 1 fajl src/lib/createOrderEndpoint.test.ts, 11 testova;
  handler driven via fake req/res + hoisted supabase mock; lock zone
  api/create-order.ts NETAKNUT; exit-criterion #2 closed)
- E2 (Bankart callback integration test) — DONE 2026-05-17
  (STANDARD; 1 fajl api/bankart-callback.test.ts, +4 integration tests;
  Readable.from() stream req + hoisted supabase builder w/ update capture;
  DEBIT/OK paid+notify, duplicate idempotency, DEBIT/ERROR cancelled, not-found graceful;
  lock zone api/bankart-callback.ts NETAKNUT)
- E3 (Refund flow test) — DONE 2026-05-17
  (STANDARD; 2 fajla, +78/+223 lines; callback push: REFUND/OK+CHARGEBACK/OK→refunded,
  REFUND/ERROR→no-cancel, CHARGEBACK-REVERSAL/OK→paid; status-poll: A1 refunded-skip,
  A2 paid-not-skip ed51537 proof, B1 REFUND/SUCCESS, B2 CHARGEBACK/SUCCESS, B3 cash-boundary;
  lock zone api/bankart-callback.ts + api/bankart-order-status.ts NETAKNUTI)
- E4 (DOM test harness + CartDrawer contract characterization) — DONE 2026-05-18
  (STRICT; 5 fajlova, +1066/-17; SHA 90de2c3; 7 contract testova A1-A3/B1-B2/C1-C2
  na mock-boundary; jsdom per-file docblock + afterEach(cleanup); SCOPE_DRIFT
  vitest.config.ts acknowledged — .tsx include obavezan ili false green;
  LESSONS rotacija L4→DECISIONS, L7 dodat; lock zone CartDrawer.tsx NETAKNUT;
  karakterizovan loadCheckoutDefaults no-try/catch bug → Faza G)
- E5 (Golden-path E2E — cart → createOrder → redirect URL) — DONE 2026-05-18
  (STANDARD; 1 fajl src/components/CartDrawer.e2e.test.tsx, +205 linija;
  2 golden testa G1 card-redirect + G2 cash; real createOrder lib bez mock-a;
  vi.stubGlobal("location") pattern; exit-criterion #3 ZATVOREN;
  lock zone CartDrawer.tsx NETAKNUT; L7 updated — assign stub)
- **Faza E — DONE** ✓ (E1 E2 E3 E4 E5 sve zatvorene — safety net komplet)
- W4 (ROADMAP reconciliation — post-orphan-files scope drift fix) — DONE 2026-05-18
  (LEAN; doc-only ROADMAP.md F1/F1.1/F3; trigger: drugi nalog kreirao
  src/lib/parsing.ts+test tokom /kickoff [read-only violation], orphani
  git clean -f; recon: F1 ~25 dup sites ne "4+"; safeInt MONEY-PATH mina
  — ≥3 semantike, kanon money.ts toSafeInt, createOrder.ts NETAKNUT;
  F1.1 App.tsx isRecord lock split; F3 = api/_shared/parsing.ts;
  LESSONS cap 7/7 nepromenjen — insight u ROADMAP F1 noti)
- F1 (src/lib/parsing.ts consolidation) — DONE 2026-05-18
  (STANDARD; 12 fajlova, +152/-112; parsing.ts: isRecord A + isPlainObject B + safeString + normalizeText
  NO safeInt; 3 Variant-B sites isPlainObject as isRecord alias — Opus catch;
  cartDrawerHelpers re-export pattern; AdminDashboard safeInt→toSafeInt; 20 tests green;
  lock zone NETAKNUT; Faza F started)
- W5 (ROADMAP DONE-status reconciliation + /close ROADMAP-update process fix) — DONE 2026-05-18
  (STANDARD; 2 fajla, +38/-14; SHA 023debf; root cause: /close Step 6 pisao samo
  STATE+LOG nikad ROADMAP → svaka phase granica ostavlja ROADMAP stale dok ručni
  W ne pokupi [W2/W3/W4/W5 ista petlja]; nađeno temeljnim /audit-om [6 drift tačaka,
  mehanički git↔STATE↔LOG bio clean]; ROADMAP 6 tačaka status-only [Current Phase →
  Faza F IN PROGRESS, "22 batches" hardcode uklonjen → STATE.md, Faza E header DONE ✓
  + E1–E5/F1 DONE markeri]; close/SKILL.md (b2) guarded ROADMAP-update korak;
  W5 prvi kroz (b2) → ispravno no-op [W bez ROADMAP reda]; LESSONS 7/7 nepromenjen)
- F1.1 (src/App.tsx isRecord dedup — lock zone) — DONE 2026-05-18
  (STRICT; 1 fajl, +1/-4; SHA 2548568; isPlainObject as isRecord alias —
  Variant-B semantics preserved; last isRecord dup after F1 eliminated;
  per-batch branch; build+typecheck+test+manual smoke PASS)
- W6 (post-F1.1 partial-close cleanup) — DONE 2026-05-19
  (LEAN; 2 fajla, +3/-2; SHA d07172d; ROADMAP Current Phase prose
  F1.1→F2 advance + W4 SHA placeholder backfilled to 5b55f42;
  two-commit pattern to avoid same placeholder trap; branch
  origin/batch/f1.1-app-tsx-isrecord deleted post-merge)
- W7 (F2 won't-execute reconciliation) — DONE 2026-05-19
  (LEAN; 2 fajla, +69/-3; SHA 9372fad; ROADMAP F2 row marked
  WON'T EXECUTE on B2 audit dead-code finding (delivery_zones table
  absent + GPS path architecturally dead), Current Phase F2→F3,
  Notes section appended; DECISIONS 2026-05-19 entry with full
  findings + 4-option table + code disposition; analogous to B5
  won't-execute pattern; lock-zone safety preserved; refactor-not-
  rewrite strategy upheld; sledeći F3)
- F3 (api/_shared/parsing.ts formalization) — DONE 2026-05-19
  (STRICT; 12 fajlova, +131/-106; SHA bf5d2e8; NEW api/_shared/parsing.ts
  (isPlainObject/normalizeText/safeInt/safeNumber) + parsing.test.ts (11 tests);
  10× isPlainObject, 3× normalizeText, 3× safeInt, 3× safeNumber removed inline
  across 10 api/ files incl. 4 lock-zone; Variant-A canonical; safeNumber default
  0→NaN (all call sites pass explicit fallback); L6 .js first-try; Vercel Build
  Logs clean + manual smoke PASS)
- F4 (Config seam module) — DONE 2026-05-19
  (STANDARD; 4 fajla, +82/-6; SHA 2fdff83; NEW api/_shared/config.ts (5 exports:
  BANKART_FALLBACK_EMAIL/CITY/POSTCODE/BANKART_DESCRIPTION_PREFIX/DEFAULT_PUBLIC_HOST)
  + config.test.ts (5 shape-contract smoke tests, no literal assertions); api/create-order.ts
  (LOCK) inline consts → config.js import; api/_shared/public-url.ts hardcoded domain →
  DEFAULT_PUBLIC_HOST; template-swap point established on api/ side; Vercel Build Logs
  clean + manual smoke PASS; sledeći F4.1 STRICT)
- F4.1 (src/ Config seam mirror) — DONE 2026-05-19
  (STRICT; 6 fajlova, +117/-38; SHA efa313e; NEW src/lib/config.ts (SITE_URL +
  DEFAULT_BILLING_CITY/POSTCODE + DeliveryZoneKey/DeliveryZone types + DELIVERY_ZONES)
  + config.test.ts (5 shape-contract tests); CartDrawer.tsx (LOCK) + App.tsx (LOCK)
  + adminApiBase.ts + PizzaBudvaPage.tsx — inline literals → config import;
  DELIVERY_ZONES byte-identical 8/8; manual smoke PASS)
- F4.2 (cartDrawerHelpers + publicBusinessSettings config dedup) — DONE 2026-05-19
  (LEAN; 2 fajla, +4/-5; SHA d4e8876; Pavle pre-merge audit caught two-source-of-truth
  gap u F4.1; cartDrawerHelpers.ts:10-11 + publicBusinessSettings.ts:29-30 sad importuju
  DEFAULT_BILLING_CITY/POSTCODE iz ./config; "Budva"/"85310" literali sad SAMO u config.ts;
  recurring "recon depth" theme — pre-plan grep mora pokriti src/lib/, ne samo src/components/)
- **Faza F — DONE** ✓
- G1 (Extract CheckoutForm — name/phone/address inputs) — DONE 2026-05-20
  (STRICT; 2 fajla, +74/-44; SHA 12574ce; CheckoutForm.tsx NEW (Fragment return, 9 props,
  zero imports); CartDrawer.tsx lines 1539-1582 replaced; G1-narrow scope — delivery zone,
  payment panel, billing/card fields remain in CartDrawer for G2-G4; all gates PASS;
  Vercel preview smoke PASS; per-batch branch batch/g1-checkout-form merged main SHA e258fc3)
- G2.0 (G2 PaymentSection forensic recon — doc-only audit) — DONE 2026-05-20
  (LEAN; 1 fajl docs/g2-paymentsection-recon.md, +336 LOC; SHA bc3dd12; pre-plan
  forensic mapping for G2.1+G2.2; decisions locked: split G2.1 BillingFields ~38 LOC
  + G2.2 CardFields ~120 LOC; DOM IDs/CSS via props passing (constants stay in CartDrawer);
  L7 false-green risk documented — zero direct test coverage for PaymentSection JSX,
  smoke is only gate; persists G2 recon across session boundary)

**Workflow v3 status:** live on main branch. workflow-v3-init merged
(fc05439) and removed 2026-05-11. Default model: direct commits on main
with preview-then-approve flow. Per-batch branches only for STRICT-tier
code-touching batches (e.g., src/**, api/**); doc/audit batches direct.
37 batches completed (B1 no-op, B2 audit, B3 schema baseline,
W1 housekeeping, B3.5 Telegram doc, W2 reconciliation, B4 tests, B4.1 fix,
B15 trigger drop, B11 error sanitization, B16 CAS fix, B6 CartProvider dedup,
B7 Menu.tsx image resolver dedup, B9 AuthProvider removal, B13 Mrtvi fajlovi no-op,
B10 admin-auth dedup → api/_shared/, W3 ROADMAP reconciliation post-B10/L6,
B10.1 isAdminEmailDb dedup → api/_shared/, B12 edge functions dedup decision,
B14 RLS security audit, B14.1 RLS admin_users F1 fix,
B8 resolvePublicBaseUrl + buildTelegramPayload → api/_shared/public-url.ts,
E1 create-order endpoint hostile-input test,
E2 Bankart callback integration test,
E3 Refund flow test,
E4 DOM test harness + CartDrawer contract characterization,
E5 Golden-path E2E — cart → createOrder → redirect URL,
W4 ROADMAP reconciliation — post-orphan-files scope drift fix,
F1 src/lib/parsing.ts consolidation,
W5 ROADMAP DONE-status reconciliation + /close ROADMAP-update process fix,
F1.1 src/App.tsx isRecord dedup — lock zone,
W6 post-F1.1 partial-close cleanup,
W7 F2 won't-execute reconciliation,
F3 api/_shared/parsing.ts formalization,
F4 Config seam module,
F4.1 src/ Config seam mirror,
F4.2 cartDrawerHelpers + publicBusinessSettings config dedup).
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
