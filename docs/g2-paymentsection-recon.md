# G2 PaymentSection Forensic Recon

**Date:** 2026-05-20
**Tier of source work:** STRICT (lock zone, real-money path)
**Source state:** Post-G1 merge (main @ e258fc3)
**CartDrawer.tsx LOC:** 2293 (post-G1)
**Purpose:** Pre-plan forensic mapping for G2 PaymentSection extraction. Mirrors `cartdrawer-extraction-audit.md` pattern that guided Phase 1 helpers extraction.

---

## 1. Strategic decisions (locked 2026-05-20)

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Split strategy** | G2.1 (BillingFields) + G2.2 (CardFields) | Two smaller STRICT batches reduce per-batch lock-zone risk; each smoke-gated independently |
| **DOM ID/CSS handling** | Props passing (Option A) | Constants stay in CartDrawer; PaymentSection sub-components receive `numberDivId`, `cvvDivId`, `polishCss` as props. No new modules. |
| **G1 merge timing** | Merge before G2 (DONE 2026-05-20) | Clean baseline; clean per-batch rollback |
| **Lifecycle (init useEffect) lift** | DEFERRED beyond G2 | PaymentJS init useEffect (~117 LOC) stays in CartDrawer for G2.1/G2.2. Future G2.3+ may lift to `usePaymentJsLifecycle` hook if desired. |

---

## 2. PaymentSection — JSX boundaries

| Lines | Content | Renders when |
|-------|---------|--------------|
| 1680 | "Način plaćanja" panel wrapper `<div className="mt-4">` | Always (view=checkout) |
| 1681 | Label "Način plaćanja" | Always |
| 1683-1702 | Cash/Card radio buttons grid | Always |
| 1704-1708 | Explanatory text (`paymentJsRequested ? "...checkoutu" : "...vodi na..."`) | Always |
| **1710-1873** | **`paymentMethod === "card" ? (...) : null` ← G2 EXTRACTION ZONE** | Card mode |
| 1711 | `<>` Fragment open | Card mode |
| **1712-1749** | **BillingFields panel "Podaci za naplatu" — G2.1 SCOPE** | `paymentJsRequested === true` |
| 1751-1769 | "Sigurna Bankart polja" status panel | Card mode (inside conditional) |
| **1771-1869** | **PaymentJS UI (PaymentJsRequested gate) — part of G2.2 SCOPE** | `paymentJsRequested === true` |
| 1773 | `<style>{BANKART_PAYMENTJS_POLISH_CSS}</style>` | paymentJsRequested=true |
| 1775-1806 | Email + Cardholder grid (2 cols) | paymentJsRequested=true |
| 1808-1859 | Detalji kartice panel: Number iframe + Mesec/Godina/CVV grid | paymentJsRequested=true |
| 1817 | `<div id={BANKART_PAYMENTJS_NUMBER_DIV_ID} />` — iframe mount | paymentJsRequested=true |
| 1855 | `<div id={BANKART_PAYMENTJS_CVV_DIV_ID} />` — iframe mount | paymentJsRequested=true |
| 1861-1864 | "Bankart iframe polja" info chips | paymentJsRequested=true |
| 1866-1868 | paymentJsLoading + paymentJsInitError + paymentJsStateError display | paymentJsRequested=true |
| 1872 | `</>` Fragment close | — |
| 1873 | `) : null}` close conditional | — |
| 1874 | `</div>` closes "Način plaćanja" wrapper | — |

**G2.1 = lines 1712-1749 (~38 LOC).** BillingFields. Internal `paymentJsRequested` gate returns null when false.

**G2.2 = lines 1751-1869 (~120 LOC).** CardFields. Renders status panel always; PaymentJS UI block gated internally by `paymentJsRequested`.

**Radio buttons (1683-1708) STAY in CartDrawer** — control parent state `paymentMethod`.

---

## 3. State surface (CartDrawer 255-345) — ALL stays in CartDrawer

| Var | Line | Type | Used by |
|-----|------|------|---------|
| `customerEmail` | 259 | useState | G2.2 + submit |
| `billingCity` | 260 | useState (default DEFAULT_BILLING_CITY) | G2.1 + submit |
| `billingPostcode` | 261 | useState (default DEFAULT_BILLING_POSTCODE) | G2.1 + submit |
| `cardholder` | 262 | useState | G2.2 + submit tokenize |
| `expMonth` | 263 | useState | G2.2 + submit tokenize |
| `expYear` | 264 | useState | G2.2 + submit tokenize |
| `paymentJsControllerRef` | 322 | useRef | Init useEffect + submit tokenize |
| `billingCityTouchedRef` | 323 | useRef | handleBillingCityChange + loadCheckoutDefaults |
| `billingPostcodeTouchedRef` | 324 | useRef | handleBillingPostcodeChange + loadCheckoutDefaults |
| `paymentJsReady` | 325 | useState | Init useEffect + render |
| `paymentJsLoading` | 326 | useState | Init useEffect + render |
| `paymentJsInitError` | 327 | useState | Init useEffect + render |

**Derived (lines 318-321) — STAY in CartDrawer:**
- `paymentJsPublicKey` = `String(import.meta.env.VITE_BANKART_PAYMENTJS_PUBLIC_KEY ?? "").trim()`
- `paymentJsFeatureEnabled` = `envFlagEnabled(import.meta.env.VITE_BANKART_PAYMENTJS_ENABLED)`
- `paymentJsRequested` = `paymentMethod === "card" && paymentJsFeatureEnabled && !!paymentJsPublicKey`
- `paymentJsMissingKey` = `paymentMethod === "card" && paymentJsFeatureEnabled && !paymentJsPublicKey`

**Handler funcs — STAY in CartDrawer:**
- `handleSetPaymentMethod(m)` (329)
- `handleBillingCityChange(value)` (333) — touched-ref + setter
- `handleBillingPostcodeChange(value)` (338) — touched-ref + setter

---

## 4. PaymentJS init useEffect — STAYS in CartDrawer (lines 417-534, ~117 LOC)

- **Trigger deps:** `[isOpen, view, paymentMethod, paymentJsFeatureEnabled, paymentJsPublicKey]`
- **Logic:**
  1. Guard: `shouldInit = isOpen && view==="checkout" && paymentMethod==="card" && featureEnabled && publicKey`
  2. If not → dispose controller, reset 3 state vars, return
  3. If yes → dispose stale controller, set loading, call `createBankartPaymentJs({publicKey, numberDivId, cvvDivId})`
  4. .then: setup styles (50 LOC inline style objects at 450-500), focus/blur handlers, setReady(true)
  5. .catch: setInitError
  6. Cleanup: dispose controller, reset ready
- **DOM IDs referenced (439-440):** `BANKART_PAYMENTJS_NUMBER_DIV_ID`, `BANKART_PAYMENTJS_CVV_DIV_ID`
- **Dispose call sites (6 total):** lines 382, 421-422, 431-432, 530-531, 923-924, 1001-1002

---

## 5. Bankart return useEffect — SEPARATE CONCERN (lines 1010-1118, ~108 LOC)

**Not part of G2.** Handler for post-Bankart-hosted-page redirect return:
- Trigger deps: `[openCart]`
- Reads URL params via `getBankartReturnParams()`
- Polls `/api/bankart-order-status` until final status
- Calls `applySuccessUiState()` for UI updates
- Uses helper functions at module top (lines 110-209): isPaymentStatusValue, isFinalPaymentStatusValue, getBankartReturnParams, readBankartReturnStorage, writeBankartReturnStorage, clearBankartReturnStorage, cleanBankartReturnUrl

**Future:** Could lift to `useBankartReturn` hook in a post-G2 batch.

---

## 6. Submit tokenize path — STAYS in CartDrawer (lines 1295-1297, 1358-1372)

```ts
// Guard at 1295:
if (paymentJsLoading || !paymentJsReady || !paymentJsControllerRef.current) {
  setSubmitError("Kartična polja se još učitavaju.");
  return;
}

// Tokenize at 1358-1372 (paymentMethod==="card" && paymentJsRequested):
const controller = paymentJsControllerRef.current;
const tokenizeResult = await controller.tokenize({
  card_holder: cardholderTrim,
  month: expMonthTrim.padStart(2, "0"),
  year: expYearTrim,
  email: customerEmailTrim || undefined,
});
payload.transaction_token = tokenizeResult.token;
```

**ZABRANE for G2.x:** NEVER touch this submit logic. ANY change here = SCOPE_DRIFT.

---

## 7. Module-top constants & helpers

| Identifier | Line | Usage | G2 fate |
|-----------|------|-------|---------|
| `BANKART_RETURN_STORAGE_KEY` | 87 | sessionStorage helpers (return flow) | STAY (Bankart return concern) |
| `BANKART_PAYMENTJS_NUMBER_DIV_ID` | 88 | init useEffect + JSX | **G2.2: passed as prop from CartDrawer** |
| `BANKART_PAYMENTJS_CVV_DIV_ID` | 89 | init useEffect + JSX | **G2.2: passed as prop from CartDrawer** |
| `BANKART_PAYMENTJS_POLISH_CSS` | 90 | JSX `<style>` injection | **G2.2: passed as prop from CartDrawer** |
| `BankartOrderPaymentStatus` type | 58 | return useEffect + applySuccess | STAY |
| `BankartOrderStatusResponse` type | 60 | fetchBankartOrderStatus | STAY |
| `BankartReturnStorage` type | 79 | return useEffect | STAY |
| `isPaymentStatusValue` | 110 | return useEffect | STAY |
| `isFinalPaymentStatusValue` | 120 | return useEffect | STAY |
| `getBankartReturnParams` | 124 | return useEffect | STAY |
| `readBankartReturnStorage` | 150 | return useEffect | STAY |
| `writeBankartReturnStorage` | 181 | submit (card_redirect) | STAY |
| `clearBankartReturnStorage` | 190 | return useEffect | STAY |
| `cleanBankartReturnUrl` | 199 | return useEffect | STAY |

---

## 8. Validation surface — ALL stays in CartDrawer

**Memos (lines 295-312):**
- `isCustomerEmailValid` (295)
- `isCardholderValid` (300)
- `isExpMonthValid` (304)
- `isExpYearValid` (309)

**shouldValidate flags (lines 753-759):**
- shouldValidateCustomerEmail, shouldValidateBillingCity, shouldValidateBillingPostcode, shouldValidateCardholder, shouldValidateExpMonth, shouldValidateExpYear, shouldValidatePaymentJsState

**Error strings (lines 796-851):**
- billingCityError, billingPostcodeError, customerEmailError, cardholderError, expMonthError, expYearError, paymentJsStateError

---

## 9. Test surface — KRITIČAN GAP (L7 risk)

**CartDrawer.test.tsx C2 test config:**
- `mockUseCart` with `paymentMethod: "card"`
- PaymentJS feature flag OFF (env vars absent in tests)
- Asserts `mockCreateBankartPaymentJs.not.toHaveBeenCalled()` and `payload.transaction_token === undefined`

**Implication:** PaymentSection card-UI JSX (lines 1710-1873) **NEVER renders in tests** because `paymentJsRequested = paymentMethod==="card" && featureEnabled && publicKey`, and env vars are absent.

**⇒ ZERO direct test coverage for G2.1 and G2.2 extraction targets.**

**L7 (2026-05-18) applies:** false-green scenario — tests pass, UI could be broken. **Smoke is the ONLY meaningful gate.**

**Optional test net (G2.0.5 future batch):** Add a test that stubs `VITE_BANKART_PAYMENTJS_ENABLED=true` + `VITE_BANKART_PAYMENTJS_PUBLIC_KEY=test-key` and asserts iframe div ids present in rendered DOM. Pre-net for G2.1/G2.2 if false-green risk materializes.

---

## 10. G2.1 BillingFields — Props inventory (7 props)

```ts
export interface BillingFieldsProps {
  paymentJsRequested: boolean;     // internal gate: return null if false
  billingCity: string;
  billingPostcode: string;
  onBillingCityChange: (value: string) => void;
  onBillingPostcodeChange: (value: string) => void;
  billingCityError: string | null;
  billingPostcodeError: string | null;
}
```

**Internal gate behavior:** Component returns `null` when `!props.paymentJsRequested`. Cleaner contract than external gate in CartDrawer.

**Call site (CartDrawer):**
```jsx
{paymentMethod === "card" ? (
  <>
    <BillingFields
      paymentJsRequested={paymentJsRequested}
      billingCity={billingCity}
      billingPostcode={billingPostcode}
      onBillingCityChange={handleBillingCityChange}
      onBillingPostcodeChange={handleBillingPostcodeChange}
      billingCityError={billingCityError}
      billingPostcodeError={billingPostcodeError}
    />
    {/* G2.2 CardFields will go here next */}
    {/* Then current lines 1751-1869 remain inline until G2.2 */}
  </>
) : null}
```

---

## 11. G2.2 CardFields — Props inventory (~20 props)

```ts
export interface CardFieldsProps {
  // PaymentJS state flags (5)
  paymentJsRequested: boolean;
  paymentJsMissingKey: boolean;
  paymentJsLoading: boolean;
  paymentJsInitError: string | null;
  paymentJsStateError: string | null;

  // Form values (4 — billing already in G2.1)
  customerEmail: string;
  cardholder: string;
  expMonth: string;
  expYear: string;

  // Form setters (4)
  onCustomerEmailChange: (value: string) => void;
  onCardholderChange: (value: string) => void;
  onExpMonthChange: (value: string) => void;
  onExpYearChange: (value: string) => void;

  // Form errors (4)
  customerEmailError: string | null;
  cardholderError: string | null;
  expMonthError: string | null;
  expYearError: string | null;

  // DOM IDs + CSS (3 — passed from CartDrawer)
  numberDivId: string;
  cvvDivId: string;
  polishCss: string;
}
```

**Internal gate behavior:** CardFields always renders "Sigurna Bankart polja" status panel; PaymentJS UI sub-block gated internally by `paymentJsRequested`.

**Inline transformations (preserved in JSX):**
- `e.target.value.replace(/[^0-9]/g, "").slice(0, 2)` for expMonth
- `e.target.value.replace(/[^0-9]/g, "").slice(0, 4)` for expYear

---

## 12. Risk register

| Risk | Mitigation |
|------|-----------|
| **R1: PaymentSection UI broken, tests pass (L7 false-green)** | Smoke every increment. Bankart test-mode checkout. Side-by-side preview compare. |
| **R2: paymentJsRequested gate logic changed** | Byte-identical JSX copy. ZABRANA on modifying derived logic in CartDrawer (lines 318-321). |
| **R3: DOM ID references desync** | Props passing chosen (Option A) — CartDrawer remains source-of-truth for constants. G2.2 receives them as props. |
| **R4: CSS injection order** | `<style>{POLISH_CSS}</style>` must render BEFORE iframe mount divs. Preserved in JSX struct. |
| **R5: Tokenize submit-path regression** | NEVER touch tokenize logic at lines 1358-1372. Guard at 1295 stays. ZABRANA = SCOPE_DRIFT trigger. |
| **R6: Lock zone scope drift** | `git diff --stat` must show EXACTLY 2 files per batch (CartDrawer + new component). |
| **R7: Real money risk** | STRICT tier + per-batch branch + Vercel preview + Bankart test mode + manual smoke before merge. Optional staging acquirer test transaction. |
| **R8: Inline exp-month/year transform pattern** | Move with JSX byte-identical. Stay in CardFields JSX (not lift to handler). |
| **R9: Touched refs behavior** | `billingCityTouchedRef`/`billingPostcodeTouchedRef` stay in CartDrawer via wrapped handlers `handleBillingCityChange`/`handleBillingPostcodeChange`. BillingFields sees only wrapped onChange. |

---

## 13. Next-session execution flow

After /kickoff in next session:

1. **/plan G2.1** (STRICT)
   - Read this doc + CartDrawer.tsx lines 1712-1749
   - EXPECTED-FILES: `src/components/BillingFields.tsx` (NEW), `src/components/CartDrawer.tsx` (LOCK)
   - 7 props per §10
   - Branch: `batch/g2.1-billing-fields`

2. **Execute G2.1** (Sonnet)
   - Create BillingFields.tsx with internal `paymentJsRequested` null-gate
   - Byte-identical JSX copy from CartDrawer 1712-1749
   - Replace inline block with `<BillingFields ... />`
   - Verify gates (typecheck + lint + test + build)
   - Push branch → Vercel preview

3. **Smoke G2.1** (Pavle, Bankart test mode)
   - Cart → checkout → card payment selected → paymentJsRequested true → billing panel renders identically
   - Empty billing → submit attempt → error display works
   - Valid billing → continue
   - Card flow proceeds to PaymentJS panel (G2.2 still inline)

4. **/close G2.1** → merge to main → delete branch

5. **/plan G2.2** (STRICT)
   - Read this doc §11 + CartDrawer.tsx lines 1751-1869
   - EXPECTED-FILES: `src/components/CardFields.tsx` (NEW), `src/components/CartDrawer.tsx` (LOCK)
   - ~20 props per §11
   - Branch: `batch/g2.2-card-fields`

6. **Execute G2.2 + Smoke + /close** → merge to main → delete branch

**Result:** After G2.1 + G2.2, CartDrawer.tsx will be ~2293 - 38 - 120 = ~2135 LOC (excluding props passing overhead). PaymentJS lifecycle still in CartDrawer; UI fully extracted.

---

## 14. Deferred (post-G2)

Beyond G2.1+G2.2 — out of current scope but documented for future:

- **G3:** Extract CartView (item list / qty) — per ROADMAP
- **G4:** CartDrawer → thin orchestrator (~300 LOC) — final assembly
- **Future hook lift:** `usePaymentJsLifecycle` (PaymentJS init useEffect + tokenize) and `useBankartReturn` (return URL handler). Would require `useImperativeHandle` for tokenize() exposure.

---

**End of recon.**

Source: forensic recon performed 2026-05-20 against post-G1 main (CartDrawer.tsx 2293 LOC). All line numbers reference that state. Re-verify against latest main before G2.1 execution if main has advanced.
