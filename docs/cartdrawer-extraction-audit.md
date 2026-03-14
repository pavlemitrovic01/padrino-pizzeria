# CartDrawer Extraction Audit (Read-Only)

**Datum:** Repo state u trenutku kreiranja.  
**Pravilo:** Audit only. Bez izmene koda. Bez refaktora. Bez commit-a.

---

## 1. Tačna mapa CartDrawer.tsx po zonama

### 1.1 Pure helpers kandidati (L95–L600)

| Funkcija | Linije | Odgovornost | Zavisnosti |
|----------|--------|-------------|------------|
| `formatFeeEurShort` | 95–99 | cents → "X€" | — |
| `envFlagEnabled` | 126–129 | env string → boolean | — |
| `isPaymentStatusValue` | 131–139 | type guard za payment status | — |
| `isFinalPaymentStatusValue` | 141–143 | paid/failed/cancelled/refunded | — |
| `getBankartReturnParams` | 145–169 | URL params za Bankart return | window |
| `readBankartReturnStorage` | 171–200 | sessionStorage read | window |
| `writeBankartReturnStorage` | 202–209 | sessionStorage write | window |
| `clearBankartReturnStorage` | 211–218 | sessionStorage clear | window |
| `cleanBankartReturnUrl` | 220–229 | history.replaceState | window |
| `normalizeText` | 232–242 | dijakritika + trim | — |
| `normalizeCategory` | 244–246 | wrapper za normalizeText | — |
| `toSiteSettingsCheckoutDefaults` | 248–257 | raw → SiteSettingsCheckoutDefaults | — |
| `isDrinkCategory` | 259–262 | pica/pice/napici | — |
| `isSauceCategory` | 264–267 | sosovi/sosevi | — |
| `hasEurPrice` | 269–273 | row ima price_eur_cents | MenuItemData |
| `isSaucesPlaceholder` | 275–278 | sosovi placeholder | — |
| `isSauceItemName` | 280–311 | sauce keywords | — |
| `normalizeAddonName` | 313–323 | addon normalize | — |
| `isStuffedCrustAddonName` | 325–337 | stuffed crust addon | — |
| `stuffedCrustPriceForSize` | 339–343 | 50cm=400, 33cm=200 | PizzaSize |
| `parsePizzaSizeFromName` | 345–350 | 33/50 cm iz imena | — |
| `stripPizzaSizeFromName` | 352–358 | uklanja 33/50 cm | — |
| `isPizzaRow` | 360–364 | pizza kategorija | MenuItemData |
| `stripSizeFromAnyName` | 369–375 | 33/50 cm strip | — |
| `buildFileCandidatesFromFilename` | 427–449 | file → path kandidati | — |
| `buildFileCandidatesFromName` | 451–498 | name → file kandidati | NAME_TO_FILE |
| `buildImageCandidates` | 500–526 | image+name → kandidati | — |

### 1.2 Presentational extraction kandidati

| Komponenta | Linije | Odgovornost | Zavisnosti |
|------------|--------|-------------|------------|
| `SmartCartImage` | 527–534 | wrapper za SmartCartImageInner | buildImageCandidates |
| `SmartCartImageInner` | 535–559 | img sa fallback chain | useState, buildImageCandidates |
| `SmartMiniAddonImage` | 561–564 | wrapper | — |
| `SmartMiniAddonImageInner` | 565–590 | addon img sa fallback | useState, buildImageCandidates |

### 1.3 State / business-logic zone — NE DIRATI SADA

| Zona | Linije (pribl.) | Odgovornost |
|------|-----------------|-------------|
| useCart destructuring | 594–616 | cart state, checkout, createOrderSnapshot |
| Form state (name, phone, address, …) | 636–656 | checkout form |
| Validation useMemo | 657–695 | isNameValid, isPhoneValid, … |
| Payment.js state | 698–716 | paymentJsReady, paymentJsLoading, … |
| Delivery zone state | 726–731 | deliveryZoneKey, isZoneOpen |
| Submit/success state | 734–752 | submitting, successOrderId, … |
| Catalogs (addons, sauces, drinks) | 1020–1035 | addonsCatalog, saucesCatalog, drinksCatalog |
| useEffects | 755–915, 1369–1780+ | Bankart init, checkout defaults, Bankart return |
| `applySuccessUiState` | 942–1003 | success UI mapping |
| `fetchBankartOrderStatus` | 1005–1018 | API call |
| `onSubmitOrder` | 1799+ | createOrder, Bankart redirect |
| Totals, canSubmit, canConfirmOrder | 1056–1126 | business rules |
| Validation errors | 1141–1231 | error messages |
| Handlers (backToCart, handleCloseDrawer, …) | 1274–1367 | navigation, cleanup |

---

## 2. Predlog faza (redosled)

| Faza | Opis | Kada |
|------|------|------|
| **Phase 1** | Pure helper extraction | Prva, uz odobrenje |
| **Phase 2** | Presentational extraction | Posle Phase 1 |
| **Phase 3** | Hook/business-logic extraction | Samo kao buduća opcija, ne sada |

---

## 3. Zona po zoni: rizik, LOCK, zašto sme/ne sme

### 3.1 Pure helpers (bez window/payment)

| Funkcija | Rizik | LOCK-like | Zašto sme/ne sme |
|----------|-------|-----------|------------------|
| `normalizeText` | low | ne | Čista, bez side-effecta. Duplikat u Menu.tsx — može u shared. |
| `normalizeCategory` | low | ne | Wrapper za normalizeText. |
| `formatFeeEurShort` | low | ne | Čista. |
| `envFlagEnabled` | low | ne | Čista. |
| `isPaymentStatusValue` | low | da (payment) | Type guard, čista, ali payment-related. |
| `isFinalPaymentStatusValue` | low | da (payment) | Isto. |
| `isDrinkCategory` | low | ne | Čista. |
| `isSauceCategory` | low | ne | Čista. |
| `hasEurPrice` | low | ne | Zavisi od MenuItemData. |
| `isSaucesPlaceholder` | low | ne | Čista. |
| `isSauceItemName` | low | ne | Čista. |
| `normalizeAddonName` | low | ne | Čista. |
| `isStuffedCrustAddonName` | low | ne | Čista. |
| `stuffedCrustPriceForSize` | low | ne | Zavisi od PizzaSize. |
| `parsePizzaSizeFromName` | low | ne | Čista. |
| `stripPizzaSizeFromName` | low | ne | Čista. |
| `isPizzaRow` | low | ne | Zavisi od MenuItemData. |
| `stripSizeFromAnyName` | low | ne | Čista. |
| `buildFileCandidatesFromFilename` | low | ne | Čista. |
| `buildFileCandidatesFromName` | low | ne | Zavisi od NAME_TO_FILE. |
| `buildImageCandidates` | low | ne | Čista. |
| `toSiteSettingsCheckoutDefaults` | low | ne | Čista. |

### 3.2 Bankart/storage helpers (window)

| Funkcija | Rizik | LOCK-like | Zašto sme/ne sme |
|----------|-------|-----------|------------------|
| `getBankartReturnParams` | medium | da | Koristi window, URL. Payment flow. |
| `readBankartReturnStorage` | medium | da | sessionStorage. Payment flow. |
| `writeBankartReturnStorage` | medium | da | Isto. |
| `clearBankartReturnStorage` | medium | da | Isto. |
| `cleanBankartReturnUrl` | medium | da | history.replaceState. |

### 3.3 Presentational components

| Komponenta | Rizik | LOCK-like | Zašto sme/ne sme |
|------------|-------|-----------|------------------|
| `SmartCartImage` | medium | ne | React, useState, buildImageCandidates. |
| `SmartCartImageInner` | medium | ne | Isto. |
| `SmartMiniAddonImage` | medium | ne | Isto. |
| `SmartMiniAddonImageInner` | medium | ne | Isto. |

### 3.4 State / business logic

| Zona | Rizik | LOCK-like | Zašto ne sme |
|------|-------|-----------|--------------|
| useCart, checkout, createOrderSnapshot | high | da | Core cart/checkout. |
| Payment.js init, controller | high | da | Bankart flow. |
| onSubmitOrder | high | da | createOrder, Bankart redirect. |
| applySuccessUiState | high | da | Success flow. |
| Bankart return handling | high | da | Payment flow. |
| Form validation, canConfirmOrder | high | da | Checkout rules. |

---

## 4. Konkretna lista

### SAFE TO EXTRACT NOW (Phase 1, samo čisti helpers)

- `normalizeText`
- `normalizeCategory`
- `formatFeeEurShort`
- `envFlagEnabled`
- `isDrinkCategory`
- `isSauceCategory`
- `hasEurPrice`
- `isSaucesPlaceholder`
- `isSauceItemName`
- `normalizeAddonName`
- `isStuffedCrustAddonName`
- `stuffedCrustPriceForSize`
- `parsePizzaSizeFromName`
- `stripPizzaSizeFromName`
- `isPizzaRow`
- `stripSizeFromAnyName`
- `buildFileCandidatesFromFilename`
- `buildFileCandidatesFromName`
- `buildImageCandidates`
- `toSiteSettingsCheckoutDefaults`
- `NAME_TO_FILE` (konstanta, ide uz `buildFileCandidatesFromName`)

**Napomena:** `isPaymentStatusValue`, `isFinalPaymentStatusValue` su čiste, ali payment-related — mogu u Phase 1 ako želiš, ili ostaju za Phase 2.

### SAFE LATER (Phase 2 ili kasnije)

- Bankart helpers: `getBankartReturnParams`, `readBankartReturnStorage`, `writeBankartReturnStorage`, `clearBankartReturnStorage`, `cleanBankartReturnUrl`
- `SmartCartImage`, `SmartCartImageInner`
- `SmartMiniAddonImage`, `SmartMiniAddonImageInner`
- `DELIVERY_ZONES` (uz zone-related logiku)

### DO NOT TOUCH

- useCart destructuring i sva korišćenja
- Payment.js init useEffect (L799–915)
- Bankart return useEffect (L1389+)
- `onSubmitOrder`
- `applySuccessUiState`
- `fetchBankartOrderStatus`
- Sva form state, validation, canConfirmOrder
- Success state handling
- createOrder, createOrderSnapshot, checkout, resetCheckout

---

## 5. Procena

### 5.1 Minimalan broj fajlova za Phase 1

| Opcija | Fajlovi | Opis |
|--------|---------|------|
| A | 1 | `src/lib/cartDrawerHelpers.ts` — svi čisti helpers |
| B | 2 | `src/lib/cartDrawerHelpers.ts` + `src/lib/cartDrawerImageHelpers.ts` (image + NAME_TO_FILE) |

**Preporuka:** Opcija A — jedan fajl za Phase 1. Import u CartDrawer.tsx. Tipovi (`MenuItemData`, `PizzaSize`, `SiteSettingsCheckoutDefaults`) — ili inline u helper parametrima, ili u `src/types/` ako već postoji. `PizzaSize`, `PizzaVariant` dolaze iz `CartContext` — ostaju import.

### 5.2 Rollback strategy

- Phase 1: revert commit. CartDrawer ponovo ima inline helpers. Nema promene u ponašanju.
- Ako se pojavi bug: ukloniti import, vratiti funkcije u CartDrawer.

### 5.3 Manual PASS za Phase 1 (jednog dana)

| # | Šta | PASS |
|---|-----|------|
| 1 | npm run build | Exit 0 |
| 2 | npm run test | Exit 0 |
| 3 | Otvori cart, dodaj stavku | Kartica se prikaže |
| 4 | Checkout flow — gotovina | Porudžbina se pošalje |
| 5 | Checkout flow — kartica (ako enabled) | Bankart polja, redirect, success |
| 6 | Delivery zone izbor | Fee se računa |
| 7 | Addons, sauces, drinks | Dodavanje radi |
| 8 | Stuffed crust pricing | 33cm=200, 50cm=400 |
| 9 | Bankart return URL | Success view, status poll |
| 10 | Zatvaranje cart-a | State se resetuje |

---

## 6. Zaključak

- **Phase 1:** Čisti helpers u `src/lib/cartDrawerHelpers.ts`. ~20 funkcija. Nizak rizik.
- **Phase 2:** Presentational komponente + Bankart storage helpers. Srednji rizik.
- **Phase 3:** Hook/business-logic — samo kao buduća opcija, ne sada.

**LOCK:** CartDrawer ostaje LOCK. Extraction samo uz eksplicitno odobrenje. Bez diranja payment flow-a, createOrder-a, Bankart init-a.
