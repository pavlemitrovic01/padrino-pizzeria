# Phase 2 Implementation Brief — Presentational Extraction

**PSCP VERDICT:** APPROVED. Spremno za izvođenje.

---

## 1. Future files to create/change

| Akcija | Fajl |
|--------|------|
| CREATE | `src/components/CartDrawerImage.tsx` |
| CHANGE | `src/components/CartDrawer.tsx` |

---

## 2. Tačna props mapa za sve 4 komponente

| Komponenta | Props |
|------------|-------|
| `SmartCartImage` | `image?: string \| null`, `name: string`, `alt: string` |
| `SmartCartImageInner` | Isto |
| `SmartMiniAddonImage` | `name: string`, `className?: string` |
| `SmartMiniAddonImageInner` | Isto |

---

## 3. Šta ostaje u CartDrawer.tsx

- useCart, checkout, createOrderSnapshot, resetCheckout
- Sva form state, validation, Payment.js, Bankart
- DELIVERY_ZONES, Bankart storage helpers, payment guards
- onSubmitOrder, applySuccessUiState, fetchBankartOrderStatus
- Svi useEffects, handlers
- Sav preostali JSX (cart list, checkout form, success view)
- Import: `SmartCartImage`, `SmartMiniAddonImage` iz `./CartDrawerImage`
- Korišćenje: `<SmartCartImage image={...} name={...} alt={...} />`, `<SmartMiniAddonImage name={...} className={...} />` na istim mestima

---

## 4. Šta eksplicitno NE SME da se menja

- Image fallback logika (onError, idx, candidates)
- Label/render ponašanje (alt, aria-hidden, className)
- buildImageCandidates pozivi i ponašanje
- Payment, delivery, Bankart
- Business logika
- Novi helper extraction
- Broj ili struktura fajlova (samo 2 fajla)

---

## 5. Commit scope sentence

```
refactor(CartDrawer): extract SmartCartImage and SmartMiniAddonImage to CartDrawerImage.tsx
```

---

## 6. Minimal manual PASS checklist

- [ ] `npm run build` — exit 0
- [ ] `npm run test` — exit 0
- [ ] Open cart
- [ ] Add/remove item
- [ ] Cart item image rendering
- [ ] Addon/sauce/drink images
- [ ] Stuffed crust prikaz/cena
- [ ] Cart open/close
