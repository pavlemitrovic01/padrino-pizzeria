# LOG.md — Batch Audit Trail

> Append-only. Updated via /close skill.
> Most recent at top.

---

## F4.1 — 2026-05-19 — src/ Config seam mirror — DONE

**Tier:** STRICT
**SHA:** efa313e
**Files (6):**
  - src/lib/config.ts — NEW (4 exports: SITE_URL/DEFAULT_BILLING_CITY/DEFAULT_BILLING_POSTCODE + DeliveryZoneKey/DeliveryZone types + DELIVERY_ZONES array)
  - src/lib/config.test.ts — NEW (5 shape-contract tests, no literal value assertions — F4 pattern)
  - src/components/CartDrawer.tsx (LOCK) — inline DeliveryZoneKey/DeliveryZone types + DELIVERY_ZONES const + DEFAULT_BILLING_CITY/POSTCODE → import from src/lib/config
  - src/App.tsx (LOCK) — 3× "https://padrinobudva.com" literals → SITE_URL import from src/lib/config
  - src/lib/adminApiBase.ts — 1× "https://padrinobudva.com" → SITE_URL import from ./config
  - src/seo/PizzaBudvaPage.tsx — SITE_URL/PAGE_URL local consts → SITE_URL import from ../lib/config; PAGE_URL derived from SITE_URL
**Verify:**
  build:     PASS(machine) — exit 0, 7.38s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 16 files 184 tests (+5 config.test.ts shape-contract)
  manual:    PASS(human) — Pavle confirmed smoke: cart zones, admin login, /pizza-budva JSON-LD, /faq canonical
**SCOPE_DRIFT:** none (6 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; clean refactor, DeliveryZone type unused-explicit → TypeScript inference caught pre-commit — minor, not lesson-grade)
**Notes:** src/ template-swap point complete. DELIVERY_ZONES values byte-identical (8/8 verified).
  DeliveryZone type removed from CartDrawer import (inferred from DELIVERY_ZONES.find() — no explicit annotation).
  moduleResolution Bundler confirmed for src/ → L6 .js extension NOT required (api/-only constraint).
  Faza F DONE: F1✓ F1.1✓ F2 won't-execute✓ F3✓ F4✓ F4.1✓. Sledeći: Faza G (CartDrawer rebuild, STRICT).

---

## F4 — 2026-05-19 — Config seam module — DONE

**Tier:** STANDARD
**SHA:** 2fdff83
**Files (4):**
  - api/_shared/config.ts — NEW (5 exports: BANKART_FALLBACK_EMAIL/CITY/POSTCODE/BANKART_DESCRIPTION_PREFIX/DEFAULT_PUBLIC_HOST)
  - api/_shared/config.test.ts — NEW (5 shape-contract smoke tests, no literal value assertions)
  - api/create-order.ts (LOCK) — inline consts removed; BANKART_FALLBACK_EMAIL/CITY/POSTCODE/DESCRIPTION_PREFIX → config.js import; description literal updated to use BANKART_DESCRIPTION_PREFIX
  - api/_shared/public-url.ts — hardcoded "https://padrinobudva.com" → DEFAULT_PUBLIC_HOST from config.js import
**Verify:**
  build:     PASS(machine) — exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 15 files 179 tests
  preview:   PASS(machine) — Vercel Build Logs clean (SHA 2fdff83)
  manual:    PASS(human) — Pavle confirmed "proslo, /close f4"
**SCOPE_DRIFT:** none (4 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; F4 executed clean, no new recurring-mistake pattern)
**Notes:** Template-swap point established on api/ side — fork to app#2 edits config.ts + env vars,
  no other api/ change required. Tests assert shape contracts only (non-empty, correct form) —
  intentionally no literal value assertions so template-swap doesn't pay test maintenance cost.
  5th constant BANKART_DESCRIPTION_PREFIX found during pre-execution recon (initial scan missed
  create-order.ts:667 description literal). F4.1 (STRICT) deferred: src/ side mirror
  (DELIVERY_ZONES in CartDrawer.tsx, SEO URLs in App.tsx/adminApiBase.ts/PizzaBudvaPage.tsx).
  Faza F: F1✓ F1.1✓ F2 won't-execute✓ F3✓ F4✓; F4.1 next (STRICT).

---

## F3 — 2026-05-19 — api/_shared/parsing.ts formalization — DONE

**Tier:** STRICT
**SHA:** bf5d2e8
**Files (12):**
  - api/_shared/parsing.ts — NEW (4 exports: isPlainObject/normalizeText/safeInt/safeNumber)
  - api/_shared/parsing.test.ts — NEW (11 smoke tests)
  - api/admin-settings.ts — isPlainObject inline → import
  - api/admin-users.ts — isPlainObject inline → import
  - api/admin-menu.ts — isPlainObject inline → import
  - api/admin-menu-image.ts — isPlainObject inline → import
  - api/admin-update-order-status.ts — isPlainObject inline → import
  - api/admin-resend-telegram.ts — isPlainObject/normalizeText/safeInt inline → imports
  - api/create-order.ts (LOCK) — isPlainObject/normalizeText/safeInt/safeNumber inline → imports
  - api/bankart-callback.ts (LOCK) — isPlainObject/safeNumber inline → imports
  - api/bankart-order-status.ts (LOCK) — isPlainObject/safeNumber inline → imports
  - api/telegram-new-order.ts (LOCK) — isPlainObject/normalizeText/safeInt inline → imports
**Verify:**
  build:     PASS(machine) — exit 0, ✓ built in 7.36s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 14 files 174 tests
  preview:   PASS(machine) — Vercel Build Logs clean (SHA bf5d2e8), no TS2835
  manual:    PASS(human) — Pavle confirmed "stize i sve radi kako treba"
**SCOPE_DRIFT:** none (12 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (7/7 cap; F3 executed clean, no new recurring-mistake pattern)
**Notes:** Variant A canonical isPlainObject (matches src/lib/parsing.ts:15); safeNumber
  default normalized 0→NaN (all 7 call sites pass explicit fallback — zero behavior change);
  safeInt byte-identical across 3 api/ sites (unlike src/ where semantics diverged — F1
  exclusion did not apply here). L6 .js extension on all imports, first-try. Faza F:
  F1✓ F1.1✓ F2 won't-execute✓ F3✓; F4 (Config seam module, STANDARD) next.

---

## W7 — 2026-05-19 — F2 won't-execute reconciliation — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** 9372fad
**Files (2):**
  - workflow/projects/padrino/ROADMAP.md — F2 row marked WON'T EXECUTE
    with B2 audit citation; Current Phase prose advanced F2 → F3
    (api/_shared/parsing.ts formalization); Notes section appended with
    F2 won't-execute reasoning (analogous to B5 pattern).
  - workflow/projects/padrino/DECISIONS.md — appended dated entry
    "2026-05-19 — W7: F2 (src/lib/zones.ts) WON'T EXECUTE" with full
    findings (2 zone systems / dead code / target invalid for api code
    per L6 / live-dead branch mixing in getDeliveryFeeCentsFromMeta /
    refactor-not-rewrite strategy), 4-option table (A chosen), and
    code disposition (server dead code stays; client DELIVERY_ZONES
    candidate for F4 Config seam).
**Verify:**
  build:     PASS(machine) — exit 0, 4.30s, 19 chunks
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      NIJE POKRENUTO — doc-only batch, no code changed (LEAN tier convention)
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = 9372fad)
**LESSONS:** unchanged (cap 7/7 — W7 is a scope-recon decision, not a
  recurring-mistake lesson; "audit-first before lock-zone extraction" is
  already implicit in CONTEXT lock-zone rule + memory feedback_lockzone_dedup)
**Notes:** Trigger = /plan F2 invocation. Scope recon revealed ROADMAP F2 line
  conflated server polygon (api/create-order.ts, dead per B2 2026-05-11) with
  client static list (CartDrawer DELIVERY_ZONES, F4 Config seam territory);
  target `src/lib/zones.ts` invalid for api code per L6 build boundary.
  Decision: Opcija A (skip + advance to F3), analogous to B5 won't-execute
  pattern (B5 was CONDITIONAL on B2, B2 found no bug → B5 won't execute).
  Server dead code remains in place — deletion = own STRICT batch if pursued,
  not silently absorbed here. Lock-zone safety preserved; refactor-not-rewrite
  locked strategy upheld (ROADMAP 2026-05-17 Current Phase). Close /close (b2)
  ROADMAP-update step = no-op for W7 (W has no own ROADMAP row; F2 row already
  updated by W7's own scope earlier in 9372fad). Sledeći → F3.

---

## W6 — 2026-05-19 — post-F1.1 partial-close cleanup — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** d07172d
**Files (2):**
  - workflow/projects/padrino/ROADMAP.md — Current Phase prose advanced:
    "F1 DONE 2026-05-18; F1.1 next (STRICT, lock zone — App.tsx)"
    → "F1 + F1.1 DONE 2026-05-18; F2 next (STRICT, lock zone —
    create-order.ts/CartDrawer.tsx zones extraction)".
  - workflow/LOG.md — W4 entry SHA backfilled: placeholder
    `_(filled post-commit — see git log / final report)_` → `5b55f42`
    (verified: `git log -1 5b55f42` = "workflow: close W4 ROADMAP
    reconciliation (post-orphan-files scope drift fix)").
**Verify:**
  build:     PASS(machine) — exit 0, 3.65s, 19 chunks (audit pre-W6)
  typecheck: PASS(machine) — exit 0 (audit pre-W6)
  test:      PASS(machine) — exit 0, 13 files, 163 tests (audit pre-W6)
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = d07172d)
**LESSONS:** unchanged (cap 7/7 — W6 is partial-close artifact cleanup,
  not a recurring-mistake lesson)
**Notes:** Root cause = previous /close runs interrupted by context limit
  (Pavle reported "udario sam u limit na pola poruke"). F1.1 close left
  ROADMAP Current Phase prose stale; W4 close (5b55f42) left its own SHA
  placeholder in LOG.md. **Two-commit pattern used** (vs single "workflow:
  close W6") so W6's own SHA is recorded with the close commit, not in the
  batch commit — explicitly avoiding the same placeholder trap that W4
  fell into. Branch hygiene also addressed this session:
  `git push origin --delete batch/f1.1-app-tsx-isrecord` after merge
  confirmed by `git ls-remote origin batch/f1.1-app-tsx-isrecord` →
  SHA 2548568 (already in main via 8aa321e). Suggested defensive follow-up
  (separate batch, NOT bundled here — cleanup ≠ skill enhancement):
  add partial-close detector to /audit Step 4 — flags SHA placeholders in
  last 5 LOG entries, ROADMAP Current Phase ↔ STATE "Sledeći" mismatch,
  and unmerged per-batch branches on origin.

---

## F1.1 — 2026-05-18 — src/App.tsx isRecord dedup (lock zone) — DONE

**Tier:** STRICT (lock zone: src/App.tsx; per-batch branch)
**SHA:** 2548568
**Files (1):**
  - src/App.tsx — removed local isRecord def (Variant B, lines 256-258);
    added `import { isPlainObject as isRecord } from "./lib/parsing"`.
    Alias preserves Variant-B semantics (arrays rejected). Zero call-site
    changes. Last isRecord dup after F1 eliminated.
**Verify:**
  build:     PASS(machine) — exit 0, 7.46s, 2187 modula
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 13 fajlova, 163 testa
  manual:    PASS(human) — Pavle confirmed: Vercel preview build green,
             public site OK, admin login OK
**SCOPE_DRIFT:** none (1 file = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = 2548568)
**LESSONS:** unchanged (7/7 cap — no new lesson; alias pattern already known from F1)
**Notes:** isPlainObject-as-isRecord alias pattern (established F1 for 3 Variant-B
  sites) extended to lock zone. Variant-B semantic verified pre-plan:
  App.tsx:256 had `!Array.isArray` → must alias isPlainObject, NOT import isRecord
  (Variant A — would be silent regression). ROADMAP F1.1 row updated via /close (b2).

---

## W5 — 2026-05-18 — ROADMAP DONE-status reconciliation + /close ROADMAP-update process fix — DONE

**Tier:** STANDARD (doc + workflow-process; direct commit on main)
**SHA:** 023debf
**Files (2):**
  - workflow/projects/padrino/ROADMAP.md — 6 drift points reconciled (status-only): Current Phase prose → "Faza F (Shared core) IN PROGRESS" + removed hardcoded "22 batches" (rots → drift; now points to STATE.md as authoritative); Faza E header `## Upcoming` → `## Faza E — DONE ✓` + E1–E5 DONE markers (E1–E3 2026-05-17, E4–E5 2026-05-18 from LOG dates); Faza F header `## Upcoming` → `## Faza F — IN PROGRESS` + F1 row `DONE 2026-05-18 (SHA f4c677f)`. Batch SCOPE text NETAKNUT (W4 already reconciled scope — W5 is status-only per ZABRANE).
  - .claude/skills/close/SKILL.md — Step 6 root-cause fix: added guarded sub-step (b2) ROADMAP-update + ROADMAP in git add; heading → "LOG + STATE + ROADMAP + COMMIT", "all four or none".
**Verify:**
  build:     PASS(machine) — exit 0, built 3.63s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 13 files, 163 tests
**SCOPE_DRIFT:** none (2 files = exact EXPECTED-FILES; EXPECTED-COMMITS 1 = 023debf)
**LESSONS:** unchanged (cap 7/7 — W5 insight is structurally self-documented in close/SKILL.md (b2); not a recurring-mistake active-buffer lesson; same treatment as W4)
**Notes:** Root cause confirmed from close/SKILL.md:151 — /close Step 6 wrote only
  STATE+LOG, never ROADMAP → every phase boundary left ROADMAP stale until a manual
  W batch (W2/W3/W4 all "ROADMAP reconciliation post-X" — same loop). Surfaced when
  /kickoff smelled one stale line; thorough /audit then found 6 drift points while
  the mechanical git↔STATE↔LOG chain was fully clean (drift was purely
  ROADMAP-content vs reality). Pavle pushed back on a narrow one-line W5 → rescoped
  to fix all 6 + the process hole (one coherent "kill the recurring-drift class"
  tema). W5 is the first batch through the new (b2): correctly NO-OP (W batch has no
  ROADMAP row, no phase boundary) — fix self-tested. Next: F1.1 (STRICT, lock zone —
  App.tsx) plans against the now-reconciled ROADMAP.

---

## F1 — 2026-05-18 — src/lib/parsing.ts consolidation — DONE

**Tier:** STANDARD (direct commit on main)
**SHA:** f4c677f
**Files (12):**
  - src/lib/parsing.ts (NEW) — 4 functions: isRecord (Variant A), isPlainObject (Variant B), safeString, normalizeText. NO safeInt (W4 decision).
  - src/lib/parsing.test.ts (NEW) — 20 tests (isRecord A/B split documented, safeString, normalizeText).
  - src/lib/cartDrawerHelpers.ts — import+re-export normalizeText from parsing; local def removed.
  - src/lib/createOrder.ts — import isRecord (Variant A); local def removed.
  - src/lib/publicBusinessSettings.ts — import isPlainObject as isRecord (Variant B); local def removed.
  - src/components/AdminOrders.tsx — import isRecord+isPlainObject+safeString+normalizeText; locals removed.
  - src/sections/Menu.tsx — import normalizeText; local def removed.
  - src/pages/admin/AdminDashboard.tsx — import isRecord+safeString; safeInt→toSafeInt from money; locals removed.
  - src/pages/admin/AdminLogin.tsx — import isRecord (Variant A); local def removed.
  - src/pages/admin/AdminMenu.tsx — import isPlainObject as isRecord (Variant B) + normalizeText; locals removed.
  - src/pages/admin/AdminSettings.tsx — import isPlainObject as isRecord (Variant B); local def removed.
  - src/pages/admin/AdminUsers.tsx — import isRecord (Variant A); local def removed.
**Verify:**
  build:     PASS(machine) — exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 13 files, 163 tests; parsing.test.ts confirmed running (20 tests green)
  lint:      PASS(machine) — exit 0
**SCOPE_DRIFT:** none (12 files = exact EXPECTED-FILES)
**LESSONS:** unchanged (cap 7/7)
**Notes:** isRecord Variant-B sites (AdminMenu:108, AdminSettings:85, publicBusinessSettings:39)
  import `isPlainObject as isRecord` — Opus self-review catch; would have been silent regression otherwise.
  cartDrawerHelpers.ts re-export preserves lock-zone consumers (CartDrawer, CartProvider) without touching them.
  Lock zone NETAKNUT. Faza F started.

---

## W4 — 2026-05-18 — ROADMAP reconciliation (post-orphan-files scope drift fix) — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** 5b55f42
**Files (1):**
  - workflow/projects/padrino/ROADMAP.md (Faza F tabela — F1/F1.1/F3):
      1. F1 ispravljen: scope `src/` non-lock-zone ONLY (~10 fajlova);
         parsing.ts vlasništvo SAMO isRecord/isPlainObject/safeString/
         normalizeText (verifikovano bajt-identični — true no-op);
         safeInt EXCLUDED — money-path mina dokumentovana; 1h → ~1.5h.
      2. F1.1 dodat (novi red): src/App.tsx:256 isRecord dedup,
         lock zone, STRICT, 30min — izdvojen iz F1.
      3. F3 pojašnjen: uključuje api/_shared/parsing.ts (~10 api/
         fajlova, 4 lock-zone, L6 .js obavezno);
         supabase/functions/payments-create-session (Deno) out per B12.
**Verify:**
  build:     PASS(machine) — exit 0, vite ✓ 7.53s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      NIJE POKRENUTO (LEAN tier)
**SCOPE_DRIFT:** none
  EXPECTED: workflow/projects/padrino/ROADMAP.md
  ACTUAL:   workflow/projects/padrino/ROADMAP.md ✓ (1/1)
**LESSONS:** nepromenjen (cap ostaje 7/7 — opcija b, Pavle odluka).
  Insight zarobljen u ROADMAP F1 noti (mesto upotrebe). Generalna
  lekcija (body-compare pre svakog util dedup-a; name ≠ semantika;
  čuvati money path) = L8 kandidat ako se ponovi van F1 — rotacija
  aktivne lekcije nije trošena za nešto već pokriveno na mestu upotrebe.
**Notes:**
  - Trigger: drugi Claude nalog kreirao src/lib/parsing.ts +
    parsing.test.ts tokom /kickoff (kickoff MORA biti read-only —
    cross-account drift incident). Orphani pregledani (24/24 vitest
    pass), git clean -f obrisani pre W4 (čisto stablo za /plan gate a).
  - Recon (grep + body-read): F1 stvarni scope ~25 dup-def sites,
    NE "4+" iz originalnog ROADMAP-a; 5 lock-zone; api/ odvojen
    build kontekst (Vercel serverless vs Vite) → pripada F3, ne F1.
  - safeInt MONEY-PATH MINA (ključni nalaz): ≥3 divergentne semantike.
    Kanon = src/lib/money.ts toSafeInt (Number()-coercion).
    createOrder.ts:76 / AdminOrders.tsx:64 već delegiraju na njega;
    AdminDashboard.tsx:32 inline kopija iste semantike → import iz money.
    publicBusinessSettings.ts:47 toSafeInt (number|null, bez fallback)
    = drugi kontrakt → OUT of F1. Orphan parsing.ts safeInt
    (string-or-number-strict) NE odgovara stvarnoj upotrebi — naivni
    dedup bi tiho promenio cenovni put.
  - normalizeText / isRecord verifikovani bajt-identični (true no-op).
  - STATE.md anticipovao W4 ("ili W4 reconciliation ako je potreban").
  - F1 sada kreće sa zaključanim poštenim scope-om bez skrivene mine.

---

## E5 — 2026-05-18 — Golden-path E2E (cart → createOrder → redirect URL) — DONE

**Tier:** STANDARD (additive test-only; direkt na main — E1/E2/E3 presedan)
**SHA:** edbdb73
**Files (1):**
  - src/components/CartDrawer.e2e.test.tsx (NEW — 205 linija, 2 golden testa)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 3.60s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 12 fajlova / 146 testa (+2 nova: G1, G2)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, lock-zone CartDrawer.tsx NETAKNUT,
             nije browser-observable (E1–E4 presedan)
**SCOPE_DRIFT:** none
  EXPECTED: src/components/CartDrawer.e2e.test.tsx
  ACTUAL:   exact match ✓ (1/1)
**LESSONS:** L7 updated (ne novi ulaz — cap ostaje 7)
  Dodat vi.stubGlobal("location")/vi.unstubAllGlobals() pattern za
  window.location.assign u jsdom (throws "Not implemented" bez stuba;
  stub mora zadržati pathname/search za CartDrawer init reads).
**Notes:**
  - E5 je "real net for Faza G" (ROADMAP) — exit-criterion #3 ZATVOREN:
    E2E green (cart → createOrder → redirect URL).
  - G1 (card-redirect golden path): real createOrder lib, fetch mock →
    { ok:true, id, flow:"card_redirect", redirect_url:URL } →
    fetchMock 1× /create-order, body.payment_method="card",
    window.location.assign(URL) 1×. Exit-criterion #3 ✓
  - G2 (cash golden path): real createOrder lib, fetch mock →
    { ok:true, id, flow:"cash" } → fetchMock 1× /create-order,
    body.payment_method="cash", window.location.assign NOT called.
  - Real createOrder lib (src/lib/createOrder.ts) drivovan bez mock-a —
    potvrđena validacijska logika + fetch chain end-to-end u tests.
  - E4 ff-merge (d380a35→005a8f1) + push + branch delete uključeni u
    ovaj batch (Step 0 iz plana — autorizovao Pavle pre egzekucije).
  - Lock zone (src/components/CartDrawer.tsx) — NETAKNUT.
  - **Faza E — DONE** ✓ (E1 E2 E3 E4 E5 sve zatvorene — safety net komplet)

---

## E4 — 2026-05-18 — DOM test harness + CartDrawer contract characterization — DONE

**Tier:** STRICT (safety net oko lock-zone CartDrawer.tsx pre Faza G;
  per-batch branch batch/E4-domharness-cartdrawer-char; lock-zone fajl
  SAM NIJE diran — samo nov .test.tsx)
**SHA:** 90de2c3
**Files (5):**
  - package.json (MODIFY — +4 devDeps: jsdom, @testing-library/react,
    @testing-library/jest-dom, @testing-library/user-event)
  - package-lock.json (MODIFY — lockfile od npm install)
  - tsconfig.app.json (MODIFY — +1 exclude "**/*.test.tsx" mirror od
    "**/*.test.ts" da tsc -b/build ostane zelen)
  - vitest.config.ts (MODIFY — include +"src/**/*.test.tsx"; SCOPE_DRIFT)
  - src/components/CartDrawer.test.tsx (NEW — 277 linija, 7 contract testova)
**Verify:**
  build:     PASS(machine) — exit 0, vite build ~3.85s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 11 files / 144 tests (+7 new)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, lock-zone CartDrawer.tsx NETAKNUT,
             nije browser-observable (E1/E2/E3 presedan)
**SCOPE_DRIFT:** acknowledged
  EXPECTED (4): package.json, package-lock.json, tsconfig.app.json,
                src/components/CartDrawer.test.tsx
  ACTUAL (5):   + vitest.config.ts
  Reason: include pattern imao samo src/**/*.test.ts → .tsx fajl nikad
          discovered = false green (0 izvršenih CartDrawer testova).
          Neophodna izmena da test uopšte radi. Pavle-approved.
**LESSONS:** rotated (cap 7)
  - L4 (safeNumber "" → 0) deprecated → DECISIONS.md "Deprecated Lessons"
    (bug fixan B4.1, pattern primenjen, preventivna vrednost potrošena)
  - L7 added (jsdom docblock: afterEach(cleanup) + .tsx include obavezni)
  - Active: 7 (L0,L1,L2,L3,L5,L6,L7); LESSONS.md 114 linija (≤200)
**Notes:**
  - 7 contract-level karakterizacionih testova (mock-boundary, ne DOM
    struktura) pre Faza G CartDrawer split:
    A1-A3 render per cart-state (isOpen=false→null, prazna→"Korpa je
    prazna", item→ime+"1 stavki");
    B1-B2 form-validation gating (blank submit→3 error poruke + 0
    createOrder; valid bez zone→"Izaberi zonu dostave." + 0 createOrder);
    C1-C2 submit-branch contract (cash+Budva→createOrder payment_method
    'cash', bez tokenize; card bez PaymentJS flag→payment_method 'card',
    transaction_token undefined, 0 createBankartPaymentJs).
  - 4 mocka: 3 behavior (useCart, bankartPaymentJs, createOrder) + 1
    infrastrukturni (supabaseClient — import-time throw guard; mora
    pokriti ceo query chain uklj. .maybeSingle()/.order()).
  - // @vitest-environment jsdom kao per-file docblock (NE globalni env —
    10 postojećih node testova ostaju netaknuti); zahteva eksplicitni
    afterEach(cleanup) (auto-cleanup ne okida sa docblock env-om).
  - Karakterizovan bug (lock-zone, NIJE fixan): loadCheckoutDefaults
    useEffect u CartDrawer.tsx ~liniji 419 nema try/catch (za razliku od
    loadCatalogs) → unhandled rejection ako supabase padne. Kandidat za
    Faza G.
  - Budva zona (feeCents:0, minCents:0) jedina testabilna bez delivery-fee
    setup-a za C1/C2.
  - Lock zone (src/components/CartDrawer.tsx) — NETAKNUT (diff: samo nov
    .test.tsx). Faza E nastavlja. Next: E5 (golden-path E2E).

---

## E3 — 2026-05-17 — Refund flow test — DONE

**Tier:** STANDARD (additive test-only; direct on main — non-lock-zone, test files only)
**SHA:** c1a8961
**Files (2):**
  - api/bankart-callback.test.ts (MODIFY — +4 refund/chargeback callback push tests
    + paidOrder const; +78 lines)
  - api/bankart-order-status.test.ts (NEW — 5 refund-sync status-poll tests; 223 lines)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 3.35s
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 10 files / 137 tests (+9 new)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, non-lock-zone, not browser-observable
**SCOPE_DRIFT:** none
  EXPECTED: api/bankart-callback.test.ts, api/bankart-order-status.test.ts
  ACTUAL:   exact match ✓ (2/2)
**Notes:**
  - File 1 (callback push, +4): REFUND/OK→refunded, CHARGEBACK/OK→refunded,
    REFUND/ERROR→payment_status kept "paid" (no cancellation),
    CHARGEBACK-REVERSAL/OK on already-paid→payment_status="paid" no Telegram.
  - File 2 (status-poll, +5):
    A1: refunded order skipped — shouldSkipStatusRefreshForPaymentStatus=true,
        no Bankart fetch;
    A2: paid order NOT skipped — ed51537 proof (paid is not a skip status),
        Bankart fetch called, refreshed=true;
    B1: REFUND/SUCCESS → payment_status="refunded" (applyBankartStatusToOrder);
    B2: CHARGEBACK/SUCCESS → payment_status="refunded";
    B3: cash order → early return source=db_cash, no fetch.
  - BANKART_API_KEY set in vi.hoisted() (not in vitest.setup.ts) — needed for
    getBankartConfig() called at handler runtime (not module-load time).
  - Bankart fetch stub: { ok:true, text:()=>Promise.resolve(JSON.stringify(body)) }
    (bankart-order-status.ts uses response.text(), not .json()).
  - ResLike for status-poll: status(code)→returns Res (chaining), send(), setHeader().
  - Lock zone (api/bankart-callback.ts + api/bankart-order-status.ts) — NETAKNUTI.
  - CHARGEBACK-REVERSAL via status-poll documented as unreachable for a "refunded"
    order (shouldSkipStatusRefreshForPaymentStatus("refunded")=true → skip gate fires
    before applyBankartStatusToOrder). No test written — honesty > coverage theater.
  - Faza E continues. Next: E4 (DOM harness) or E5 (golden-path E2E).

---

## E2 — 2026-05-17 — Bankart callback integration test — DONE

**Tier:** STANDARD (additive test-only; direct on main — non-lock-zone, test file only)
**SHA:** 62dd659
**Files (1):**
  - api/bankart-callback.test.ts (MODIFY — replaced simple vi.mock with hoisted
    controllable builder; added Readable.from() stream req helper + makeSignedReq;
    +4 integration tests covering payment→DB flow)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 3.22s (2186 mod)
  typecheck: PASS(machine) — exit 0 (tsc -b)
  test:      PASS(machine) — exit 0, 9 files / 128 tests (+4 new)
  lint:      PASS(machine) — exit 0, eslint
  manual:    NIJE POTREBNO — test-only, non-lock-zone, not browser-observable
**SCOPE_DRIFT:** none
  EXPECTED: api/bankart-callback.test.ts
  ACTUAL:   exact match ✓ (1/1)
**Notes:**
  - Covers payment→DB flow (previously 0 integration tests):
    DEBIT/OK pending → payment_status=paid, Telegram notified 1×;
    DEBIT/OK duplicate (already paid) → no double-notify (idempotency);
    DEBIT/ERROR → payment_status=failed + status=cancelled, no notify;
    order-not-found → 200 OK, updateCallCount=0, fetch 0 (graceful).
  - Lock zone (api/bankart-callback.ts) untouched — handler imported & driven, not edited.
  - Mock enhanced: hoisted state captures lastUpdatePatch + updateCallCount;
    makeUpdateEqBuilder handles await .update().eq() thenable chain.
  - vitest.setup.ts pre-sets BANKART_SHARED_SECRET="test-bankart-secret" —
    existing verifyBankartCallbackSignature unit tests still green (same secret).
  - Faza E continues. Next: E3 — Refund flow test.

---

## E1 — 2026-05-17 — create-order endpoint hostile-input test — DONE

**Tier:** STANDARD (additive test-only; direct on main — non-lock-zone, no src/api change)
**SHA:** 8fc65e6
**Files (1):**
  - src/lib/createOrderEndpoint.test.ts (NEW — 11 tests: 2 transport guard,
    7 hostile-input rejection, 2 negative control; drives exported handler
    via fake req/res + hoisted @supabase/supabase-js mock)
**Verify:**
  build:     PASS(machine) — exit 0, vite build 4.28s (2186 mod)
  typecheck: PASS(machine) — exit 0 (tsc -b; test file out of tsc scope —
             tsconfig.app excludes **/*.test.ts, R1 confirmed)
  test:      PASS(machine) — exit 0, 9 files / 124 tests
  manual:    NIJE POTREBNO — test-only, non-lock-zone, not browser-observable
**SCOPE_DRIFT:** none
  EXPECTED: src/lib/createOrderEndpoint.test.ts
  ACTUAL:   exact match ✓ (1/1)
**Notes:**
  - Closes exit-criterion #2: E1 hostile price-tamper test GREEN — server
    rejects/recomputes proven, not assumed (covers create-order.ts:1037-1090).
  - Lock zone (api/create-order.ts) untouched — handler imported & driven, not edited.
  - Within-intent simplifications vs plan (not scope creep): @upstash/* not
    mocked (getRatelimit()→null when UPSTASH_* env unset, limiter inert);
    fetchZones not mocked (no lat/lng → parseLatLngFromBody null → not called).
  - Coverage: 405/204 guards, Invalid payment_method, Invalid payload,
    Invalid item structure, Inactive/invalid menu item, Total mismatch
    (tampered total + tampered per-item price recomputed from DB), plus
    2 negative controls (matching total / omitted total accepted).
  - Faza E started (safety net). Next: E2 — Bankart callback integration test.

---

## B8 — 2026-05-17 — extract resolvePublicBaseUrl + buildTelegramPayload → api/_shared/public-url.ts — DONE

**Tier:** STRICT (3 lock-zone payment files; per-batch branch b8-shared-public-url)
**SHA:** 2bcab60
**Files (6):**
  - api/_shared/public-url.ts (NEW — shared module: resolvePublicBaseUrl + buildTelegramPayload)
  - api/_shared/public-url.test.ts (NEW — 14 tests: env precedence, Origin trust/ignore, x-fwd, fallback)
  - api/create-order.ts (MODIFY — remove local fns, import shared, trustOriginHeader: true)
  - api/bankart-order-status.ts (MODIFY — remove local fns, import shared, trustOriginHeader: true)
  - api/bankart-callback.ts (MODIFY — remove local fns, import shared, trustOriginHeader: false — SECURITY)
  - workflow/projects/padrino/DECISIONS.md (MODIFY — B8 signature refinement note req→headers)
**Verify:**
  build:     PASS(machine) — exit 0, 2186 modules, 6.85s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 8 files / 113 tests
  vercel:    PASS(human) — Pavle: Build Logs clean (no TS2835), readyState READY
  manual:    PASS(human) — Pavle: preview radi, monitoring OK, console clean
**SCOPE_DRIFT:** none
  EXPECTED: 6 fajlova (api/_shared/public-url.ts, api/_shared/public-url.test.ts,
            api/create-order.ts, api/bankart-order-status.ts, api/bankart-callback.ts,
            workflow/projects/padrino/DECISIONS.md)
  ACTUAL: exact match ✓
**Notes:**
  - Bezbednosna invarianta sačuvana: bankart-callback trustOriginHeader: false (SECURITY LOCK).
  - headerString u bankart-callback zadržan (HMAC verifikacija, linije 226/229/233 — nije orphan).
  - Signature refinement: resolvePublicBaseUrl(headers, opts) umesto (req, opts) —
    admin-auth.ts pattern, TS structural-compat risk reduction. DECISIONS.md ažuriran.
  - L6 .js import pattern potvrđen first-try (treća potvrda: B10, B10.1, B8).
  - Faza D DONE: B12 ✓ B14 ✓ B14.1 ✓ B8 ✓

---

## B14.1 — 2026-05-17 — Enable RLS on admin_users + revoke anon grants (F1 fix) — DONE

**Tier:** STRICT (schema-change; direct on main — no src/api changes)
**SHA:** 2dbc1ec
**Files (2):**
  - supabase/migrations/20260517000000_enable_rls_admin_users.sql (CREATE — F1 remediation migration)
  - workflow/projects/padrino/DECISIONS.md (MODIFY — B14.1 decision + apply status)
**Verify:**
  build:     PASS(machine) — exit 0
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 7 files / 95 tests
  DB verify: PASS(machine) — pg_tables.rowsecurity=true ✓,
             anon/authenticated grants absent (14 rows: postgres×7 + service_role×7 only) ✓
  manual:    PASS(human) — Pavle confirmed: login OK, AdminOrders OK,
             AdminUsers OK, console clean @ padrinobudva.com/admin
**SCOPE_DRIFT:** none
  EXPECTED: supabase/migrations/20260517000000_enable_rls_admin_users.sql,
            workflow/projects/padrino/DECISIONS.md
  ACTUAL:   exact match ✓
**Notes:**
  - F1 CRITICAL closed: admin_users RLS enabled + anon/authenticated grants revoked.
  - service_role bypasses RLS unconditionally → all api/admin-*.ts unaffected (confirmed).
  - Frontend has zero .from("admin_users") → no frontend impact.
  - Apply method: Supabase dashboard SQL editor (NOT db push — baseline may have drifted).
  - F2 (orders hardcoded email) deferred per Option C — vestigial, service_role bypasses it.
  - Rollback SQL documented in migration file and DECISIONS.md.

---

## B14 — 2026-05-16 — Security audit: RLS hardcoded email + admin_users RLS — DONE

**Tier:** STRICT (audit-only, doc batch — direct on main)
**SHA:** fb945bf
**Files (1):**
  - docs/rls-security-audit.md (CREATE — security audit deliverable)
**Verify:**
  build:     PASS(machine) — exit 0, 7.10s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 7 files / 95 tests
  manual:    N/A (doc-only batch, nema code/schema promene)
**SCOPE_DRIFT:** none
  EXPECTED: docs/rls-security-audit.md
  ACTUAL:   docs/rls-security-audit.md ✓
**Notes:**
  - +282/-0: novi audit dokument.
  - F1 (CRITICAL): admin_users nema RLS + GRANT ALL TO anon — privilege
    escalation via public anon key (potvrđeno od Pavle iz live DB).
  - F2 (MEDIUM): orders policies hardkoduju email — vestigialno, API
    path neafektovan (service_role bypasses RLS).
  - Remediation predložena u dokumentu; B14.1 (STRICT) = F1-only follow-up.

---

## B12 — 2026-05-16 — Edge functions dedup decision — DONE

**Tier:** STRICT (direct on main — cleanup/decision batch, no src/api changes)
**SHA:** 286ea67
**Files (4):**
  - supabase/functions/admin-orders/config.toml (DELETE — dead edge fn deploy config)
  - supabase/functions/admin-orders/index.ts (DELETE — dead edge fn, 195 lines)
  - supabase/functions/telegram-new-order/index.ts (DELETE — dead edge fn, 386 lines)
  - workflow/projects/padrino/DECISIONS.md (MODIFY — B12 decision + evidencija appended)
**Verify:**
  build:     PASS(machine) — exit 0, 3.57s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — exit 0, 7 files / 95 tests
  manual:    PASS(human) — Pavle confirmed (no runtime app changes;
             payments-create-session + deno.d.ts untouched)
**SCOPE_DRIFT:** acknowledged
  EXPECTED (original): 3 fajla (DECISIONS.md + 2 × index.ts)
  AMENDMENT: admin-orders/config.toml dodat uz Pavle eksplicitno odobrenje
             (STOP-and-report mid-batch; cascade cleanup iste mrtve jedinice)
  ACTUAL (4): matches amended EXPECTED ✓
**Notes:**
  - +41 / -585: admin-orders (195+1 lines) + telegram-new-order (386 lines) obrisani.
  - payments-create-session/ (LIVE, create-order.ts:476) + deno.d.ts netaknuti.
  - Ops action item (Pavle, non-blocking): proveriti Supabase dashboard → Edge Functions;
    ako admin-orders/telegram-new-order još deployovane → `supabase functions delete`.
  - Repo-wide grep: zero callers pre i posle brisanja (dead status potvrđen).

---

## B10.1 — 2026-05-16 — isAdminEmailDb dedup → api/_shared/admin-auth — DONE

**Tier:** STANDARD (branch: batch/B10.1-isadminemaildb-dedup → merged to main)
**SHA:** 0bcb7da (refactor commit); merge 61174dd
**Files (4):**
  - api/_shared/admin-auth.ts (MODIFY — dodat isAdminEmailDb export: thin wrapper nad getAdminFromDb; ažuriran header komentar)
  - api/admin-orders.ts (MODIFY — isAdminEmailDb/isFallbackAdmin/looksLikeMissingTable/normalizeEmail obrisani; import dodat; call site +supabase arg)
  - api/admin-update-order-status.ts (MODIFY — iste promene kao admin-orders.ts)
  - api/admin-resend-telegram.ts (MODIFY — iste promene; getEnv zadržan: koristi Telegram token pored Supabase client-a)
**Verify:**
  build:     PASS(machine) — exit 0, vite ~7.23s
  typecheck: PASS(machine) — exit 0
  test:      PASS(machine) — 7 files, 95 tests
  Vercel:    PASS(human) — Build Logs bez TS2835 (L6 gate)
  smoke:     PASS(human) — Pavle: admin-orders, admin-update-order-status, admin-resend-telegram 200/403
**SCOPE_DRIFT:** none
  EXPECTED: 4 fajla
  ACTUAL:   api/_shared/admin-auth.ts, api/admin-orders.ts,
            api/admin-resend-telegram.ts, api/admin-update-order-status.ts ✓
**Notes:**
  - +21 / -108 linija: cascade-deleted isFallbackAdmin + looksLikeMissingTable +
    normalizeEmail × 3 fajla (L6: dedup → orphan-cleanup u istom batch-u, nije scope creep).
  - getEnv zadržan u sva 3 caller-a (Supabase client + Telegram token u resend fajlu).
  - isAdminEmailDb je thin wrapper: (await getAdminFromDb(supabase, e)).isAdmin —
    jedan izvor DB logike, behavior-preserving za sve 3 varijante (string/unknown).
  - L6 NEXT REVIEW ažuriran: "posle B10.1 / B8" → "posle B8" (.js pattern potvrđen
    first-try na B10.1; B8 Phase D dolazi i dalje treba L6 kao aktivan reminder).

---

## W3 — 2026-05-16 — ROADMAP reconciliation (post-B10/L6 drift fix) — DONE

**Tier:** LEAN (doc-only, direct commit on main)
**SHA:** 99c97e3
**Files (1):**
  - workflow/projects/padrino/ROADMAP.md (2 izmene):
      1. Linija 51: "Backend ESLint coverage — currently api/** is in eslint ignore" → ispravljena.
         Stvarnost (L6/B10): eslint lintuje api/ (`eslint.config.js` ignoriše samo `dist`,
         `files: **/*.{ts,tsx}`). Rezidual (globals.browser na Node api/) tačno formulisan.
      2. B10.1 formalni red dodat u Faza C tabelu (isAdminEmailDb dedup, STANDARD, 30min).
**Verify:**
  build:     PASS(machine) — exit 0, vite ~7.64s
  typecheck: PASS(machine) — exit 0
  test:      NIJE POKRENUTO (LEAN tier)
**SCOPE_DRIFT:** none
  EXPECTED: workflow/projects/padrino/ROADMAP.md
  ACTUAL:   workflow/projects/padrino/ROADMAP.md ✓
**Notes:**
  - Netačna tvrdnja bila direktan uzrok B10 ZABRANA "ne diraj lokalne helpere" (plan je
    koristio ROADMAP kao izvor — repo > dokumentacija važnija). Korekcija sprečava
    ponavljanje iste pretpostavke u budućim batchevima.
  - B10.1 sada formalno praćen u ROADMAP; sledeći /plan B10.1 ima čist polazni ROADMAP.

---

## B10 — 2026-05-16 — Consolidate getAdminFromDb → api/_shared/admin-auth — DONE

**Tier:** STRICT (first api/_shared/ module ever; branch: b10-shared-admin-auth → FF-merged to main)
**SHA:** 65a5fac (code: 3e55179 refactor + 65a5fac nodenext fix) — workflow close commit follows
**Files (7):**
  - api/_shared/admin-auth.ts (NEW — getAdminFromDb(supabase, email) + inline normalizeEmail/isFallbackAdmin/looksLikeMissingTable/isAdminRole + AdminRole/AdminLookup types)
  - api/_shared/admin-auth.test.ts (NEW — 12 tests: empty/whitespace guard, email normalization, missing-table fallback ×3, generic error, row resolution ×5)
  - api/admin-me.ts (MODIFY — getAdminRoleFromDb → shared; orphan cleanup: isFallbackAdmin/looksLikeMissingTable/isAdminRole/AdminRole/TableState)
  - api/admin-menu.ts (MODIFY — getAdminFromDb → shared; orphan cleanup: isFallbackAdmin/looksLikeMissingTable/isAdminRole/AdminRole)
  - api/admin-menu-image.ts (MODIFY — isto kao admin-menu)
  - api/admin-settings.ts (MODIFY — isto kao admin-menu)
  - api/admin-users.ts (MODIFY — getAdminFromDb → shared; orphan cleanup: samo isFallbackAdmin — ostali helperi/AdminRole i dalje korišćeni u normalizeAdminUserRow/AdminUserRow)
**Verify:**
  typecheck: PASS(machine) — exit 0 (tsc -b, Bundler resolution)
  lint:      PASS(machine) — exit 0 (bio FAIL 14 no-unused-vars → fixed orphan cleanup)
  test:      PASS(machine) — 7 files, 95/95 (+12 novih admin-auth)
  build:     PASS(machine) — exit 0, vite ~7s
  manual:    PASS(human) — Pavle (preko web Claude) potvrdio na Vercel preview commit 65a5fac: build zelen (TS2835 nestao), admin smoke prošao (login + Porudžbine/Meni/Korisnici/Podešavanja, bez 500)
**SCOPE_DRIFT:** none (file-level — 7 = 7 EXPECTED).
  SCOPE_DRIFT (acknowledged): orphan helper/type cleanup beyond plan ZABRANA.
  ZABRANA ("ne dirati lokalne helpere") bila na pogrešnoj premisi (ROADMAP
  "api/** eslint-ignored" netačno). Lint gate prinudio uklanjanje mrtvog koda
  koji je refaktor osirotio. EXPECTED-FILES nepromenjen. Dokumentovano u commit 3e55179.
**Notes:**
  - 5 duplikata (getAdminFromDb ×4 byte-identičnih + admin-me getAdminRoleFromDb varijanta) → 1 parametrizovani shared modul
  - Parametrizovan: pozivalac prosleđuje svoj per-endpoint supabase klijent → X-Client-Info očuvan (audit §6)
  - Unifikovano telo = guarded varijanta → behavior-preserving za admin-me (admin-me.ts vraća 401 na prazan email PRE poziva → empty-guard mrtva grana tamo)
  - Self-contained inline helperi → audit §7 step-1 (niži helperi) ostaje zaseban budući batch
  - **R2 materijalizovao se:** lokalni `tsc -b` (Bundler) zelen ali Vercel `@vercel/node` (nodenext) zahtevao `.js` ekstenziju → TS2835 build fail na 5 handlera; fix commit 65a5fac (`./_shared/admin-auth` → `.js`). STRICT preview smoke uhvatio ono što su sva 4 lokalna gate-a propustila → L6.
  - isAdminEmailDb (boolean varijanta, 3 fajla: admin-orders/admin-update-order-status/admin-resend-telegram) namerno odloženo → **B10.1** (novo u ROADMAP)
  - Net -200 linija
  - **Faza C — B10 DONE ✓ (Faza C KOMPLETNA)**

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
