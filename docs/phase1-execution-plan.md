# Phase 1 Execution Plan — Pure Helper Extraction

**PSCP VERDICT:** APPROVED.  
**Pravila:** samo pure stateless helpers; bez DELIVERY_ZONES; bez Bankart storage helpers; bez submit/validation/success/payment-return logike; bez presentational extraction.

---

## 1. Tačan predlog jednog future fajla

```
src/lib/cartDrawerHelpers.ts
```

---

## 2. Tačna lista helper funkcija koje ulaze u Phase 1

| # | Funkcija |
|---|----------|
| 1 | `formatFeeEurShort` |
| 2 | `envFlagEnabled` |
| 3 | `normalizeText` |
| 4 | `normalizeCategory` |
| 5 | `toSiteSettingsCheckoutDefaults` |
| 6 | `isDrinkCategory` |
| 7 | `isSauceCategory` |
| 8 | `hasEurPrice` |
| 9 | `isSaucesPlaceholder` |
| 10 | `isSauceItemName` |
| 11 | `normalizeAddonName` |
| 12 | `isStuffedCrustAddonName` |
| 13 | `stuffedCrustPriceForSize` |
| 14 | `parsePizzaSizeFromName` |
| 15 | `stripPizzaSizeFromName` |
| 16 | `isPizzaRow` |
| 17 | `stripSizeFromAnyName` |
| 18 | `buildFileCandidatesFromFilename` |
| 19 | `buildFileCandidatesFromName` |
| 20 | `buildImageCandidates` |

**Konstanta:** `NAME_TO_FILE` (ide uz `buildFileCandidatesFromName`)

---

## 3. Tačna lista helpera koji NE ulaze još

| Kategorija | Funkcije / konstante |
|------------|----------------------|
| Bankart storage | `getBankartReturnParams`, `readBankartReturnStorage`, `writeBankartReturnStorage`, `clearBankartReturnStorage`, `cleanBankartReturnUrl` |
| Payment type guards | `isPaymentStatusValue`, `isFinalPaymentStatusValue` |
| Delivery zones | `DELIVERY_ZONES` |
| Presentational | `SmartCartImage`, `SmartCartImageInner`, `SmartMiniAddonImage`, `SmartMiniAddonImageInner` |

---

## 4. Expected imports in/out

### 4.1 `src/lib/cartDrawerHelpers.ts` — imports IN

| Import | Iz |
|--------|-----|
| `PizzaSize` | `../context/CartContext` (ili inline tip ako je minimalan) |
| `SiteSettingsCheckoutDefaults` | lokalni tip u fajlu (ili shared types) |
| `MenuItemData` | lokalni tip u fajlu (ili shared types) — za `hasEurPrice`, `isPizzaRow` |

**Napomena:** Ako tipovi ostaju u CartDrawer, helperi mogu primati inline tipove npr. `{ price_eur_cents: number \| null }`, `{ category: string }`.

### 4.2 `src/components/CartDrawer.tsx` — imports OUT (dodati)

| Import | Iz |
|--------|-----|
| Sve 20 funkcija + `NAME_TO_FILE` | `../lib/cartDrawerHelpers` |

### 4.3 `src/components/CartDrawer.tsx` — imports ostaju

- `AnimatePresence`, `motion`, `useEffect`, `useMemo`, `useRef`, `useState`, `FormEvent`
- `supabase`, `useCart`, `formatEUR`, `toSafeInt`, `createOrder`, `createBankartPaymentJs`, itd.
- Tipovi: `PizzaSize`, `PizzaVariant`, `PaymentMethod` iz CartContext

---

## 5. Minimal rollback plan

| Korak | Akcija |
|-------|--------|
| 1 | `git revert <commit>` |
| 2 | CartDrawer.tsx vraća inline helper funkcije |
| 3 | Obrisati `src/lib/cartDrawerHelpers.ts` ako je kreiran |
| 4 | `npm run build` — provera |

**Alternativa:** Ako bug — ukloniti import iz CartDrawer, vratiti funkcije inline, obrisati cartDrawerHelpers.ts.

---

## 6. Minimal manual PASS plan za helper-only extraction

| # | Šta | PASS kriterijum |
|---|-----|-----------------|
| 1 | `npm run build` | Exit 0 |
| 2 | `npm run test` (ako postoji) | Exit 0 |
| 3 | Otvori cart, dodaj stavku | Kartica se prikaže, slika se učitava |
| 4 | Checkout — gotovina | Porudžbina se pošalje |
| 5 | Delivery zone izbor | Fee se prikaže (formatFeeEurShort) |
| 6 | Addons, sauces, drinks | Dodavanje radi (normalizeAddonName, isSauceItemName, itd.) |
| 7 | Stuffed crust | 33cm=200, 50cm=400 (stuffedCrustPriceForSize) |
| 8 | Zatvaranje cart-a | State se resetuje |

**Napomena:** Bankart flow (kartica, return URL) nije u fokusu Phase 1 — helperi koji ga koriste ostaju u CartDrawer. PASS 4–8 pokrivaju samo one helpere koji su izvučeni.
