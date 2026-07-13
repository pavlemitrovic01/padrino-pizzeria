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

**Poslednji završen:** B18 — Idempotent Telegram notifikacija — fix duplog slanja kod kartice (2026-07-12, STRICT). Prethodni: B17 — Free (zero-price) addon validation fix + Vercel function-cap fix (2026-06-18, STRICT)
**Sledeći:** Merge `batch/b18-telegram-idempotency` → main za production deploy (migracija VEĆ aplicirana na prod). Posle deploya E2E smoke: test-mode kartica → tačno 1 Telegram poruka (i cash → 1). (B17 već merged: 25e5178.) Preostali audit findings u ROADMAP-u: L2/L5/L6/M1/M2/N1-N3 kao reference, ne spec.
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
- G2.1 (Extract BillingFields — BillingFields.tsx) — DONE 2026-05-20
  (STRICT; 2 fajla, +52/-38 LOC; SHA 453c9a7; BillingFields.tsx NEW (52 LOC);
  CartDrawer.tsx LOCK (-38 LOC inline → <BillingFields /> call site); 7 props;
  internal paymentJsRequested null-gate; byte-identical JSX from CartDrawer 1712-1749;
  lock zone NETAKNUT (submit/tokenize/init useEffect/Bankart return); Vercel Build Logs
  clean + smoke PASS; per-batch branch batch/g2.1-billing-fields)
- G2.2 (Extract CardFields — CardFields.tsx) — DONE 2026-05-20
  (STRICT; 2 fajla, +176/-121 LOC; SHA 8ecd75d; CardFields.tsx NEW (153 LOC);
  CartDrawer.tsx LOCK (-121 LOC inline); 20 props; no top-level null-gate;
  inline transforms preserved (R8); DOM IDs/CSS via props (R3/R4);
  G2 fully done (PaymentSection extracted); Vercel Build Logs clean + smoke PASS;
  per-batch branch batch/g2.2-card-fields)
- G3 (Extract CartView — item list / qty / addons / sauces / drinks) — DONE 2026-05-20
  (STRICT; 2 fajla, +362/-286 LOC net; SHA d2ae678; CartView.tsx NEW (362 LOC);
  CartDrawer.tsx LOCK net −319 → 1848 LOC; 26 props; gate at call site (view==="cart");
  drinksScrollRef moved to CartView-internal useRef (react-hooks/refs v7.0.1 constraint);
  scroll restoration migrated to CartView click handlers; restoreDrinksScroll removed;
  Vercel Build Logs clean + smoke PASS; per-batch branch batch/g3-cart-view)
- G4.0 (CartDrawer structural recon — doc-only) — DONE 2026-05-20
  (STRICT recon; 2 fajla, +134/-3 LOC; SHA 7c42e40; DECISIONS.md full inventar
  1848 LOC CartDrawer.tsx; G4.1..G4.6 split predlog sa risks; ROADMAP drift fix
  "1898→1612" → "net −319, 1848"; realistic final LOC ~550-650 after G4.1-G4.6)
- G4.1 (Extract bankartReturnStorage helpers → src/lib/) — DONE 2026-05-20
  (STRICT; 3 fajla, +145/-132 LOC; SHA f5cd267 / merge 666fe4b;
  src/lib/bankartReturnStorage.ts NEW 133 LOC (11 exports: 3 types + 1 const + 7 functions);
  CartDrawer.tsx LOCK 1848→1730 (net −118, recon predicted −95 — favorable variance);
  CartDrawerSuccessView.tsx LOCK BankartOrderPaymentStatus dedup (F4.2 pattern);
  byte-identical relocation, no behavior change; Vercel Build Logs clean + smoke PASS;
  per-batch branch batch/g4.1-bankart-return-storage)
- G4.5 (Extract useSuccessState hook → src/hooks/cart/) — DONE 2026-05-21
  (STRICT; NAJOPASNIJI G4 batch; 2 fajla, +356/-276 LOC; SHA b7d989d;
  useSuccessState.ts NEW 334 LOC (16 returns: 9 state + 3 setters + 4 actions);
  CartDrawer.tsx LOCK 1310→1056 (net −254, recon target ~−255 hit on the nose);
  applySuccessUiState 62 LOC + Bankart return useEffect 109 LOC byte-identical relocation;
  closeBankartReturnFlow encapsulates timer+storage+url ops; Pavle smoke Scenario A
  (card_redirect → return → paid) PASS — drawer auto-open, polling visible, status transition,
  URL/storage cleared)
- G4.4 (Extract useBankartPaymentJs hook → src/hooks/cart/) — DONE 2026-05-21
  (STRICT; 2 fajla, +222/-167 LOC; SHA 20a05f0;
  useBankartPaymentJs.ts NEW 204 LOC (7 returns + 3 constants exports);
  CartDrawer.tsx LOCK 1459→1310 (net −149, recon predicted ~−150 — favorable);
  init useEffect 117 LOC byte-identical relocation; Bankart test-mode transaction PASS;
  Opus pre-execution audit caught 3 plan corrections — 7-value API not 9, hook lokacija ~139, unused imports cascade)
- G4.3 (Extract useDeliveryZone hook → src/hooks/cart/) — DONE 2026-05-21
  (STRICT; 2 fajla, +177/-103 LOC; SHA 8e35c58;
  useDeliveryZone.ts NEW 158 LOC (16 returns: zone state + memos + click-outside);
  CartDrawer.tsx LOCK 1543→1459 (net −84); Vercel Build Logs clean + smoke PASS)
- G4.2 (Extract useCheckoutForm hook → src/hooks/cart/) — DONE 2026-05-20
  (STRICT; 2 fajla, +417/-251 LOC; SHA 98bb4ab / merge 49a533b;
  src/hooks/cart/useCheckoutForm.ts NEW 352 LOC (11 input params → 30 returns:
  10 fields/setters/trims + 7 useMemo validations + 12 errors + 11 shouldValidate
  flags + 2 billing handlers + validation hint + supabase defaults loader effect);
  CartDrawer.tsx LOCK 1729→1543 (net −186, predicted 1480-1530 — 13 LOC above ceiling
  due to verbose destructure block 65 LOC vs estimate 33, cosmetic);
  pre-flight false-start: /close invoked before execution, agent REFUSED + executed
  correctly after re-confirmation; first src/hooks/cart/ module — directory established;
  Vercel Build Logs clean + smoke PASS; per-batch branch batch/g4.2-use-checkout-form)
- G4.3 (Extract useDeliveryZone hook → src/hooks/cart/) — DONE 2026-05-21
  (STRICT; 2 fajla, +177/−103 LOC; SHA 8e35c58;
  useDeliveryZone.ts NEW 158 LOC; CartDrawer.tsx LOCK 1543→1459 (net −84))
- G4.4 (Extract useBankartPaymentJs hook → src/hooks/cart/) — DONE 2026-05-21
  (STRICT; 2 fajla, +222/−167 LOC; SHA 20a05f0;
  useBankartPaymentJs.ts NEW 204 LOC; CartDrawer.tsx LOCK 1459→1310 (net −149);
  Bankart test-mode card transaction PASS)
- G4.5 (Extract useSuccessState hook → src/hooks/cart/) — DONE 2026-05-21
  (STRICT; NAJOPASNIJI G4 batch; 2 fajla, +356/−276 LOC; SHA b7d989d;
  useSuccessState.ts NEW 334 LOC; CartDrawer.tsx LOCK 1310→946 post-extract;
  Bankart card_redirect → return → paid polling PASS)
- G4.6 (Extract useCatalogData hook + CheckoutView) — DONE 2026-05-21
  (STRICT; 3 fajla, +700/−448 LOC; SHA 17025f4 / merge b5ec256;
  useCatalogData.ts NEW 136 LOC; CheckoutView.tsx NEW 429 LOC;
  CartDrawer.tsx LOCK 946→688 (net −258); Faza G DONE ✓)
- **Faza G — DONE** ✓ (CartDrawer 688 LOC — target ~550-650 achieved)
- I1 (RLS admin_users membership policy) — DONE 2026-05-21
  (STRICT; 2 fajla +1 drift; SHA 88c3967;
  orders RLS: 3 _by_email policies → 3 membership-based + allow_self_read na admin_users;
  F2 iz B14 audita CLOSED; hardkodovani email uklonjen iz DB)
- I2 (CORS allowlist — LOCK handlers) — DONE 2026-05-21
  (STRICT; 6 fajlova, +305/-49; SHA 5b0ff6c;
  NEW api/_shared/cors.ts + cors.test.ts; applyCors() env-driven, VERCEL_URL preview;
  reflect-any-origin closed u create-order/bankart-order-status/telegram-new-order;
  ALLOWED_ORIGINS=https://padrinobudva.com set u Vercel All Environments;
  scope corrected pre-plan: 11 handlera, split I2+I2.1; 22 new test cases, 206 total)
- I2.1 (CORS allowlist — admin handlers) — DONE 2026-05-21
  (STANDARD; 8 fajlova, +16/-80; SHA 3979261;
  reflect-any-origin closed u svih 8 admin handlera; allowHeaders includes authorization;
  CORS coverage complete: svih 11 handlera sada koriste applyCors())
- I2.2 (Hobby plan slot reclaim) — DONE 2026-05-21
  (STRICT; 6 fajlova, +0/-0 net (2 delete + 2 modify + 2 client update); SHA 5b9d716;
  admin-menu-image→admin-menu (?op=image) + admin-resend-telegram→admin-orders (?op=resend-telegram);
  count: 13→10; L8 added)
- I3 (Logger server sink) — DONE 2026-05-21
  (STANDARD; 2 fajla, +161/-2; SHA 8f9a0a8;
  NEW api/log.ts; error-level events fire-and-forget → Vercel Runtime Logs;
  localStorage ring buffer nepromijenjen)
- I4 (Build SHA in monitoring init) — DONE 2026-05-21
  (LEAN; 3 fajla; SHA da8145b;
  VERCEL_GIT_COMMIT_SHA → VITE_BUILD_SHA → initClientMonitoring version;
  exit criteria #5 closed; Faza I DONE ✓)
- **Faza I — DONE** ✓
- H1 (AdminOrders lib extraction) — DONE 2026-05-21
  (STANDARD; 2 fajla, +565/-528 LOC net; SHA 916e017;
  NEW src/lib/adminOrdersLib.ts 565 LOC; AdminOrders.tsx 1165→637;
  28 helper fns + 3 API fns + 7 types/consts; Vercel Build Logs clean)
- H2 (AdminMenu lib extraction) — DONE 2026-05-22
  (STANDARD; 2 fajla, +449/-414 LOC net; SHA 0c96ced;
  NEW src/lib/adminMenuLib.ts 449 LOC; AdminMenu.tsx 1353→939;
  types/helpers/API fns/editor helpers extracted; 939 LOC iznad 800 — H2.1 needed)
- H2.1 (AdminMenu component split) — DONE 2026-05-22
  (STRICT; 3 fajla; SHA a379a06;
  NEW MenuItemList.tsx 179 LOC + MenuEditorPanel.tsx 372 LOC; AdminMenu.tsx 939→548;
  exit criterion #1 CLOSED for AdminMenu; Faza H DONE ✓)
- J1 (TEMPLATE.md + canonical env manifest) — DONE 2026-05-22
  (STANDARD doc-only; 2 fajla; TEMPLATE.md NEW 246 LOC + .env.example +5 LOC;
  exit criterion #8 CLOSED; 26 env vars grep-verified; ALLOWED_ORIGINS drift fixed;
  self-score 8.5/10 — J2 deferred pending app#2)
- W8 (ROADMAP K–O friction-reduction program definition) — DONE 2026-05-23
  (LEAN doc-only; 1 fajl ROADMAP.md +103/-3 LOC; reframed Current Phase
  Refactor-to-9 A–J "COMPLETED"; NEW K–O sekcija — audit findings, strategic
  LOCK "friction reduction NOT redesign", 9 hard + 3 soft exit criteria,
  Faza K [K1 GA4 instrumentation], Faza L [L1-L6 mobile friction critical],
  Faza M [M1 hero copy locked Pavle 2026-05-23 "PIZZA · BUDVA · DOSTAVA"
  + M2 menu drawer], Faza N [N1-N3 conversion engine conditional], Faza O
  [data-triggered, pre-empty]; CardFields.tsx + CartView.tsx promovisani
  u lock zone za K–O period; ROADMAP 190→290 lines / cap 600; self-score
  target 8.0/10 UX; K1 next)
- K1 (GA4 enhanced ecommerce events) — DONE 2026-05-23
  (STRICT; 5 fajlova, +161/-1; Ga4CartItem type + AnalyticsEventParams extended;
  trackAddToCart/remove/beginCheckout/addPaymentInfo/purchase helpers;
  CartProvider LOCK: add_to_cart+remove_from_cart+add_payment_info call sites;
  CartDrawer LOCK: begin_checkout u proceedToCheckout, totalCents u cash submit;
  useSuccessState: hasFiredPurchaseRef dedup, purchase u oba flow-a;
  5 unit testova + jsdom env; GA4 DebugView smoke PASS; Faza K DONE ✓)
- W9 (Workflow housekeeping post K–O ROADMAP) — DONE 2026-05-23
  (LEAN; 4 sub-items zero-risk; (1) /plan + /audit skills `model: opus`
  frontmatter override — eliminira manual /model switch; (2) CONTEXT.md
  doc drift fix — "3 test files" → 17 tests + 206 testova + CardFields/CartView
  dodati u Lock zone tabelu sa K–O conditional note; (3) /kickoff Step 3.5
  "lock zone recent touches" enhancement + output Quick health red dodat;
  (4) 10 lokalnih + 9 remote merged batch/* granica obrisane (sve verifikovano
  merged u main; i2/i2.1/i2.2 lokalno advanced od remote zbog squash merge — force
  delete safe); K1 next)
- W10 (/plan SKILL.md simplification — legacy "Claude Code prompt" removed) — DONE 2026-05-23
  (LEAN; 1 fajl .claude/skills/plan/SKILL.md; description ažurirano (sad eksplicitno
  pominje BATCH-ID/TIER/EXPECTED-FILES + /close SCOPE_DRIFT use); Role sekcija dobila
  "Workflow context" pasus koji eksplicitno markira plan dokument kao deliverable
  (ne odvojen execution prompt); Step 4 "DO NOT write Claude Code prompt" →
  "DO NOT begin execution"; Step 5 "On approval, write Claude Code prompt" →
  "On approval, begin execution in same session"; anti-pattern lista ažurirana —
  legacy ChatGPT→Composer handoff pattern eksplicitno ozvučen kao dead; /close
  SKILL.md verifikovan clean od "prompt" reference (zero matches); L1 next)
- W11 (Workflow tooling completion — /execute + proactive rules + recon + parallel + review reco) — DONE 2026-05-23
- L1 (Hamburger menu z-index fix + logo hide on mobile dropdown open) — DONE 2026-05-23
  (LEAN; 1 fajl src/components/Navbar.tsx, +7/-2; SHA 3a5dfe0; mobile dropdown wrapper
  `relative z-[60]` iznad logo z-[55] + logo conditional opacity-0 + pointer-events-none
  kad mobileOpen=true [md:opacity-100 preserves desktop landscape edge]; transition-opacity
  200ms + aria-hidden=true; real phone smoke (Huawei hotspot) + DevTools mobile view PASS;
  prvi Faza L batch — friction reduction program live)
- L3 (Trust messaging reduction 3→1 blocks in CardFields) — DONE 2026-05-23
  (LEAN; 1 fajl src/components/CardFields.tsx, +14/-22 net -8 LOC; SHA a2bbfea;
  3 trust signala konsolidovana u 1 kompaktan red "🔒 Plaćanje kroz Bankart —
  sigurno i šifrovano" + inline VISA/Mastercard/Maestro mini-pills [style-mirror
  iz Footer.tsx PAYMENT_BADGES, inline duplicate ne abstrakcija]; dev-internal
  3-variant dynamic subtitle uklonjen [paymentJsRequested grananje copy nije bio
  user-actionable]; "Secure entry" label + bottom "Bankart iframe polja"/"CVV se ne čuvaju"
  pills uklonjeni; payment logic LOCKED; DevTools mobile view smoke PASS; bonus
  observation: paymentJsRequested=false lokalno [env not set] → L2 prereq ops step
  required pre iframe styling)
- L4 (Cart item editor mobile compact) — DONE 2026-05-23
- W12 (ROADMAP K-O reframe — audit findings reference, ne queue) — DONE 2026-05-23
- L7 (Hero + Navbar redesign — logo lockup + solid backdrop + hero copy swap) — DONE 2026-05-24
  (STANDARD; 5 fajlova, +17/-51 net -34 LOC; SHA cc96bd0;
  Navbar: isSticky+scroll useEffect removed → solid bg-black/70 backdrop-blur-md uvek;
  logo prop h-9 w-9 → h-16 sm:h-20 w-auto (responsive aspect-driven); navbar h-20→h-24;
  aria-label "Padrino" → "Padrino Pizzeria početna";
  Hero: "Premium pizza u Budvi" p-kicker pill + "Premium picerija..." paragraf
  + 3 trust pills (Brza dostava/Svježe/Online) sve uklonjeni; H1 split color
  bela "Padrino" + gold #f2b400 "Pizzeria"; novi subcopy "pizza · delivery · budva"
  letterspaced uppercase;
  ChefHatLogo (mid-execute scope expansion per Pavle approval): h-[170px] +
  translate-y[8px] + -translate-x[14px] magic numbers removed →
  h-full w-auto object-contain natural scaling; default container sizing
  h-16 w-[210px] sm:w-[240px] removed (Tailwind class conflict cleanup);
  overflow-hidden removed (image fituje, ne overflow-uje);
  public/logo/chef-hat-stroke.{png,webp} (Pavle manual asset replacement):
  PNG 1024x1536 2MB → 463x346 24KB tight crop; WebP 337KB → 35KB;
  logo sad fituje navbar bez praznine;
  SCOPE_DRIFT acknowledged 5 vs 2 planned — ChefHatLogo + 2 asset files;
  M1 partially advanced — Hero.tsx "premium" grep clean, ostali "premium"
  pojave u About/Menu/index.html ostaju za sledeći M1 batch;
  /code-review skip per Pavle direct /close; Pavle smoke localhost:5173 PASS
  za logo proporcije i hero copy na mobile + desktop)
  (LEAN doc-only; 1 fajl workflow/projects/padrino/ROADMAP.md +19/-1; SHA 05d8134;
  Current Phase queue framing removed, Faza L heading W12 reframe note,
  K-O strategic notes prvi bullet "screenshot-first workflow", NEW
  "ROADMAP scope" sekcija sa rationale; UX iteracije ne idu kroz ROADMAP
  kao queue — screenshot-first razgovor pre /plan-a; ROADMAP ostaje za
  multi-batch tehničke programe sa dependencies (Faze A-J šablon);
  trigger: Pavle pitao "da li nam ovaj mini redesign otezava roadmap" —
  W8 napravio L5/L6/M2/N1-N3 solution-specs bez screenshot input-a;
  cap 290→308/600 OK; ROADMAP-row update N/A — W batch nema sopstveni red)
  (STRICT; 3 fajla, +3/-28 net -25 LOC; SHA e4def5b;
  CartView.tsx -5 LOC [lineTotalCents + "Ukupno: X €" item pill removed;
  trailing h-3→h-32 wrapped u canSubmit ternary post code-review CONFIRMED fix];
  CartDrawer.tsx -5 LOC [header py-4 sm:py-5 → py-2.5 sm:py-3; X button red→white/15
  + white/60 neutral; "Nazad na meni" button + wrapper div removed, handleGoToMenu
  RETAINED za success-view + empty-cart paths]; CheckoutView.tsx -15 LOC [drugi
  SUBTOTAL/DOSTAVA/UKUPNO 3-pill summary inside selectedDeliveryZone conditional
  removed, top "PREGLED" 3-pill ostaje single source]; per-batch branch
  batch/l4-cart-mobile-compact; code-review 1 CONFIRMED+fixed + 2 PLAUSIBLE
  deferred [qty>1 per-line subtotal product decision; X contrast WCAG borderline
  aria-label retained]; Pavle screenshot pre-execute proširio scope sa 2→3 fajla
  otkrivši CheckoutView drugi 3-pill duplikat — recon-depth tema već u W4/W5 noti)
  (LEAN; 5 sub-items koherentni pod temom "workflow tooling completeness":
  (1) NEW .claude/skills/execute/SKILL.md (model: sonnet) — Opcija B (real value):
      pre-flight gates [no plan / dirty tree / active batch], STRICT auto-branch,
      scope-aware editing sa SCOPE_DRIFT guard, hand-off poruka ka /close;
      komplementaran sa /plan (Opus) — sve u istoj sesiji bez manual /model switch;
  (2) CLAUDE.md Session Hygiene → 8 dodatnih proactive triggers (post-/plan suggest
      /execute, post-/execute STRICT suggest /code-review, post-payment/Bankart suggest
      /security-review, pre-/plan na dug doc suggest /doc-lens, post-/close + nepovezan
      task suggest /clear, /audit drift findings, end-of-session /usage); explicit
      "Workflow skill suggestions" sekcija dodato;
  (3) /plan SKILL.md Step 1.5 — optional pre-plan scout (Haiku) recon kad scope nije
      jasan; ~70% štednja Opus context tokens; eksplicitno "Skip when" usloven;
  (4) /audit SKILL.md Step 1 paralelizacija — 2 Explore agenta (build-health + drift-checks)
      paralelno umesto sekvencijalno; Opus thread synthesizes oba reporta umesto grep
      output dump-a;
  (5) /close SKILL.md Step 0.5 — pre-close STRICT recommendation za /code-review
      (+ /security-review za payment/Bankart/RLS touch); ne refuses, ne blokira —
      recommendation only;
  Total: 1 NEW skill + 4 skill edits + CLAUDE.md edit; STATE/LOG entry; L1 next)
- L8.3 (Mobile menu drawer full-page — remove floating overlay + transparency, back arrow) — DONE 2026-05-25
  (STANDARD; 1 fajl src/sections/Menu.tsx, +8/-8; SHA e70fdbb;
  outer container px/pb/pt removed → edge-to-edge mobile; inner drawer mobile-default
  rounded-none/border-0/bg-[#0a0a0a]/shadow-none + sm: prefixes restore glass modal;
  menu.webp opacity-30 mobile / sm:opacity-[0.82]; close button left-3 top-3 +
  chevron-left SVG "Nazad" / sm:right-4 sm:top-4; header pt-16 mobile clearance;
  L8.2 sheet integration NETAKNUT; pre-flight gotcha L8.2 nije bio merged →
  stash+ff-merge+pop recovery zero-conflict; no SCOPE_DRIFT)
- L8.2 (Mobile detail sheet — slide-up bottom sheet sa addonima + CartProvider re-add merge fix) — DONE 2026-05-25
  (STRICT; 3 fajla; SHA 0b46ba8; per-batch branch batch/l8.2-mobile-detail-sheet;
  src/components/MenuItemDetailSheet.tsx NEW 442 LOC — AnimatePresence wrapper + SheetView
  (drag-y close, body scroll lock, Escape, keyed remount via item.id); QtyStepper +
  AddonSection sub-components; pizzaQty (1-10) + addons Map + note (200ch); useCatalogData
  hook za sauces/drinks/addons; confirmedRef double-tap guard tokom ~300-400ms exit animacije;
  Menu.tsx +43/-44: onAdd dead code REMOVED → onConfirmFromSheet wrapper (addToCart +
  setSelectedItem(null) + markAdded + toast, drawer stays open); Escape guard u Menu za
  sheet precedence (if (selectedItem) return); card click handlers setSelectedItem;
  SCOPE_DRIFT acknowledged: CartProvider.tsx LOCK ZONE (+43/-13) added u fix phase per
  code-review HIGH findings — addToCart existing-item branch silently discardovao pizzaQty>1
  i incoming addons (pre-existing dormant bug, postao visible kad sheet aktivirao path);
  fix: quantity +=incomingQty umesto +1, addons union by id sum qty (Map merge, 99 cap),
  note prefer incoming non-empty else preserve, trackAddToCart quantity item-driven;
  code-review (recall-biased) returned 5 verified findings — 2 CONFIRMED HIGH + 1 PLAUSIBLE
  MED FIXED in-batch, 2 MED deferred (scroll-lock race unreachable; useCatalogData
  double-fetch perf only); Pavle localhost smoke 3-fix scenarios PASS (qty merge 1→3→5,
  addon merge, double-tap guard) + base sheet flow PASS; LESSONS cap 7/7 unchanged;
  pattern note: pre-existing dormant bug becomes visible when new feature activates
  the dormant code path — code-review during STRICT batches catches these before they
  ship; smoke alone wouldn't, re-add data loss is silent)

**Workflow v3 status:** live on main branch. workflow-v3-init merged
(fc05439) and removed 2026-05-11. Default model: direct commits on main
with preview-then-approve flow. Per-batch branches only for STRICT-tier
code-touching batches (e.g., src/**, api/**); doc/audit batches direct.
63 batches completed (B1 no-op, B2 audit, B3 schema baseline,
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
F4.2 cartDrawerHelpers + publicBusinessSettings config dedup,
G1 Extract CheckoutForm name/phone/address inputs,
G2.0 G2 PaymentSection forensic recon (doc-only),
G2.1 Extract BillingFields BillingFields.tsx,
G2.2 Extract CardFields CardFields.tsx,
G3 Extract CartView item list qty controls addons sauces drinks,
G4.0 CartDrawer structural recon doc-only,
G4.1 Extract bankartReturnStorage helpers src lib,
G4.2 Extract useCheckoutForm hook src hooks cart,
G4.3 Extract useDeliveryZone hook src hooks cart,
G4.4 Extract useBankartPaymentJs hook src hooks cart,
G4.5 Extract useSuccessState hook src hooks cart,
G4.6 Extract useCatalogData hook + CheckoutView component,
I1 RLS admin_users membership policy,
I2 CORS allowlist LOCK handlers,
I2.1 CORS allowlist admin handlers,
I2.2 Hobby plan slot reclaim,
I3 Logger server sink,
I4 Build SHA in monitoring init,
H1 AdminOrders lib extraction,
H2 AdminMenu lib extraction,
H2.1 AdminMenu component split,
K1 GA4 enhanced ecommerce events,
L8.0 Mobile menu + add-to-cart flow mapping recon doc-only,
L8.1 Mobile menu redesign Topseller strip + list rows + halal badge,
L8.2 Mobile detail sheet slide-up bottom sheet sa addonima + CartProvider re-add merge fix,
L8.3 Mobile menu drawer full-page remove floating overlay + transparency back arrow,
L8.4 CartView display-only refactor + edit-reopen flow — STRICT — 2026-05-25,
L9 Delivery sekcija redesign kompresija overlay top fade — STANDARD — 2026-05-26,
L10 About sekcija redesign cinematic asymmetric layout Cormorant/Inter — STANDARD — 2026-05-27,
L11 Contact sekcija redesign Pravac A Hero poziv — STANDARD — 2026-05-27,
L12 Footer sekcija redesign Pravac A Editorial Signoff — STANDARD — 2026-05-27,
L13 Addon sauce drink slike u pillovima Sheet + CartView — STRICT — 2026-05-27,
L14 Favicon + Google search icon gold circle dark chef hat — STANDARD — 2026-05-27,
L15 Menu modal polish + checkout PREGLED removal + mobile chef hat logo — LEAN→STRICT effective — 2026-05-28,
L16 Remove "Po pravilima"/"Besplatna" delivery pill from checkout — LEAN — 2026-05-28,
L17 Menu modal remove desktop scroll + uniform card heights — LEAN — 2026-05-31,
B17 Free zero-price addon validation fix + Vercel function-cap fix — STRICT — 2026-06-18,
B18 Idempotent Telegram notifikacija — fix duplog slanja kod kartice — STRICT — 2026-07-12).
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
