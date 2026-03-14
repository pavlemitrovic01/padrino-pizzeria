# Phase 1 Implementation Brief — Helper-Only Extraction

**PSCP VERDICT:** APPROVED. Spremno za izvođenje.

---

## 1. File to change/create

| Akcija | Fajl |
|--------|------|
| CREATE | `src/lib/cartDrawerHelpers.ts` |
| CHANGE | `src/components/CartDrawer.tsx` |

---

## 2. Tačna helper lista koja ide u batch

1. `formatFeeEurShort`
2. `envFlagEnabled`
3. `normalizeText`
4. `normalizeCategory`
5. `toSiteSettingsCheckoutDefaults`
6. `isDrinkCategory`
7. `isSauceCategory`
8. `hasEurPrice`
9. `isSaucesPlaceholder`
10. `isSauceItemName`
11. `normalizeAddonName`
12. `isStuffedCrustAddonName`
13. `stuffedCrustPriceForSize`
14. `parsePizzaSizeFromName`
15. `stripPizzaSizeFromName`
16. `isPizzaRow`
17. `stripSizeFromAnyName`
18. `buildFileCandidatesFromFilename`
19. `buildFileCandidatesFromName`
20. `buildImageCandidates`

**Konstanta:** `NAME_TO_FILE`

---

## 3. Expected import changes in CartDrawer.tsx

| Akcija | Detalj |
|--------|--------|
| ADD | `import { ... } from "../lib/cartDrawerHelpers"` — svih 20 funkcija + `NAME_TO_FILE` |
| REMOVE | Inline definicije tih 20 funkcija + `NAME_TO_FILE` (L95–L526, isključujući Bankart helpers i presentational) |

---

## 4. Šta eksplicitno ostaje netaknuto

- `DELIVERY_ZONES` i sva zone logika
- Bankart storage helpers: `getBankartReturnParams`, `readBankartReturnStorage`, `writeBankartReturnStorage`, `clearBankartReturnStorage`, `cleanBankartReturnUrl`
- Payment type guards: `isPaymentStatusValue`, `isFinalPaymentStatusValue`
- Presentational: `SmartCartImage`, `SmartCartImageInner`, `SmartMiniAddonImage`, `SmartMiniAddonImageInner`
- Svi tipovi ostaju u CartDrawer — bez premeštanja u `src/types/`
- useCart, form state, validation, Payment.js, Bankart return, onSubmitOrder, success flow
- Sve ostale import-e u CartDrawer.tsx

---

## 5. Commit scope sentence

```
refactor(CartDrawer): extract 20 pure helpers to cartDrawerHelpers.ts
```

---

## 6. Manual PASS checklist

- [ ] `npm run build` — exit 0
- [ ] `npm run test` — exit 0
- [ ] Open cart
- [ ] Add/remove item
- [ ] Sauces/addons/drinks
- [ ] Stuffed crust prikaz/cena
- [ ] Cart open/close
